import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { solveTemplate, Template } from "@/lib/geometry/solvers";
import { serviceRoleConfigured, solverNeedsLogin } from "@/lib/env";
import { sameOrigin } from "@/lib/http";
import { loadEntitlements } from "@/lib/me";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { currentUser } from "@/lib/supabase/server";

export const maxDuration = 60;

const Body = z.object({
  image: z.string().max(8_000_000).optional(), // base64, no data: prefix
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]).optional(),
  text: z.string().max(4000).optional(),
});

const Unsupported = z.object({ template: z.literal("unsupported"), reason: z.string() });
const Reply = z.union([Template, Unsupported]);

const SYSTEM = `You read Engineering Graphics & Design (EGD) problems and classify them so a deterministic solver can draw the solution.
Reply with ONE JSON object and nothing else (no markdown fence). Pick the matching template and read the numbers from the problem. All lengths are in mm, all angles in degrees.

Templates:
- {"template":"line_projection","length":number,"thetaHP":number,"phiVP":number}   a line of true length inclined thetaHP to the HP and phiVP to the VP
- {"template":"pentagon","side":number}                                        regular pentagon on a given side
- {"template":"cylinder_development","diameter":number,"height":number}        projections and development of a cylinder
- {"template":"prism_views","side":number,"height":number}                      square prism standing on its base: front and top views
- {"template":"isometric_prism","base":"rectangle"|"triangle"|"square"|"pentagon"|"hexagon","side":number,"width":number,"height":number,"scale":"isometric"|"true"}
    isometric view of a prism standing on its base. "side" is the base side (for a rectangle it is the length and "width" is also required; leave "width" out otherwise).
    scale: "isometric" when the problem says isometric PROJECTION (uses the 0.816 isometric scale), "true" when it says isometric VIEW/DRAWING or gives true lengths.
- {"template":"isometric_cylinder","diameter":number,"height":number,"scale":"isometric"|"true"}   isometric view of a cylinder with a vertical axis
- {"template":"section_polyhedron","solid":"prism"|"pyramid","base":"triangle"|"square"|"pentagon"|"hexagon","side":number,"height":number,"angle":number,"axisHeight":number}
    a prism or pyramid standing on its base, cut by a plane perpendicular to the VP and inclined "angle" degrees to the HP (1 to 80), crossing the axis "axisHeight" mm above the base. Asks for the sectional top view and the true shape of the section.
- {"template":"section_round","solid":"cylinder"|"cone","diameter":number,"height":number,"angle":number,"axisHeight":number}   the same for a cylinder or cone
- {"template":"conic","distance":number,"eccentricity":number}   ellipse (e<1, at most 0.95), parabola (e=1) or hyperbola (e>1) by the eccentricity / focus-directrix method; distance = focus to directrix. If the problem gives e as a ratio such as 2/3, convert it to a decimal.
- {"template":"development_cone","diameter":number,"height":number}   development of the curved surface of a cone
- {"template":"development_pyramid","base":"triangle"|"square"|"pentagon"|"hexagon","side":number,"height":number}   development of the lateral surface of a regular pyramid (height = axis)
- {"template":"development_prism","base":"triangle"|"square"|"pentagon"|"hexagon","side":number,"height":number}   development of a regular prism
- {"template":"solid_inclined","solid":"prism"|"pyramid"|"cone","base":"triangle"|"square"|"pentagon"|"hexagon","size":number,"height":number,"angle":number,"phi":number,"rest":"corner"|"edge"}
    projections of a solid standing on its base that is then tilted so its AXIS makes "angle" degrees (1 to 89) with the HP, the base touching the HP at a corner ("corner") or along an edge ("edge"). "size" is the base side (prism, pyramid) or the base diameter (cone); leave "base" out for a cone. "height" is the axis length. "phi" is optional: include it only when the problem also gives the inclination of the PLAN (top view) of the axis to the VP (1 to 89); omit it otherwise. If the problem instead tilts a base edge or a generator to the HP, or gives the inclination of the axis itself (not its plan) to the VP, use "unsupported".
- {"template":"plane_inclined","shape":"triangle"|"square"|"pentagon"|"hexagon"|"circle","size":number,"angle":number,"phi":number,"rest":"corner"|"edge"}   projections of a plane figure (lamina) whose SURFACE is inclined "angle" degrees to the HP, resting on a corner or a side (a circle rests on a point). "size" is the side, or the diameter of a circle. "phi" is optional: include it only when a side lying in the HP (or, for a circle, the diameter in the HP) is also inclined to the VP by that many degrees (1 to 89); then rest must be "edge". Any other VP condition is "unsupported".
- {"template":"unsupported","reason":string}                                  anything else, or numbers you cannot read; say briefly why

If a number is unreadable or missing, use "unsupported" rather than guessing. If the cutting plane is described some other way (for example by a trace angle to the VP, or perpendicular to the HP), use "unsupported".`;

