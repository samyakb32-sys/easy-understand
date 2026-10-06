import type { Primitive, Solution } from "./schema";

export type Segment = { step: number; prim: number; start: number; dur: number };
export type Timeline = { segments: Segment[]; stepStarts: number[]; stepEnds: number[]; total: number };

const DRAW_SPEED = 60; // mm of line drawn per second
const MIN_DUR = 0.5;
const STEP_PAUSE = 0.8;

export function primitiveLength(p: Primitive): number {
  switch (p.t) {
    case "line":
      return Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]);
    case "circle":
      return 2 * Math.PI * p.r;
    case "arc":
      return p.r * (Math.abs(p.to - p.from) * Math.PI) / 180;
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
    step.primitives.forEach((p, i) => {
      const dur = p.t === "text" ? MIN_DUR : Math.min(2.5, Math.max(MIN_DUR, primitiveLength(p) / DRAW_SPEED));
      segments.push({ step: s, prim: i, start: t, dur });
      t += dur;
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
