import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { solveTemplate, Template } from "@/lib/geometry/solvers";

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
- {"template":"unsupported","reason":string}                                  anything else, or numbers you cannot read; say briefly why

If a number is unreadable or missing, use "unsupported" rather than guessing. If the cutting plane is described some other way (for example by a trace angle to the VP, or perpendicular to the HP), use "unsupported".`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, reason: "The AI solver isn't configured yet (missing ANTHROPIC_API_KEY). Try one of the example lessons." }, { status: 503 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.image && !parsed.data.text?.trim())) {
    return NextResponse.json({ ok: false, reason: "Send a photo of the problem or type it in." }, { status: 400 });
  }
  const { image, mediaType = "image/jpeg", text } = parsed.data;

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
    if (!reply.success) return NextResponse.json({ ok: false, reason: "I couldn't understand that problem's numbers. Try a clearer photo, or type the problem." }, { status: 422 });
    if (reply.data.template === "unsupported") return NextResponse.json({ ok: false, reason: reply.data.reason }, { status: 422 });

    const result = solveTemplate(reply.data);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ ok: false, reason: "Too many requests right now. Please try again in a minute." }, { status: 429 });
    if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ ok: false, reason: "The AI solver's API key is invalid." }, { status: 503 });
    if (e instanceof SyntaxError) return NextResponse.json({ ok: false, reason: "The AI gave an unreadable answer. Please try again." }, { status: 502 });
    console.error("solve failed", e);
    return NextResponse.json({ ok: false, reason: "Something went wrong while solving. Please try again." }, { status: 500 });
  }
}
