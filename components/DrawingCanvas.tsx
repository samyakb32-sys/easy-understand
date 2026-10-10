"use client";

import { useId, useMemo } from "react";
import type { LineStyle, Point, Primitive, Solution } from "@/lib/schema";
import { ellipsePoint } from "@/lib/geometry/basic";
import { primitiveLength, type Timeline } from "@/lib/timeline";

const STROKE: Record<LineStyle, { w: number; color: string; dash?: string; opacity?: number }> = {
  construction: { w: 0.35, color: "var(--c-construction)", opacity: 0.8 },
  outline: { w: 0.9, color: "var(--c-outline)" },
  hidden: { w: 0.6, color: "var(--c-outline)", dash: "2 1.5" },
  centre: { w: 0.4, color: "var(--c-centre)", dash: "6 1.5 1 1.5" },
  dimension: { w: 0.3, color: "var(--c-dim)" },
};

const flip = (p: Point): Point => [p[0], -p[1]];
const rad = (d: number) => (d * Math.PI) / 180;

function bounds(sol: Solution) {
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

function arcPath(c: Point, r: number, from: number, to: number): string {
  const a = flip([c[0] + r * Math.cos(rad(from)), c[1] + r * Math.sin(rad(from))]);
  const b = flip([c[0] + r * Math.cos(rad(to)), c[1] + r * Math.sin(rad(to))]);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const sweep = to >= from ? 0 : 1; // y is flipped, so counter-clockwise maths = sweep 0 on screen
  return `M ${a[0]} ${a[1]} A ${r} ${r} 0 ${large} ${sweep} ${b[0]} ${b[1]}`;
}

function ellipsePath(p: Extract<Primitive, { t: "ellipse" }>): string {
  const rot = p.rot ?? 0, from = p.from ?? 0, to = p.to ?? 360;
  const at = (t: number) => flip(ellipsePoint(p.c, p.rx, p.ry, rot, t));
  const arc = (b: Point, large: number, sweep: number) => `A ${p.rx} ${p.ry} ${-rot} ${large} ${sweep} ${b[0]} ${b[1]}`;
  const a = at(from);
  // a closed ellipse starts and ends at the same point, which SVG draws as nothing: split it in two halves
  if (Math.abs(to - from) >= 359.999) return `M ${a[0]} ${a[1]} ${arc(at(from + 180), 0, 0)} ${arc(a, 0, 0)}`;
  return `M ${a[0]} ${a[1]} ${arc(at(to), Math.abs(to - from) > 180 ? 1 : 0, to >= from ? 0 : 1)}`;
}

function polyPoints(p: Extract<Primitive, { t: "poly" }>): Point[] {
  return p.closed ? [...p.pts, p.pts[0]] : p.pts;
}

/** Point at fraction p along a primitive, in screen space. Null for text. */
export function tip(prim: Primitive, p: number): Point | null {
  if (prim.t === "line") return flip([prim.a[0] + (prim.b[0] - prim.a[0]) * p, prim.a[1] + (prim.b[1] - prim.a[1]) * p]);
  // an SVG <circle> is stroked clockwise on screen from 3 o'clock, which is the negative-angle direction in y-up maths
  if (prim.t === "circle") return flip([prim.c[0] + prim.r * Math.cos(2 * Math.PI * p), prim.c[1] - prim.r * Math.sin(2 * Math.PI * p)]);
  if (prim.t === "arc") {
    const a = prim.from + (prim.to - prim.from) * p;
    return flip([prim.c[0] + prim.r * Math.cos(rad(a)), prim.c[1] + prim.r * Math.sin(rad(a))]);
  }
  if (prim.t === "ellipse") {
    const from = prim.from ?? 0, to = prim.to ?? 360;
    return flip(ellipsePoint(prim.c, prim.rx, prim.ry, prim.rot ?? 0, from + (to - from) * p));
  }
  if (prim.t === "poly") {
    const pts = polyPoints(prim);
    const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
    let want = lens.reduce((a, b) => a + b, 0) * p;
    for (let i = 0; i < lens.length; i++) {
      if (want <= lens[i] || i === lens.length - 1) {
        const f = lens[i] === 0 ? 0 : Math.min(1, want / lens[i]);
        return flip([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]);
      }
      want -= lens[i];
    }
  }
  return null;
}

export function DrawingCanvas({ solution, timeline, t, activeStep }: { solution: Solution; timeline: Timeline; t: number; activeStep: number }) {
  const vb = useMemo(() => bounds(solution), [solution]);
  // unique per canvas: the filter region below depends on this canvas's viewBox
  const glow = `glow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  let tipPoint: Point | null = null;

  const items = timeline.segments.map((seg) => {
    if (t < seg.start) return null;
    const prim = solution.steps[seg.step].primitives[seg.prim];
    const p = Math.min(1, (t - seg.start) / seg.dur);
    if (p < 1) tipPoint = tip(prim, p);
    const key = `${seg.step}-${seg.prim}`;
    if (prim.t === "text") {
      const size = prim.size ?? 4;
      const [x, y] = flip(prim.at);
      return (
        <text key={key} x={x} y={y} fontSize={size} fill="var(--c-text)" opacity={p} fontFamily="var(--font-mono)">
          {prim.text}
        </text>
      );
    }
    const style = prim.style ?? solution.steps[seg.step].style;
    const st = STROKE[style];
    // earlier steps' construction lines fade back so the finished drawing stands out
    const dim = style === "construction" && seg.step < activeStep ? 0.4 : 1;
    const common = {
      key,
      fill: "none" as const,
      stroke: st.color,
      strokeWidth: st.w,
      strokeLinecap: "round" as const,
      opacity: (st.opacity ?? 1) * dim,
    };
    // dashed styles cannot use the dash trick for drawing, so they fade in instead
    const draw = st.dash
      ? { strokeDasharray: st.dash, opacity: common.opacity * p }
      : { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p };
    if (prim.t === "line") {
      const [x1, y1] = flip(prim.a), [x2, y2] = flip(prim.b);
      return <line {...common} {...draw} x1={x1} y1={y1} x2={x2} y2={y2} />;
    }
    if (prim.t === "circle") {
      const [cx, cy] = flip(prim.c);
      return <circle {...common} {...draw} cx={cx} cy={cy} r={prim.r} transform={`rotate(0 ${cx} ${cy})`} />;
    }
    if (prim.t === "ellipse") return <path {...common} {...draw} d={ellipsePath(prim)} />;
    if (prim.t === "poly") {
      const d = polyPoints(prim).map((q, i) => { const f = flip(q); return `${i ? "L" : "M"} ${f[0]} ${f[1]}`; }).join(" ");
      return <path {...common} {...draw} d={d} />;
    }
    return <path {...common} {...draw} d={arcPath(prim.c, prim.r, prim.from, prim.to)} />;
  });

  return (
    <svg
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className="drawing-board h-full w-full"
      role="img"
      aria-label={`${solution.title}: drawing so far`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="var(--c-grid)" strokeWidth="0.15" />
        </pattern>
        {/* user-space region: with the default objectBoundingBox units Chrome draws nothing while the group is only a horizontal or vertical line (zero-height box) */}
        <filter id={glow} filterUnits="userSpaceOnUse" x={vb.x} y={vb.y} width={vb.w} height={vb.h}>
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#grid)" />
      <g filter={`url(#${glow})`}>{items}</g>
      {tipPoint && <circle cx={(tipPoint as Point)[0]} cy={(tipPoint as Point)[1]} r={1.3} fill="var(--c-accent)" filter={`url(#${glow})`} />}
    </svg>
  );
}

export { primitiveLength };
