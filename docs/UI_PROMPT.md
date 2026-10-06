# UI generation prompt (paste into Lovable / v0 / Bolt / Claude artifact)

Build the front end for **EasyUnderstand**, a website where engineering students upload an Engineering Graphics & Design (EGD) problem, get the solution, and watch it drawn step by step like a professor teaching, then view the result in 3D.

Tech: Next.js (App Router) + TypeScript + Tailwind, `three` + `@react-three/fiber` + `@react-three/drei` for 3D. Mobile-first and responsive. Light/dark theme. Calm, "digital blackboard / drafting paper" feel: off-white or dark slate background, blueprint-blue accents, a monospace or technical font for labels.

## Pages
1. **Home `/`**
   - Hero: "Upload your EGD problem. Watch it solved, line by line."
   - Upload dropzone (drag & drop, click, or paste; accept PNG/JPG/WEBP/PDF page; camera capture on mobile). Below it, a "type your problem instead" textarea.
   - After choosing an image: preview, a crop/rotate control, then a **Solve** button with a loading state ("Reading your drawing...", "Planning the steps...").
   - "Try an example" cards: Projection of a line, Regular pentagon, Cylinder development, Square prism views. Each card shows its category tag and links to `/solve/<slug>`.
   - Recent problems list (from localStorage).
2. **Solution `/solve/[id]`** (the main screen)
   - Left/top: problem statement and a "Given" table (name/value chips).
   - Center: **Drawing board** with two tabs: **Steps (2D)** and **3D**.
   - Right/bottom: **Professor panel** showing the current step number, title, and explanation text, plus the step list (click to jump).
   - Error state: if the solver returns `{ok:false, reason}`, show the reason in a friendly callout with "Edit the numbers and retry".
   - After solving from an upload, show an editable "What I read from your image" card (numbers and angles) so the student can correct a misread value and re-solve.

## Drawing board behavior (2D)
- Renders an SVG. World coordinates are millimetres, **x right, y UP** (flip y for SVG), auto-fit to the bounds of all primitives with padding. Show faint graph-paper grid.
- Primitive types: `line {a,b}`, `circle {c,r}`, `arc {c,r,from,to}` (degrees, counter-clockwise), `text {at,text,size?}`.
- Each primitive has a style: `construction` (thin, light blue, 50% opacity), `outline` (thick, dark), `hidden` (dashed), `centre` (dash-dot), `dimension` (thin with text). A step has a default style; a primitive may override it.
- **Animation like a professor**: primitives are drawn one after another, each stroke "drawn" with `stroke-dashoffset` (use `pathLength="1"`). Duration ~ length/60 mm per second (min 0.5 s, max 2.5 s); text fades in. A moving **pencil/compass cursor** can follow the drawing tip. Playback is a pure function of one timeline time `t` driven by requestAnimationFrame so scrubbing is smooth.
- Controls: Play/Pause, Previous step, Next step, Replay step, speed (0.5x/1x/2x), scrub bar with step ticks, "Show final drawing" toggle. Keyboard: Space, Left/Right arrows.
- Earlier steps stay visible; construction lines dim slightly once the next step starts. The current step's new lines are highlighted.
- Optional "Read aloud" toggle using `speechSynthesis` for each step's explanation.

## 3D tab
- Shown only if `solid` exists in the data; otherwise show "3D is not available for this problem".
- `solid` is one of: `{kind:"extrude", profile:[[x,z],...], height}` (polygon extruded up) or `{kind:"revolve", profile:[[radius,y],...]}` (lathe around the vertical axis).
- Three.js scene with OrbitControls, soft lighting, ground grid, visible edges (EdgesGeometry) over a semi-transparent shaded body, axes helper, and buttons: **Wireframe**, **Reset view**, **Front / Top / Side** camera snaps (these should line up with the 2D views).
- Nice-to-have animations: "fold the views into 3D" and "unfold the surface".

## Data contract (use exactly; mock with the samples below)
```ts
type Point = [number, number];
type LineStyle = "construction" | "outline" | "hidden" | "centre" | "dimension";
type Primitive =
  | { t: "line"; a: Point; b: Point; style?: LineStyle }
  | { t: "circle"; c: Point; r: number; style?: LineStyle }
  | { t: "arc"; c: Point; r: number; from: number; to: number; style?: LineStyle }
  | { t: "text"; at: Point; text: string; size?: number };
type Step = { title: string; explanation: string; style: LineStyle; primitives: Primitive[] };
type SolidSpec =
  | { kind: "extrude"; profile: Point[]; height: number }
  | { kind: "revolve"; profile: Point[] };
type Solution = {
  title: string; problem: string;
  givens: { name: string; value: string }[];
  steps: Step[];
  solid?: SolidSpec;
};
```
API (implemented separately, mock it for now):
- `POST /api/solve` with `{ image?: string /* base64 */, mediaType?: string, text?: string }` returns `{ ok: true, solution: Solution }` or `{ ok: false, reason: string }`.
- Samples live in `lib/samples` (`SAMPLES[slug]`); the page for a sample slug reads them directly.

Mock sample to start with (line AB, 60 mm, 30° to HP, 45° to VP): front view and top view drawn with construction lines first, then the final outline. Include at least 3 steps so the animation is visible.

## Quality bar
Accessible (labels, focus rings, reduced-motion respects "no animation": jump straight to the finished step), no layout shift, works at 360 px width, drawing board never scrolls the page on touch, and all text uses plain student-friendly language.

Do not implement the solver/AI; only the UI, the SVG animation engine, the 3D viewer, and the mocked API calls.