type Fail = { ok: false; reason: string; code?: "login_required" | "limit_reached" };
const fail = (body: Fail, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return fail({ ok: false, reason: "The AI solver isn't configured yet (missing ANTHROPIC_API_KEY). Try one of the example lessons." }, 503);
  }
  if (!sameOrigin(req)) return fail({ ok: false, reason: "Bad origin." }, 403);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.image && !parsed.data.text?.trim())) {
    return fail({ ok: false, reason: "Send a photo of the problem or type it in." }, 400);
  }
  const { image, mediaType = "image/jpeg", text } = parsed.data;

  // Who is asking, and do they have a solve left today? Every AI call costs money, so this runs first.
  let userId: string | null = null;
  let isPro = false;
  const gated = solverNeedsLogin();
  if (gated) {
    if (!serviceRoleConfigured()) return fail({ ok: false, reason: "Accounts aren't set up on this server yet, so the AI solver is switched off." }, 503);
    const user = await currentUser();
    if (!user) return fail({ ok: false, code: "login_required", reason: "Sign in to solve your own problems. The example lessons need no account." }, 401);
    userId = user.id;
    const ent = await loadEntitlements(user.id);
    isPro = ent.isPro;
    const { data, error } = await supabaseAdmin().rpc("consume_solve", { p_user: user.id, p_limit: ent.dailyLimit });
    if (error) {
      console.error("consume_solve failed", error);
      return fail({ ok: false, reason: "Something went wrong. Please try again." }, 500);
    }
    if (!data) {
      return fail({ ok: false, code: "limit_reached", reason: ent.isPro ? "You've reached today's fair-use limit. It resets at midnight India time." : `You've used your ${ent.dailyLimit} free solves for today. Upgrade to Pro for unlimited solves, or come back tomorrow.` }, 429);
    }
  }
  // a failed attempt should not cost the student a solve
  const refund = async () => {
    if (userId) await supabaseAdmin().rpc("refund_solve", { p_user: userId }).then(() => {}, (e) => console.error("refund failed", e));
  };
  const give = async (body: Fail, status: number) => { await refund(); return fail(body, status); };

  const content: Anthropic.ContentBlockParam[] = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: image } });
  content.push({ type: "text", text: text?.trim() ? `Problem text: ${text.trim()}` : "Classify the problem in this image." });

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5",
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    const raw = response.content.find((b) => b.type === "text")?.text ?? "";
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const reply = Reply.safeParse(JSON.parse(json));
    if (!reply.success) return give({ ok: false, reason: "I couldn't understand that problem's numbers. Try a clearer photo, or type the problem." }, 422);
    if (reply.data.template === "unsupported") return give({ ok: false, reason: reply.data.reason }, 422);

    const result = solveTemplate(reply.data);
    if (!result.ok) return give({ ok: false, reason: result.reason }, 422);

    // Pro students keep a history of their lessons
    let savedId: string | null = null;
    if (userId && isPro) {
      const { data } = await supabaseAdmin().from("lessons").insert({ user_id: userId, title: result.solution.title, solution: result.solution }).select("id").single();
      savedId = data?.id ?? null;
    }
    return NextResponse.json({ ...result, savedId }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return give({ ok: false, reason: "Too many requests right now. Please try again in a minute." }, 429);
    if (e instanceof Anthropic.AuthenticationError) return give({ ok: false, reason: "The AI solver's API key is invalid." }, 503);
    if (e instanceof SyntaxError) return give({ ok: false, reason: "The AI gave an unreadable answer. Please try again." }, 502);
    console.error("solve failed", e);
    return give({ ok: false, reason: "Something went wrong while solving. Please try again." }, 500);
  }
}
