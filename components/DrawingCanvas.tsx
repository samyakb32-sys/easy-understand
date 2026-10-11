"use client";

import { useId, useMemo } from "react";
import type React from "react";
import type { Point, Primitive, Solution } from "@/lib/schema";
import { ellipsePoint } from "@/lib/geometry/basic";
import { STROKE, arcPath, bounds, ellipsePath, flip, polyPoints, rad } from "@/lib/drawing";
import { primitiveLength, type Timeline } from "@/lib/timeline";

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

/**
 * `highlightStep` is drawn in the "current" colour so the student sees which lines this step adds
 * (defaults to the active step; pass -1 once the lesson is finished).
 */
export function DrawingCanvas({ solution, timeline, t, activeStep, highlightStep = activeStep }: { solution: Solution; timeline: Timeline; t: number; activeStep: number; highlightStep?: number }) {
  const vb = useMemo(() => bounds(solution), [solution]);
  // unique per canvas: the filter region below depends on this canvas's viewBox
  const glow = `glow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  let tipPoint: Point | null = null;

  const lit: React.ReactNode[] = [];
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
    const hot = seg.step === highlightStep && style !== "construction";
    const common = {
      key,
      fill: "none" as const,
      stroke: hot ? "var(--c-accent)" : st.color,
      strokeWidth: st.w,
      strokeLinecap: "round" as const,
      opacity: (st.opacity ?? 1) * dim,
    };
    // dashed styles cannot use the dash trick for drawing, so they fade in instead
    const draw = st.dash
      ? { strokeDasharray: st.dash, opacity: common.opacity * p }
      : { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - p };
    let el: React.ReactElement;
    if (prim.t === "line") {
      const [x1, y1] = flip(prim.a), [x2, y2] = flip(prim.b);
      el = <line {...common} {...draw} x1={x1} y1={y1} x2={x2} y2={y2} />;
    } else if (prim.t === "circle") {
      const [cx, cy] = flip(prim.c);
      el = <circle {...common} {...draw} cx={cx} cy={cy} r={prim.r} transform={`rotate(0 ${cx} ${cy})`} />;
    } else if (prim.t === "ellipse") el = <path {...common} {...draw} d={ellipsePath(prim)} />;
    else if (prim.t === "poly") {
      const d = polyPoints(prim).map((q, i) => { const f = flip(q); return `${i ? "L" : "M"} ${f[0]} ${f[1]}`; }).join(" ");
      el = <path {...common} {...draw} d={d} />;
    } else el = <path {...common} {...draw} d={arcPath(prim.c, prim.r, prim.from, prim.to)} />;
    // the step being taught gets a soft glow; everything else stays crisp on the light sheet
    if (hot) { lit.push(el); return null; }
    return el;
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
          <feGaussianBlur stdDeviation="0.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="url(#grid)" />
      <g>{items}</g>
      <g filter={`url(#${glow})`}>{lit}</g>
      {tipPoint && <circle cx={(tipPoint as Point)[0]} cy={(tipPoint as Point)[1]} r={1.3} fill="var(--c-accent)" filter={`url(#${glow})`} />}
    </svg>
  );
}

export { primitiveLength };
