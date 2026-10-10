import type { Point, Primitive, Solution, Step } from "../schema";
import { ellipsePoint, round } from "./basic";
import { ISO_SCALE, isoPoint } from "./isometric";
import { edgeNormal, regularPolygon, SIDES, type RegularBase } from "./solids";

type Result = { ok: true; solution: Solution } | { ok: false; reason: string };

export type Part =
  | { kind: "prism"; base: "rectangle" | RegularBase; side: number; width?: number; height: number }
  | { kind: "cylinder"; diameter: number; height: number }
  | { kind: "cone"; diameter: number; height: number }
  | { kind: "sphere"; diameter: number }
  | { kind: "hemisphere"; diameter: number };

export type CompositeInput = { parts: Part[]; scale: "isometric" | "true" };

const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const line = (a: Point, b: Point, style?: "construction" | "outline" | "centre"): Primitive => ({ t: "line", a, b, ...(style ? { style } : {}) });
const text = (at: Point, s: string): Primitive => ({ t: "text", at, text: s });

const NEEDS_WIDTH = "A rectangular prism needs both a length and a width.";

// ---------------------------------------------------------------- 2D helpers

type Poly = Point[];
const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Convex hull, counter-clockwise, without repeated points (a closed ring ends where it starts, up to rounding). */
export function hull(pts: Point[]): Point[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower: Point[] = [], upper: Point[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of [...p].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  const ring = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  return ring.filter((q, i) => Math.hypot(q[0] - ring[(i + 1) % ring.length][0], q[1] - ring[(i + 1) % ring.length][1]) > 1e-9);
}

/**
 * The part [t0, t1] of segment a-b (as fractions of its length) that lies strictly inside the convex counter-clockwise polygon `h`, or null.
 * A negative `margin` takes the closed polygon instead, so that a segment along its boundary counts as inside.
 */
export function insideSpan(a: Point, b: Point, h: Point[], margin = 1e-6): [number, number] | null {
  const EPS = margin;
  let t0 = 0, t1 = 1;
  for (let i = 0; i < h.length; i++) {
    const p = h[i], q = h[(i + 1) % h.length];
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9) continue;
    const fa = cross(p, q, a) - EPS * Math.hypot(q[0] - p[0], q[1] - p[1]);
    const fb = cross(p, q, b) - EPS * Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (fa <= 0 && fb <= 0) return null; // wholly outside this edge's half-plane
    if (fa < 0 !== fb < 0) {
      const t = fa / (fa - fb);
      if (fa < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    }
  }
  return t0 < t1 ? [t0, t1] : null;
}

type Seg = [Point, Point];

/** The pieces of segment a-b that remain when the stretch [t0, t1] (fractions of its length) is removed. */
export function outsideSpan(a: Point, b: Point, [t0, t1]: [number, number]): Seg[] {
  const at = (t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const out: Seg[] = [];
  if (t0 > 1e-9) out.push([a, at(t0)]);
  if (t1 < 1 - 1e-9) out.push([at(t1), b]);
  return out;
}

/** The pieces of segment a-b that lie outside (the strictly inner part of) the convex polygon `h`. */
function clipOutside(a: Point, b: Point, h: Point[]): Seg[] {
  const span = insideSpan(a, b, h);
  return span ? outsideSpan(a, b, span) : [[a, b]];
}

export const segments = (lines: Poly[]): Seg[] => lines.flatMap((pl) => pl.slice(0, -1).map((p, i) => [p, pl[i + 1]] as Seg));

/** Joins consecutive segments that share an end into polylines. */
export function rejoin(segs: Seg[]): Poly[] {
  const out: Poly[] = [];
  for (const [a, b] of segs) {
    const last = out[out.length - 1];
    if (last && Math.hypot(last[last.length - 1][0] - a[0], last[last.length - 1][1] - a[1]) < 1e-6) last.push(b);
    else out.push([a, b]);
  }
  return out;
}

/** Remove the parts of polylines that fall inside any of the hulls. Open pieces are returned. */
export function clipPolylines(lines: Poly[], hulls: Point[][]): Poly[] {
  let cur = segments(lines);
  for (const h of hulls) cur = cur.flatMap(([a, b]) => clipOutside(a, b, h));
  return rejoin(cur);
}

// ---------------------------------------------------------------- one part

/** The isometric square (rhombus) of side `d` true mm that encloses a circle of diameter d, centred at paper height y on the axis. */
export const rhombusAt = (d: number, k: number, y: number): Extract<Primitive, { t: "poly" }> => {
  const side = d * k;
  return { t: "poly", closed: true, pts: [[0, y - side * S30], [side * C30, y], [0, y + side * S30], [-side * C30, y]] };
};

export type Built = { edges: Poly[]; silhouette: Point[]; construction: Extract<Primitive, { t: "poly" }>[]; top: number; name: string; detail: string };

const arc = (cx: number, cy: number, rx: number, ry: number, from: number, to: number, n = 48): Poly =>
  Array.from({ length: n + 1 }, (_, i) => ellipsePoint([cx, cy], rx, ry, 0, from + ((to - from) * i) / n));

export function buildPart(p: Part, z0: number, k: number): Built | string {
  const P = (x: number, y: number, z: number) => isoPoint(x, y, z, k);
  if (p.kind === "prism") {
    let base: Point[];
    if (p.base === "rectangle") {
      if (!p.width) return NEEDS_WIDTH;
      base = [[0, 0], [p.side, 0], [p.side, p.width], [0, p.width]];
    } else base = regularPolygon(SIDES[p.base], p.side);
    const cx = base.reduce((s, q) => s + q[0], 0) / base.length, cy = base.reduce((s, q) => s + q[1], 0) / base.length;
    base = base.map(([x, y]) => [x - cx, y - cy] as Point);
    const n = base.length, h = p.height;
    const vis = base.map((_, e) => { const nn = edgeNormal(base, e); return -nn[0] - nn[1] > 1e-9; });
    const edges: Poly[] = [];
    base.forEach((b, e) => { if (vis[e]) edges.push([P(b[0], b[1], z0), P(base[(e + 1) % n][0], base[(e + 1) % n][1], z0)]); });
    base.forEach((b, v) => { if (vis[(v + n - 1) % n] || vis[v]) edges.push([P(b[0], b[1], z0), P(b[0], b[1], z0 + h)]); });
    edges.push([...base.map((b) => P(b[0], b[1], z0 + h)), P(base[0][0], base[0][1], z0 + h)]);
    const sil = hull([...base.map((b) => P(b[0], b[1], z0)), ...base.map((b) => P(b[0], b[1], z0 + h))]);
    const name = p.base === "rectangle" ? `rectangular prism ${p.side} × ${p.width} × ${h} mm` : `${p.base} prism (side ${p.side} mm, height ${h} mm)`;
    return { edges, silhouette: sil, construction: [{ t: "poly", pts: base.map((b) => P(b[0], b[1], z0)), closed: true }], top: z0 + h, name, detail: "prism" };
  }
  const D = p.diameter, r = D / 2;
  const rx = r * Math.sqrt(1.5) * k, ry = r * Math.sqrt(0.5) * k;
  const rhombus = (z: number) => rhombusAt(D, k, z * k);
  if (p.kind === "cylinder") {
    const h = p.height, zb = z0 * k, zt = (z0 + h) * k;
    const edges: Poly[] = [arc(0, zb, rx, ry, 180, 360), arc(0, zt, rx, ry, 0, 360, 72), [[-rx, zb], [-rx, zt]], [[rx, zb], [rx, zt]]];
    const sil = hull([...arc(0, zb, rx, ry, 0, 360, 72), ...arc(0, zt, rx, ry, 0, 360, 72)]);
    return { edges, silhouette: sil, construction: [rhombus(z0)], top: z0 + h, name: `cylinder (Ø${D} mm, height ${h} mm)`, detail: "cylinder" };
  }
  if (p.kind === "cone") {
    const h = p.height, zb = z0 * k, H = h * k;
    if (H <= ry + 1e-6) return "A cone this flat cannot be drawn: its apex would fall inside the base ellipse.";
    const t0 = (Math.asin(ry / H) * 180) / Math.PI;
    const apex: Point = [0, zb + H];
    const tl = ellipsePoint([0, zb], rx, ry, 0, 180 - t0), tr = ellipsePoint([0, zb], rx, ry, 0, t0);
    const edges: Poly[] = [arc(0, zb, rx, ry, 180 - t0, 360 + t0, 60), [apex, tl], [apex, tr]];
    const sil = hull([apex, ...arc(0, zb, rx, ry, 0, 360, 72)]);
    return { edges, silhouette: sil, construction: [rhombus(z0)], top: z0 + h, name: `cone (Ø${D} mm, height ${h} mm)`, detail: "cone" };
  }
  const rs = (r * k) / ISO_SCALE;
  if (p.kind === "sphere") {
    const cz = (z0 + r) * k;
    const ring = arc(0, cz, rs, rs, 0, 360, 72);
    return { edges: [ring], silhouette: hull(ring), construction: [rhombus(z0 + r)], top: z0 + D, name: `sphere (Ø${D} mm)`, detail: "sphere" };
  }
  const zb = z0 * k;
  const dome = arc(0, zb, rs, rs, 0, 180, 60);
  return { edges: [arc(0, zb, rx, ry, 180, 360), dome], silhouette: hull([...dome, ...arc(0, zb, rx, ry, 180, 360)]), construction: [rhombus(z0)], top: z0 + r, name: `hemisphere (Ø${D} mm)`, detail: "hemisphere" };
}

/** True when every size of the part is a positive, finite number. */
export const partOk = (p: Part) => Object.values(p).every((v) => typeof v !== "number" || (v > 0 && Number.isFinite(v)));

/** Extent of a part's base in plan about its axis, [xmin, xmax, ymin, ymax] in mm, or an error message. */
export function footprint(p: Part): [number, number, number, number] | string {
  if (p.kind !== "prism") return [-p.diameter / 2, p.diameter / 2, -p.diameter / 2, p.diameter / 2];
  if (p.base === "rectangle") return p.width ? [-p.side / 2, p.side / 2, -p.width / 2, p.width / 2] : NEEDS_WIDTH;
  const q = regularPolygon(SIDES[p.base], p.side);
  return [Math.min(...q.map((v) => v[0])), Math.max(...q.map((v) => v[0])), Math.min(...q.map((v) => v[1])), Math.max(...q.map((v) => v[1]))];
}

/** A part whose axis stands at plan position `at` (mm): the drawing of buildPart moved across the paper. A sphere's guide is the square on the ground it rests in. */
export function buildPartAt(p: Part, at: Point, z0: number, k: number): Built | string {
  const b = buildPart(p, z0, k);
  if (typeof b === "string") return b;
  if (p.kind === "sphere") b.construction = [rhombusAt(p.diameter, k, z0 * k)];
  const [dx, dy] = isoPoint(at[0], at[1], 0, k);
  const mv = (q: Point): Point => [q[0] + dx, q[1] + dy];
  return { ...b, edges: b.edges.map((e) => e.map(mv)), silhouette: b.silhouette.map(mv), construction: b.construction.map((c) => ({ ...c, pts: c.pts.map(mv) })) };
}

/** Profile of (radius, height) for a stack of round parts, for the 3D viewer. */
function revolveProfile(parts: Part[]): Point[] | null {
  if (parts.some((p) => p.kind === "prism")) return null;
  const pts: Point[] = [[0, 0]];
  let z = 0;
  for (const p of parts) {
    if (p.kind === "prism") continue;
    const r = p.diameter / 2;
    if (p.kind === "cylinder") { pts.push([r, z], [r, z + p.height]); z += p.height; }
    else if (p.kind === "cone") { pts.push([r, z], [0, z + p.height]); z += p.height; }
    else if (p.kind === "hemisphere") { pts.push([r, z]); for (let m = 1; m <= 12; m++) { const a = (m * Math.PI) / 2 / 12; pts.push([r * Math.cos(a), z + r * Math.sin(a)]); } z += r; }
    else { pts.push([0.001, z]); for (let m = 1; m < 24; m++) { const a = -Math.PI / 2 + (m * Math.PI) / 24; pts.push([r * Math.cos(a), z + r + r * Math.sin(a)]); } z += 2 * r; }
  }
  if (pts[pts.length - 1][0] > 1e-6) pts.push([0, z]);
  else pts[pts.length - 1] = [0, pts[pts.length - 1][1]];
  return pts;
}

const SHORT: Record<Part["kind"], string> = { prism: "prism", cylinder: "cylinder", cone: "cone", sphere: "sphere", hemisphere: "hemisphere" };

export function solveIsometricComposite(input: CompositeInput): Result {
  const { parts } = input;
  if (parts.length < 2 || parts.length > 4) return { ok: false, reason: "A composite solid needs 2 to 4 parts stacked one above the other." };
  if (!parts.every(partOk)) return { ok: false, reason: "Every size must be a positive number." };
  const k = input.scale === "true" ? 1 : ISO_SCALE;
  for (let i = 0; i < parts.length - 1; i++) {
    if (["cone", "sphere", "hemisphere"].includes(parts[i].kind)) return { ok: false, reason: `A ${parts[i].kind} cannot carry another solid on top of it. Put it last (on top).` };
  }
  const built: Built[] = [];
  let z = 0;
  for (const p of parts) {
    const b = buildPart(p, z, k);
    if (typeof b === "string") return { ok: false, reason: b };
    built.push(b);
    z = b.top;
  }
  const total = z;
  const width = Math.max(...parts.map((p) => (p.kind === "prism" ? p.side : p.diameter)));

  const steps: Step[] = [
    {
      title: "Isometric axes and the common axis",
      explanation: `The solids stand one above the other on one vertical axis. Draw the vertical axis ${round(total)} mm high (${round(total * k)} mm on the paper) and the two 30° axes. This drawing uses ${k === 1 ? "true lengths (isometric drawing)" : "the isometric scale, 0.816 × true length (isometric projection)"}.`,
      style: "construction",
      primitives: [line([0, 0], [0, (total + 10) * k], "centre"), line([0, 0], isoPoint(width, 0, 0, k)), line([0, 0], isoPoint(0, width, 0, k)), text([2, (total + 10) * k], "common axis")],
    },
  ];
  let zBase = 0;
  built.forEach((b, i) => {
    const above = built.slice(i + 1).map((u) => u.silhouette);
    const pieces = clipPolylines(b.edges, above);
    const lower = i === 0 ? "the lowest solid" : i === built.length - 1 ? "the top solid" : "the next solid";
    steps.push({
      title: `Base of the ${SHORT[b.detail as Part["kind"]]}${i === 0 ? "" : " (on the one below)"}`,
      explanation: `Mark the height ${round(zBase)} mm on the axis (${round(zBase * k)} mm on the paper). This is where ${lower}, a ${b.name}, begins. Draw its base about the axis${b.detail === "prism" ? " with its centre on the axis" : " inside an isometric square (a rhombus) centred on the axis"}.`,
      style: "construction",
      primitives: b.construction,
    });
    steps.push({
      title: `Draw the ${SHORT[b.detail as Part["kind"]]}`,
      explanation: pieces.length === 0 ? `This ${SHORT[b.detail as Part["kind"]]} is completely hidden behind the solid above it, so nothing of it is drawn.${i < built.length - 1 ? "" : " This completes the composite solid."}` :
        (b.detail === "prism" ? "Raise the vertical edges you can see and draw the top face. " : b.detail === "cylinder" ? "Draw the front half of the base ellipse, the whole top ellipse and the two vertical tangents. " : b.detail === "cone" ? "Draw the base ellipse and two tangents from the apex. " : b.detail === "sphere" ? "Draw a circle whose radius is half the major axis of the equator ellipse. " : "Draw the front half of the flat-face ellipse and the dome as half a circle. ") +
        (i < built.length - 1 ? "Leave out any line that will be hidden behind the solid placed on top of it." : "This completes the composite solid."),
      style: "outline",
      primitives: pieces.map((pts) => ({ t: "poly" as const, pts })),
    });
    zBase = b.top;
  });

  const names = parts.map((p) => (p.kind === "prism" ? (p.base === "rectangle" ? "rectangular prism" : `${p.base} prism`) : p.kind));
  const prof = revolveProfile(parts);
  return {
    ok: true,
    solution: {
      title: `Isometric view of a ${names[names.length - 1]} on a ${names.slice(0, -1).reverse().join(" on a ")}`,
      problem: `Draw the isometric ${input.scale === "true" ? "view" : "projection"} of a solid made of, from the bottom up: ${built.map((b) => `a ${b.name}`).join(", then ")}. The axes of all the solids are in one vertical line.`,
      givens: [...built.map((b, i) => ({ name: `Part ${i + 1}`, value: b.name })), { name: "Scale", value: input.scale === "true" ? "True (1:1)" : "Isometric (0.816)" }],
      steps,
      ...(prof ? { solid: { kind: "revolve" as const, profile: prof } } : {}),
    },
  };
}
