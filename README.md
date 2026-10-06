# EasyUnderstand 製図

Upload an Engineering Graphics & Design (EGD) problem, watch it drawn step by step like a professor teaching, then explore the solid in 3D.

## Run

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY to enable photo upload solving
npm run dev                  # http://localhost:3000
npm test                     # geometry + schema tests
```

The example lessons (`/solve/line-projection`, `pentagon`, `cylinder-development`, `prism-views`, `isometric-prism`, `isometric-cylinder`, `section-pyramid`, `section-prism`, `section-cylinder`) work without any API key.

## How it works

1. `/api/solve` sends the photo or text to Claude, which only **classifies** the problem and reads the numbers.
2. `lib/geometry/solvers.ts` **calculates** the drawing as a `Solution` (steps, line coordinates, optional 3D solid). Impossible inputs are rejected, not guessed.
3. `components/StepPlayer.tsx` animates the steps; `components/Solid3DViewer.tsx` shows the 3D model.

Adding a new problem type = add a template in `solvers.ts` and describe it in the prompt in `app/api/solve/route.ts`.

## Not done yet

Payments (`lib/pricing.ts` is placeholders only), accounts and history, the OpenCV/OCR pre-processing step, and some problem types (sections where the plane leaves through the base of a cone or cylinder, i.e. parabola/hyperbola; planes inclined to the VP; isometric of cones, spheres and composite solids).
