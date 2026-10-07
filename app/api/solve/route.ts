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
- {"template":"isometric_cone","diameter":number,"height":number,"scale":"isometric"|"true"}   isometric view of a cone standing on its base (same scale rule as the cylinder)
- {"template":"isometric_sphere","diameter":number,"hemisphere":boolean,"scale":"isometric"|"true"}   isometric view of a sphere, or of a hemisphere with its flat face down when "hemisphere" is true. If given a radius, double it.
- {"template":"section_polyhedron","solid":"prism"|"pyramid","base":"triangle"|"square"|"pentagon"|"hexagon","side":number,"height":number,"angle":number,"axisHeight":number}
    a prism or pyramid standing on its base, cut by a plane perpendicular to the VP and inclined "angle" degrees to the HP (1 to 80), crossing the axis "axisHeight" mm above the base. Asks for the sectional top view and the true shape of the section.
- {"template":"section_round","solid":"cylinder"|"cone","diameter":number,"height":number,"angle":number,"axisHeight":number,"axisOffset":number,"parallelToGenerator":boolean}
    the same for a cylinder or cone. Angle may be up to 89 (use 89 for a plane parallel to the axis). "axisOffset" (optional, default 0) is how far right (+) or left (-) of the axis the plane crosses the height "axisHeight". For a cone, set "parallelToGenerator":true when the plane is parallel to the end generator (parabola; the angle is then ignored, give 45 as a placeholder); a steeper plane gives a hyperbola. The plane may leave through the base.
- {"template":"conic","distance":number,"eccentricity":number}   ellipse (e<1, at most 0.95), parabola (e=1) or hyperbola (e>1) by the eccentricity / focus-directrix method; distance = focus to directrix. If the problem gives e as a ratio such as 2/3, convert it to a decimal.
- {"template":"development_cone","diameter":number,"height":number}   development of the curved surface of a cone
- {"template":"development_pyramid","base":"triangle"|"square"|"pentagon"|"hexagon","side":number,"height":number}   development of the lateral surface of a regular pyramid (height = axis)
- {"template":"development_prism","base":"triangle"|"square"|"pentagon"|"hexagon","side":number,"height":number}   development of a regular prism
- {"template":"solid_inclined","solid":"prism"|"pyramid"|"cone","base":"triangle"|"square"|"pentagon"|"hexagon","size":number,"height":number,"angle":number,"phi":number,"rest":"corner"|"edge"}
    projections of a solid standing on its base that is then tilted so its AXIS makes "angle" degrees (1 to 89) with the HP, the base touching the HP at a corner ("corner") or along an edge ("edge"). "size" is the base side (prism, pyramid) or the base diameter (cone); leave "base" out for a cone. "height" is the axis length. "phi" is optional: include it only when the problem also gives the inclination of the PLAN (top view) of the axis to the VP (1 to 89); omit it otherwise. "first":"HP"|"VP" is optional (default "HP"): use "VP" when the solid rests on the VP and its axis is inclined to the VP first; then "angle" is the axis inclined to the VP and "phi" the inclination of the FRONT VIEW of the axis to the HP. If the problem instead tilts a base edge or a generator to the HP, or gives the inclination of the axis itself (not its plan) to the VP, use "unsupported".
- {"template":"plane_inclined","shape":"triangle"|"square"|"pentagon"|"hexagon"|"circle","size":number,"angle":number,"phi":number,"rest":"corner"|"edge"}   projections of a plane figure (lamina) whose SURFACE is inclined "angle" degrees to the HP, resting on a corner or a side (a circle rests on a point). "size" is the side, or the diameter of a circle. "first":"HP"|"VP" is optional (default "HP"): use "VP" when the problem puts the lamina with its surface inclined to the VP FIRST (side on the VP); then "angle" is the inclination of the SURFACE TO THE VP and "phi" the inclination of the side (in the VP) to the HP. "phi" is optional: include it only when a side lying in the HP (or, for a circle, the diameter in the HP) is also inclined to the VP by that many degrees (1 to 89); with rest "edge" phi belongs to that side, with rest "corner" it belongs to the plan of the line joining the resting corner to the centre. Any other VP condition is "unsupported".
- {"template":"interpenetration_cylinders","mainDiameter":number,"mainHeight":number,"branchDiameter":number,"axisHeight":number}   a vertical cylinder pierced by a smaller (or equal) horizontal cylinder whose axis meets the vertical axis at right angles and is parallel to the VP; draw the curves of intersection. "axisHeight" (height of the branch axis above the base) is optional. Other penetrations (prism, cone, offset axes) are "unsupported".
- {"template":"isometric_composite","scale":"isometric"|"true","parts":[...]}   isometric view of two to four solids stacked on one vertical axis, listed from the BOTTOM up. Each part is one of:
    {"kind":"prism","base":"rectangle"|"triangle"|"square"|"pentagon"|"hexagon","side":number,"width":number,"height":number}  (width only for a rectangle)
    {"kind":"cylinder","diameter":number,"height":number}   {"kind":"cone","diameter":number,"height":number}   {"kind":"sphere","diameter":number}   {"kind":"hemisphere","diameter":number}  (flat face down)
    A cone, sphere or hemisphere can only be the top part. Solids side by side are isometric_row; holes and corner notches are isometric_holed and isometric_notched; off-axis or overlapping solids and other cut-outs are "unsupported".
