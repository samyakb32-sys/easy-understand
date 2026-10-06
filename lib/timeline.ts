import type { Primitive, Solution } from "./schema";
import { ellipsePerimeter } from "./geometry/basic";

export type Segment = { step: number; prim: number; start: number; dur: number };
export type Timeline = { segments: Segment[]; stepStarts: number[]; stepEnds: number[]; total: number };

const DRAW_SPEED = 60; // mm of line drawn per second
const MIN_DUR = 0.3;
const TEXT_DUR = 0.2;
const STEP_MAX = 7; // seconds: a step with many marks is sped up rather than made tedious
const STEP_PAUSE = 0.8;

const prim_frac = (from?: number, to?: number) => (from == null || to == null ? 1 : Math.min(1, Math.abs(to - from) / 360));

export function primitiveLength(p: Primitive): number {
  switch (p.t) {
    case "line":
      return Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]);
    case "circle":
      return 2 * Math.PI * p.r;
    case "arc":
      return p.r * (Math.abs(p.to - p.from) * Math.PI) / 180;
    case "ellipse": {
      const frac = prim_frac(p.from, p.to);
      return ellipsePerimeter(p.rx, p.ry) * frac;
    }
    case "poly": {
      let len = 0;
      const pts = p.closed ? [...p.pts, p.pts[0]] : p.pts;
      for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      return len;
    }
    case "text":
      return 0;
  }
}

/** Lays every primitive on one timeline so playback is a pure function of time. */
export function buildTimeline(sol: Solution): Timeline {
  const segments: Segment[] = [];
  const stepStarts: number[] = [];
  const stepEnds: number[] = [];
  let t = 0;
  sol.steps.forEach((step, s) => {
    stepStarts.push(t);
    const durs = step.primitives.map((p) => (p.t === "text" ? TEXT_DUR : Math.min(2.5, Math.max(MIN_DUR, primitiveLength(p) / DRAW_SPEED))));
    const sum = durs.reduce((a, b) => a + b, 0);
    const k = sum > STEP_MAX ? STEP_MAX / sum : 1;
    step.primitives.forEach((_p, i) => {
      segments.push({ step: s, prim: i, start: t, dur: durs[i] * k });
      t += durs[i] * k;
    });
    stepEnds.push(t);
    t += STEP_PAUSE;
  });
  return { segments, stepStarts, stepEnds, total: t };
}

/** Index of the step being shown at time t. */
export function stepAt(tl: Timeline, t: number): number {
  let idx = 0;
  tl.stepStarts.forEach((s, i) => {
    if (t >= s) idx = i;
  });
  return idx;
}
