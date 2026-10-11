import type { Primitive, Solution } from "@/lib/schema";
import { STROKE, arcPath, bounds, ellipsePath, flip, polyPoints } from "@/lib/drawing";

function shape(p: Exclude<Primitive, { t: "text" }>, props: Record<string, unknown>, key: string) {
  if (p.t === "line") { const [x1, y1] = flip(p.a), [x2, y2] = flip(p.b); return <line key={key} {...props} x1={x1} y1={y1} x2={x2} y2={y2} />; }
  if (p.t === "circle") { const [cx, cy] = flip(p.c); return <circle key={key} {...props} cx={cx} cy={cy} r={p.r} />; }
  if (p.t === "ellipse") return <path key={key} {...props} d={ellipsePath(p)} />;
  if (p.t === "poly") return <path key={key} {...props} d={polyPoints(p).map((q, i) => { const f = flip(q); return `${i ? "L" : "M"} ${f[0]} ${f[1]}`; }).join(" ")} />;
  return <path key={key} {...props} d={arcPath(p.c, p.r, p.from, p.to)} />;
}

/** The finished drawing as plain SVG (server-rendered, no animation): used for lesson thumbnails. Labels are left out. */
export function StaticDrawing({ solution }: { solution: Solution }) {
  const vb = bounds(solution);
  const last = solution.steps.length - 1;
  return (
    <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {solution.steps.flatMap((s, si) =>
        s.primitives.map((p, pi) => {
          if (p.t === "text") return null;
          const style = p.style ?? s.style;
          const st = STROKE[style];
          // thumbnails are small: thicker strokes, and the last step in the "current" colour like the hero card
          const props = {
            fill: "none", strokeLinecap: "round", stroke: si === last && style !== "construction" ? "var(--c-accent)" : st.color,
            strokeWidth: style === "construction" ? 0.6 : style === "outline" ? 1.6 : 1, strokeDasharray: st.dash,
            opacity: style === "construction" ? 0.45 : 1, vectorEffect: "non-scaling-stroke",
          };
          return shape(p, props, `${si}-${pi}`);
        }),
      )}
    </svg>
  );
}
