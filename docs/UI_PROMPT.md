# UI generation prompt (paste into Lovable / v0 / Bolt / Claude artifact)

Build the front end for **EasyUnderstand**, a website where engineering students upload an Engineering Graphics & Design (EGD) problem, get the solution, and watch it drawn step by step like a professor teaching, then view the result in 3D.

Tech: Next.js (App Router) + TypeScript + Tailwind, `three` + `@react-three/fiber` + `@react-three/drei` (+ `framer-motion`, `@react-three/postprocessing`) for 3D and motion. Mobile-first and responsive.

## Design direction: a 3D, premium, "I want this now" experience
The whole site should feel like a 3D drafting studio, not a flat web page. A student should think "this is the app that finally makes EGD click" within 5 seconds, and want to buy it.
- **Look:** dark, deep navy/near-black "blueprint void" with luminous cyan/electric-blue linework, one warm accent (amber) for calls to action. Glassmorphism panels with soft glow, subtle grain, crisp technical type (e.g. Space Grotesk / Inter for UI, JetBrains Mono for labels and dimensions). Light theme is optional; dark is the hero look.
- **Hero is a live 3D scene (full-screen WebGL):** a glowing wireframe solid (cube / prism / cylinder) floats over a faint 3D drafting grid. On load, 2D orthographic views (front, top, side) draw themselves as neon lines on floating planes, then **fold and unfold into the 3D solid**, and the loop repeats. Mouse/touch parallax tilts the scene; scrolling moves the camera through the scene (scroll-driven storytelling with `ScrollControls` or GSAP ScrollTrigger). Add bloom (soft glow on lines), a pencil/compass tip that "draws" in 3D, and floating dimension labels.
- **Landing story (scroll sections, each with a 3D moment):**
  1. Hero: "Upload your EGD problem. Watch it solved, line by line, then turn it in 3D." Primary CTA "Solve my problem free" (amber, glowing) and secondary "Watch a demo".
  2. "Snap it": a phone mockup in 3D scans a drawing; lines detected light up.
  3. "Learn it": a professor-style step-by-step drawing plays live (a real, interactive mini player using the sample data, not a video).
  4. "See it": the 2D views fold into a rotatable 3D model the visitor can drag.
  5. Social proof: marks/grades improved stats, student testimonials (placeholder content, clearly marked), "Works for Orthographic projection, Isometric, Constructions, Sections, Development of surfaces".
  6. Pricing section (see Monetisation below), FAQ, final CTA.
- **Motion:** smooth 60 fps, spring physics, magnetic buttons, tilt-on-hover cards, micro-interactions on every control. Respect `prefers-reduced-motion` (static poster, no auto-animation). Lazy-load the 3D, show a lovely skeleton, cap DPR at 2, and fall back to a static image/2D if WebGL is unavailable. Lighthouse performance should stay reasonable on a mid-range phone.
- **Everything interactive in the app is 3D-first:** the Solution page's drawing board is a 3D "desk" where the 2D sheet lies on a tilted drafting board with a floating pencil and compass; a toggle flips to the full 3D solid view; step changes animate the camera smoothly.

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

## Monetisation (UI only now; payment will be integrated later)
Do NOT implement real payments, Stripe, or auth providers. Build the UI and structure so they can be added without redesign:
- **Free vs Pro** model. Free: 3 solves/day, 2D step animation only, watermark on exports. Pro: unlimited solves, 3D model + unfold/section animations, save history, export drawing as PDF/PNG/GLB, read-aloud, priority solving.
- Pricing section with 3 cards (Monthly, Yearly with "Best value, save 40%" badge highlighted and slightly 3D-tilted, "Exam pack" one-time) using placeholder prices clearly in one config file `lib/pricing.ts`.
- Locked-feature moments: after a free solve, the 3D tab shows a **blurred, still-rotating 3D preview** with an "Unlock 3D with Pro" overlay; the export buttons show a lock icon. Every lock opens one `<UpgradeModal />` (benefits list, plan toggle, "Continue" button that currently just calls `startCheckout(planId)`).
- Put all gating behind a single hook `useEntitlements()` that returns `{ plan: "free" | "pro", canUse3D, solvesLeftToday, ... }` reading from a mock provider now (a dev toggle in the footer switches plan), so a real backend can replace it later.
- Stubs to leave for later: `startCheckout(planId)` (no-op that shows a "Payments coming soon" toast), `/login` and `/account` placeholder pages, a "Manage subscription" button, and a pricing-page analytics hook point. Add trust elements: "Cancel anytime", "Student discount" note, and a money-back line (placeholder text).
- Conversion polish: sticky "Try free" bar after the hero, exit-intent soft nudge on desktop (non-intrusive, dismissible, once per session), and a live "students solved N problems today" counter (mocked).

## Quality bar
Accessible (labels, focus rings, reduced-motion respects "no animation": jump straight to the finished step), no layout shift, works at 360 px width, drawing board never scrolls the page on touch, and all text uses plain student-friendly language.

Do not implement the solver/AI; only the UI, the SVG animation engine, the 3D viewer, and the mocked API calls.
