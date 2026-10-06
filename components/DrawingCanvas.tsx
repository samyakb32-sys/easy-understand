"use client";

import { useMemo } from "react";
import type { LineStyle, Point, Primitive, Solution } from "@/lib/schema";
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

/** Point at fraction p along a primitive, in screen space. Null for text. */
function tip(prim: Primitive, p: number): Point | null {
  if (prim.t === "line") return flip([prim.a[0] + (prim.b[0] - prim.a[0]) * p, prim.a[1] + (prim.b[1] - prim.a[1]) * p]);
  if (prim.t === "circle") return flip([prim.c[0] + prim.r * Math.cos(2 * Math.PI * p), prim.c[1] + prim.r * Math.sin(2 * Math.PI * p)]);
  if (prim.t === "arc") {
    const a = prim.from + (prim.to - prim.from) * p;
    return flip([prim.c[0] + prim.r * Math.cos(rad(a)), prim.c[1] + prim.r * Math.sin(rad(a))]);
  }
  return null;
}

export function DrawingCanvas({ solution, timeline, t, activeStep }: { solution: Solution; timeline: Timeline; t: number; activeStep: number }) {
  const vb = useMemo(() => bounds(solution), [solution]);
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
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#grid)" />
      <g filter="url(#glow)">{items}</g>
      {tipPoint && <circle cx={(tipPoint as Point)[0]} cy={(tipPoint as Point)[1]} r={1.3} fill="var(--c-accent)" filter="url(#glow)" />}
    </svg>
  );
}

export { primitiveLength };
