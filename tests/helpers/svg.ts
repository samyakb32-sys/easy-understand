import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Point, Primitive, Solution } from "@/lib/schema";

/**
 * Dev helper: draw every step of a Solution, stacked, as one SVG (y flipped), so a drawing can be looked at
 * without starting the app. Used by tests when RENDER_DIR is set; scripts/svg2png.mjs turns the files into PNGs.
 */
const DASH: Record<string, string> = { hidden: "4 3", centre: "10 3 2 3", construction: "" };
const STROKE: Record<string, [string, number]> = {
  outline: ["#ffffff", 0.7], construction: ["#4aa3ff", 0.25], hidden: ["#ffffff", 0.35], centre: ["#ffb347", 0.3], dimension: ["#8fe3c0", 0.25],
};

function arcPts(c: Point, rx: number, ry: number, rot: number, from: number, to: number): Point[] {
  const n = Math.max(8, Math.ceil(Math.abs(to - from) / 4));
  const r = (rot * Math.PI) / 180;
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    const x = rx * Math.cos(a), y = ry * Math.sin(a);
    return [c[0] + x * Math.cos(r) - y * Math.sin(r), c[1] + x * Math.sin(r) + y * Math.cos(r)] as Point;
  });
}

export function solutionToSvg(sol: Solution, upToStep = sol.steps.length - 1): string {
  const items: { p: Primitive; style: string }[] = [];
  sol.steps.slice(0, upToStep + 1).forEach((st) => st.primitives.forEach((p) => items.push({ p, style: ("style" in p && p.style) || st.style })));
  const pts: Point[] = [];
  const out: string[] = [];
  const poly = (ps: Point[], style: string, closed = false) => {
    ps.forEach((q) => pts.push(q));
    const [col, w] = STROKE[style] ?? STROKE.outline;
    out.push(`<path d="M${ps.map((q) => `${q[0].toFixed(2)} ${(-q[1]).toFixed(2)}`).join("L")}${closed ? "Z" : ""}" fill="none" stroke="${col}" stroke-width="${w}" stroke-dasharray="${DASH[style] ?? ""}" stroke-linecap="round" stroke-linejoin="round"/>`);
  };
  for (const { p, style } of items) {
    if (p.t === "line") poly([p.a, p.b], style);
    else if (p.t === "poly") poly(p.pts, style, p.closed);
    else if (p.t === "circle") poly(arcPts(p.c, p.r, p.r, 0, 0, 360), style, true);
    else if (p.t === "arc") poly(arcPts(p.c, p.r, p.r, 0, p.from, p.to), style);
    else if (p.t === "ellipse") poly(arcPts(p.c, p.rx, p.ry, p.rot ?? 0, p.from ?? 0, p.to ?? 360), style, p.from === undefined);
    else { pts.push(p.at); out.push(`<text x="${p.at[0]}" y="${-p.at[1]}" font-size="${p.size ?? 3.2}" fill="#9fd0ff" font-family="monospace">${p.text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`); }
  }
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => -q[1]);
  const x0 = Math.min(...xs) - 12, x1 = Math.max(...xs) + 12, y0 = Math.min(...ys) - 12, y1 = Math.max(...ys) + 12;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" width="${Math.round((x1 - x0) * 5)}" height="${Math.round((y1 - y0) * 5)}"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="#07121f"/>${out.join("")}</svg>`;
}

/** Writes <RENDER_DIR>/<name>.svg when the RENDER_DIR environment variable is set; does nothing otherwise. */
export function renderIfAsked(name: string, sol: Solution, upToStep?: number) {
  const dir = process.env.RENDER_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.svg`), solutionToSvg(sol, upToStep));
}
