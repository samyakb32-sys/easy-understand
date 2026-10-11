import type { LineStyle, Point, Primitive, Solution } from "./schema";
import { ellipsePoint } from "./geometry/basic";

/** Shared by the animated DrawingCanvas and the static lesson thumbnails. */
export const STROKE: Record<LineStyle, { w: number; color: string; dash?: string; opacity?: number }> = {
  construction: { w: 0.3, color: "var(--c-construction)", opacity: 0.9 },
  outline: { w: 0.9, color: "var(--c-outline)" },
  hidden: { w: 0.6, color: "var(--c-hidden)", dash: "2 1.5" },
  centre: { w: 0.4, color: "var(--c-centre)", dash: "6 1.5 1 1.5" },
  dimension: { w: 0.3, color: "var(--c-dim)" },
};

export const flip = (p: Point): Point => [p[0], -p[1]];
export const rad = (d: number) => (d * Math.PI) / 180;

export function bounds(sol: Solution) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x: number, y: number) => {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  };
  for (const s of sol.steps)
    for (const p of s.primitives) {
      if (p.t === "line") { add(p.a[0], -p.a[1]); add(p.b[0], -p.b[1]); }
      else if (p.t === "circle" || p.t === "arc") { add(p.c[0] - p.r, -p.c[1] - p.r); add(p.c[0] + p.r, -p.c[1] + p.r); }
      else if (p.t === "ellipse") { const m = Math.max(p.rx, p.ry); add(p.c[0] - m, -p.c[1] - m); add(p.c[0] + m, -p.c[1] + m); }
      else if (p.t === "poly") for (const q of p.pts) add(q[0], -q[1]);
      else { add(p.at[0], -p.at[1]); add(p.at[0] + p.text.length * 2.4, -p.at[1] - 4); }
    }
  const pad = 12;
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
}

export function arcPath(c: Point, r: number, from: number, to: number): string {
  const a = flip([c[0] + r * Math.cos(rad(from)), c[1] + r * Math.sin(rad(from))]);
  const b = flip([c[0] + r * Math.cos(rad(to)), c[1] + r * Math.sin(rad(to))]);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const sweep = to >= from ? 0 : 1; // y is flipped, so counter-clockwise maths = sweep 0 on screen
  return `M ${a[0]} ${a[1]} A ${r} ${r} 0 ${large} ${sweep} ${b[0]} ${b[1]}`;
}

export function ellipsePath(p: Extract<Primitive, { t: "ellipse" }>): string {
  const rot = p.rot ?? 0, from = p.from ?? 0, to = p.to ?? 360;
  const at = (t: number) => flip(ellipsePoint(p.c, p.rx, p.ry, rot, t));
  const arc = (b: Point, large: number, sweep: number) => `A ${p.rx} ${p.ry} ${-rot} ${large} ${sweep} ${b[0]} ${b[1]}`;
  const a = at(from);
  // a closed ellipse starts and ends at the same point, which SVG draws as nothing: split it in two halves
  if (Math.abs(to - from) >= 359.999) return `M ${a[0]} ${a[1]} ${arc(at(from + 180), 0, 0)} ${arc(a, 0, 0)}`;
  return `M ${a[0]} ${a[1]} ${arc(at(to), Math.abs(to - from) > 180 ? 1 : 0, to >= from ? 0 : 1)}`;
}

export function polyPoints(p: Extract<Primitive, { t: "poly" }>): Point[] {
  return p.closed ? [...p.pts, p.pts[0]] : p.pts;
}