- {"template":"isometric_row","parts":[...],"gap":number,"along":"x"|"y","scale":"isometric"|"true"}   isometric view of 2 or 3 solids standing on the same ground side by side in a row (touching, or "gap" mm apart; gap 0 = touching). "parts" are the same kinds as in isometric_composite ({"kind":"prism","base":"rectangle"|"triangle"|"square"|"pentagon"|"hexagon","side":number,"width":number,"height":number} (width only for a rectangle; the length "side" runs along the x axis and the width along the y axis), {"kind":"cylinder","diameter","height"}, {"kind":"cone","diameter","height"}, {"kind":"sphere","diameter"}, {"kind":"hemisphere","diameter"} flat face down). List them in order along the row, STARTING WITH THE ONE NEAREST THE VIEWER (the lower end of the row). "along":"x" if the row runs up and to the right (the default when the problem only says side by side), "y" if it runs up and to the left. Solids standing one on top of another are isometric_composite, not this. Solids that overlap, interpenetrate, or are not on one ground plane are "unsupported".
- {"template":"isometric_holed","solid":"prism"|"cylinder","base":"rectangle"|"triangle"|"square"|"pentagon"|"hexagon","side":number,"width":number,"diameter":number,"height":number,"holeDiameter":number,"holeDepth":number,"scale":"isometric"|"true"}   isometric view of a prism (give base, side, and width for a rectangle) or a cylinder (give diameter) standing on its base with a round hole drilled vertically through the CENTRE of its top face. "holeDepth" is optional: leave it out for a hole right through. If the problem gives a hole radius, double it. A hole that does not fit in the top face is reported to the student automatically. Holes in a side face, off-centre holes, several holes, or stepped (counterbored) holes are "unsupported".
- {"template":"isometric_notched","length":number,"width":number,"height":number,"notchLength":number,"notchWidth":number,"notchDepth":number,"at":"front"|"back"|"left"|"right","scale":"isometric"|"true"}   isometric view of a rectangular block with a rectangular notch (step) cut out of ONE TOP CORNER. "length" runs along the isometric axis that goes up and to the right and "width" along the one that goes up and to the left; "notchLength" is the notch's size along the length and "notchWidth" along the width; "notchDepth" is how far down it is cut. "at" names the corner as the viewer sees the isometric block: "front" (nearest the viewer, the lowest corner on the page), "back" (farthest), "left" or "right". Default "front" if the problem does not say. A notch that runs the whole length or width, notches on a bottom corner or on an edge in the middle, or several notches are "unsupported".
- interpenetration_cylinders_offset: {"template":"interpenetration_cylinders_offset","mainDiameter":number,"mainHeight":number,"branchDiameter":number,"offset":number,"axisHeight":number (optional, default half the height)}. A vertical cylinder completely pierced by a smaller horizontal cylinder whose axis is parallel to the VP and at right angles to the vertical axis but does NOT meet it: it passes 'offset' mm in front of the vertical axis (toward the viewer). All lengths in mm; axisHeight is the height of the branch axis above the base. The branch must stay within the width of the main cylinder (offset + branch radius <= main radius), otherwise the solver says so. If the axes intersect (offset 0) use interpenetration_cylinders instead. Use "unsupported" if the offset is behind the vertical axis or the branch axis is perpendicular to the VP.
- interpenetration_cone_cylinder: {"template":"interpenetration_cone_cylinder","coneDiameter":number,"coneHeight":number,"branchDiameter":number,"axisHeight":number}. A vertical cone standing on its base on the HP, completely pierced by a horizontal cylinder whose axis is parallel to the VP and meets the cone's axis at right angles. axisHeight (required) is the height of the cylinder's axis above the cone's base. All mm. The cylinder must lie inside the cone's side view; otherwise the solver rejects it with a reason. Use "unsupported" for a cone with its apex down, an inclined cylinder, or a cylinder whose axis is offset from the cone's axis.
- interpenetration_prism_cylinder: {"template":"interpenetration_prism_cylinder","side":number,"height":number,"branchDiameter":number,"axisHeight":number (optional, default half the height),"facesInclined":boolean (optional)}. A vertical square prism (base side 'side', mm) completely pierced by a horizontal cylinder whose axis is parallel to the VP and meets the prism axis at right angles. Set facesInclined true when the problem says the faces are equally inclined to the VP (the usual textbook case, base diagonal parallel to the VP); leave it out or false when a base edge or face is parallel to the VP (then the curve is just a circle on each of two faces). Use "unsupported" for other prisms (rectangular, triangular, hexagonal) or other angles of the faces to the VP.
- {"template":"unsupported","reason":string}                                  anything else, or numbers you cannot read; say briefly why

If a number is unreadable or missing, use "unsupported" rather than guessing. If the cutting plane is described some other way (for example by a trace angle to the VP), use "unsupported".`;

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
