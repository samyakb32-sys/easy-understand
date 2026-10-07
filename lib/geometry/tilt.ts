import type { Point, Primitive, Solution, Step } from "../schema";
import { round } from "./basic";
import { SIDES, type RegularBase, type Vec3 } from "./solids";

/**
 * Projection of a solid whose axis is inclined to the HP, or of a plane figure whose surface is inclined to the HP.
 * Standard two-stage method: draw the views in the simple position, tilt the front view, project the new top view.
 *
 * 3D frame: x right, y = distance in front of the VP (the viewer of the front view is at +y), z up.
 * Front view = (x, z) above XY; top view = (x, -y) below XY.
 */
type Result = { ok: true; solution: Solution } | { ok: false; reason: string };

const rad = (d: number) => (d * Math.PI) / 180;
const line = (a: Point, b: Point, style?: "construction" | "outline" | "hidden" | "centre"): Primitive => ({ t: "line", a, b, ...(style ? { style } : {}) });
const text = (at: Point, s: string): Primitive => ({ t: "text", at, text: s });
const GAP = 18; // clear space between XY and the top view

type Face = number[];
type Poly3 = { kind: "poly"; verts: Vec3[]; faces: Face[]; apex?: number };
type Cone3 = { kind: "cone"; r: number; h: number; centre: Vec3 };
type Plane3 = { kind: "plane"; ring: Vec3[]; corners: Vec3[] };
type Shape = Poly3 | Cone3 | Plane3;

/** Rotate about the horizontal axis through `piv` that is perpendicular to the VP. Positive turns +z towards +x. */
function rot(p: Vec3, piv: Vec3, a: number): Vec3 {
  const dx = p[0] - piv[0], dz = p[2] - piv[2];
  return [piv[0] + dx * Math.cos(a) + dz * Math.sin(a), p[1], piv[2] - dx * Math.sin(a) + dz * Math.cos(a)];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mean = (ps: Vec3[]): Vec3 => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length) as Vec3;

/** Outward unit-ish normal of a face of a convex solid. */
function outward(verts: Vec3[], f: Face, inside: Vec3): Vec3 {
  let n: Vec3 = [0, 0, 0];
  for (let i = 1; i < f.length - 1; i++) {
    const c = cross(sub(verts[f[i]], verts[f[0]]), sub(verts[f[i + 1]], verts[f[0]]));
    n = [n[0] + c[0], n[1] + c[1], n[2] + c[2]];
  }
  const m = Math.hypot(...n) || 1;
  n = [n[0] / m, n[1] / m, n[2] / m];
  return dot(n, sub(mean(f.map((i) => verts[i])), inside)) < 0 ? [-n[0], -n[1], -n[2]] : n;
}

/** Base ring angles (deg): a corner on the right, or a whole edge on the right. */
const ringAngles = (n: number, rest: "corner" | "edge") => Array.from({ length: n }, (_, k) => (rest === "edge" ? -180 / n : 0) + (360 * k) / n);

type Spec =
  | { solid: "prism" | "pyramid"; n: number; side: number; height: number; rest: "corner" | "edge" }
  | { solid: "cone"; r: number; height: number }
  | { solid: "plane"; n: number | "circle"; size: number; rest: "corner" | "edge" };

type Built = { shape: Shape; /** 3D vertex that touches the HP and stays put */ pivot: Vec3; /** a for the rotation, radians */ minX: number; maxX: number; depthMax: number };

function build(spec: Spec): Built {
  if (spec.solid === "cone") {
    const { r, height } = spec;
    const centre: Vec3 = [r, GAP + r, 0];
    return { shape: { kind: "cone", r, h: height, centre }, pivot: [2 * r, GAP + r, 0], minX: 0, maxX: 2 * r, depthMax: GAP + 2 * r };
  }
  if (spec.solid === "plane" && spec.n === "circle") {
    const r = spec.size / 2;
    const ring: Vec3[] = Array.from({ length: 72 }, (_, k) => [r + r * Math.cos(rad(5 * k)), GAP + r + r * Math.sin(rad(5 * k)), 0]);
    const corners: Vec3[] = [0, 90, 180, 270].map((a) => [r + r * Math.cos(rad(a)), GAP + r + r * Math.sin(rad(a)), 0] as Vec3);
    return { shape: { kind: "plane", ring, corners }, pivot: [2 * r, GAP + r, 0], minX: 0, maxX: 2 * r, depthMax: GAP + 2 * r };
  }
  const n = spec.n as number;
  const size = spec.solid === "plane" ? spec.size : spec.side;
  const R = size / (2 * Math.sin(Math.PI / n));
  const angs = ringAngles(n, spec.rest);
  const offX = -Math.min(...angs.map((a) => R * Math.cos(rad(a))));
  const base: Vec3[] = angs.map((a) => [offX + R * Math.cos(rad(a)), GAP + R + R * Math.sin(rad(a)), 0]);
  const maxX = Math.max(...base.map((p) => p[0]));
  const pivot = base.reduce((best, p) => (p[0] > best[0] + 1e-9 ? p : best), base[0]);
  const depthMax = GAP + 2 * R;
  if (spec.solid === "plane") return { shape: { kind: "plane", ring: base, corners: base }, pivot, minX: 0, maxX, depthMax };
  const cen: Vec3 = [offX, GAP + R, 0];
  const ring = Array.from({ length: n }, (_, i) => i);
  if (spec.solid === "prism") {
    const verts = [...base, ...base.map((p) => [p[0], p[1], spec.height] as Vec3)];
    const faces: Face[] = [ring, ring.map((i) => n + i), ...ring.map((i) => [i, (i + 1) % n, n + ((i + 1) % n), n + i])];
    return { shape: { kind: "poly", verts, faces }, pivot, minX: 0, maxX, depthMax };
  }
  const verts = [...base, [cen[0], cen[1], spec.height] as Vec3];
  const faces: Face[] = [ring, ...ring.map((i) => [i, (i + 1) % n, n])];
  return { shape: { kind: "poly", verts, faces, apex: n }, pivot, minX: 0, maxX, depthMax };
}

type Views = { fv: Primitive[]; tv: Primitive[]; /** 3D points after rotation, with an optional construction role */ keys: Vec3[] };

/** Visible/hidden runs of a closed sampled curve. */
function runs(pts: Point[], vis: boolean[]): Primitive[] {
  const out: Primitive[] = [];
  const n = pts.length;
  let cur: Point[] = [pts[0]];
  let curVis = vis[0];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const segVis = vis[i] && vis[j];
    if (segVis !== curVis && cur.length > 1) {
      out.push({ t: "poly", pts: cur, style: curVis ? "outline" : "hidden" });
      cur = [pts[i]];
    }
    curVis = segVis;
    cur.push(pts[j]);
  }
  if (cur.length > 1) out.push({ t: "poly", pts: cur, style: curVis ? "outline" : "hidden" });
  return out;
}

/** Front and top view of a shape after turning it through `a` about `pivot`, shifted by dx in x. */
function views(b: Built, a: number, dx: number): Views {
  const p = (v: Vec3): Vec3 => {
    const q = a === 0 ? v : rot(v, b.pivot, a);
    return [q[0] + dx, q[1], q[2]];
  };
  const fvP = (v: Vec3): Point => [v[0], v[2]];
  const tvP = (v: Vec3): Point => [v[0], -v[1]];
  const fv: Primitive[] = [];
  const tv: Primitive[] = [];
  const s = b.shape;

  if (s.kind === "poly") {
    const verts = s.verts.map(p);
    const inside = mean(verts);
    const normals = s.faces.map((f) => outward(verts, f, inside));
    const edges = new Map<string, { a: number; b: number; faces: number[] }>();
    s.faces.forEach((f, fi) =>
      f.forEach((v, k) => {
        const w = f[(k + 1) % f.length];
        const key = v < w ? `${v}-${w}` : `${w}-${v}`;
        const e = edges.get(key) ?? { a: v, b: w, faces: [] };
        e.faces.push(fi);
        edges.set(key, e);
      }),
    );
    for (const e of edges.values()) {
      const visF = e.faces.some((fi) => normals[fi][1] > 1e-9);
      const visT = e.faces.some((fi) => normals[fi][2] > 1e-9);
      const f1 = fvP(verts[e.a]), f2 = fvP(verts[e.b]);
      const t1 = tvP(verts[e.a]), t2 = tvP(verts[e.b]);
      if (Math.hypot(f1[0] - f2[0], f1[1] - f2[1]) > 1e-6) fv.push({ t: "line", a: f1, b: f2, style: visF ? "outline" : "hidden" });
      if (Math.hypot(t1[0] - t2[0], t1[1] - t2[1]) > 1e-6) tv.push({ t: "line", a: t1, b: t2, style: visT ? "outline" : "hidden" });
    }
    return { fv, tv, keys: verts };
  }

  if (s.kind === "plane") {
    const ring = s.ring.map(p);
    const xs = ring.map((v) => v[0]);
    const zs = ring.map((v) => v[2]);
    const iMin = xs.indexOf(Math.min(...xs)), iMax = xs.indexOf(Math.max(...xs));
    fv.push(line([xs[iMin], zs[iMin]], [xs[iMax], zs[iMax]], "outline"));
    tv.push({ t: "poly", pts: ring.map(tvP), closed: true, style: "outline" });
    return { fv, tv, keys: s.corners.map(p) };
  }

  // cone: apex at the end of the axis, base circle sampled
  const N = 72;
  const sa = Math.sin(a), ca = Math.cos(a);
  const apex = p([s.centre[0], s.centre[1], s.h]);
  const centre = p(s.centre);
  const rim = Array.from({ length: N }, (_, k) => {
    const t = (2 * Math.PI * k) / N;
    return p([s.centre[0] + s.r * Math.cos(t), s.centre[1] + s.r * Math.sin(t), 0]);
  });
  // front view: base is edge-on (a line), the cone is a triangle
  const e0 = rim[0], e1 = rim[N / 2];
  fv.push(line(fvP(e0), fvP(e1), "outline"), line(fvP(apex), fvP(e0), "outline"), line(fvP(apex), fvP(e1), "outline"), line(fvP(apex), fvP(centre), "centre"));
  // top view: base is an ellipse; part of the rim is hidden behind the curved surface
  const vis = rim.map((_, k) => {
    const t = (2 * Math.PI * k) / N;
    const nz = -s.h * sa * Math.cos(t) + s.r * ca; // z-component of the outward normal of the curved surface
    return nz > 1e-9 || ca < -1e-9; // base faces up only if it was flipped over, which does not occur here
  });
  tv.push(...runs(rim.map(tvP), vis));
  const T = tvP(apex), C = tvP(centre);
  const base0 = Math.atan2(C[1] - T[1], C[0] - T[0]);
  const diffs = rim.map((v) => {
    const q = tvP(v);
    let d = Math.atan2(q[1] - T[1], q[0] - T[0]) - base0;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  });
  const outside = diffs.every((d) => Math.abs(d) < Math.PI / 2 - 1e-6);
  if (outside) {
    const hi = rim[diffs.indexOf(Math.max(...diffs))], lo = rim[diffs.indexOf(Math.min(...diffs))];
    tv.push(line(T, tvP(hi), "outline"), line(T, tvP(lo), "outline"));
  } else {
    tv.push(line(T, tvP(rim[N / 4]), "outline"), line(T, tvP(rim[(3 * N) / 4]), "outline"));
  }
  tv.push(line(T, C, "centre"));
  return { fv, tv, keys: [apex, rim[0], rim[N / 4], rim[N / 2], rim[(3 * N) / 4]] };
}

const POLY_NAME = (n: number) => ({ 3: "triangle", 4: "square", 5: "pentagon", 6: "hexagon" })[n] ?? `${n}-gon`;

export type TiltInput =
  | { solid: "prism" | "pyramid"; base: RegularBase; side: number; height: number; angle: number; rest: "corner" | "edge" }
  | { solid: "cone"; diameter: number; height: number; angle: number }
  | { shape: RegularBase | "circle"; size: number; angle: number; rest: "corner" | "edge" };

export function solveTilted(input: TiltInput): Result {
  const isPlane = "shape" in input;
  const theta = input.angle;
  if (!(theta > 0 && theta < 90)) return { ok: false, reason: "The inclination must be between 0° and 90°." };

  let spec: Spec;
  let title: string, problem: string, givens: { name: string; value: string }[];
  let solid: Solution["solid"];
  if (isPlane) {
    const n = input.shape === "circle" ? "circle" : SIDES[input.shape];
    spec = { solid: "plane", n, size: input.size, rest: input.rest };
    const name = input.shape === "circle" ? "circle" : input.shape;
    title = `Projection of a ${name} lamina`;
    problem = input.shape === "circle"
      ? `A circular lamina of diameter ${input.size} mm rests on the HP on a point of its circumference, with its surface inclined at ${theta}° to the HP. Draw its projections.`
      : `A ${name} lamina of side ${input.size} mm rests on the HP on ${input.rest === "edge" ? "one side" : "one corner"}, with its surface inclined at ${theta}° to the HP. Draw its projections.`;
    givens = [{ name: input.shape === "circle" ? "Diameter" : "Side", value: `${input.size} mm` }, { name: "Surface inclined to HP", value: `${theta}°` }];
  } else if (input.solid === "cone") {
    spec = { solid: "cone", r: input.diameter / 2, height: input.height };
    title = "Cone with its axis inclined to the HP";
    problem = `A cone of base diameter ${input.diameter} mm and axis ${input.height} mm rests on a point of its base circle on the HP, with its axis inclined at ${theta}° to the HP. Draw its projections.`;
    givens = [{ name: "Base diameter", value: `${input.diameter} mm` }, { name: "Axis", value: `${input.height} mm` }, { name: "Axis inclined to HP", value: `${theta}°` }];
  } else {
    const n = SIDES[input.base];
    spec = { solid: input.solid, n, side: input.side, height: input.height, rest: input.rest };
    const nm = `${POLY_NAME(n)} ${input.solid}`;
    title = `${nm[0].toUpperCase()}${nm.slice(1)} with its axis inclined to the HP`;
    problem = `A ${nm} of base side ${input.side} mm and axis ${input.height} mm rests on ${input.rest === "edge" ? "one edge" : "one corner"} of its base on the HP, with its axis inclined at ${theta}° to the HP. Draw its projections.`;
    givens = [{ name: "Base side", value: `${input.side} mm` }, { name: "Axis", value: `${input.height} mm` }, { name: "Axis inclined to HP", value: `${theta}°` }];
  }

  solid = solidFor(input);
  const built = build(spec);
  const a = rad(isPlane ? theta : 90 - theta);
  const initial = views(built, 0, 0);
  const probe = views(built, a, 0);
  // shift the final views to the right of the initial ones
  const finalMin = Math.min(...probe.keys.map((k) => k[0]), ...(built.shape.kind === "cone" ? [probe.keys[1][0], probe.keys[3][0]] : []));
  const dx = built.maxX + 30 - finalMin;
  const fin = views(built, a, dx);
  const maxFinal = Math.max(...fin.keys.map((k) => k[0]));
  const xyEnd = maxFinal + 15;
  const initKeys = views(built, 0, 0).keys;

  const what = isPlane ? "lamina" : spec.solid === "cone" ? "cone" : spec.solid;
  const steps: Step[] = [];
  steps.push({
    title: `Reference line and top view in the simple position`,
    explanation: isPlane
      ? `Draw XY. The lamina is first laid flat on the HP, so the top view is its true shape, with ${input.rest === "edge" && input.shape !== "circle" ? "one side" : input.shape === "circle" ? "a point of the circumference" : "one corner"} on the right.`
      : `Draw XY. The ${what} first stands on its base on the HP, so the top view shows the true shape of the base${spec.solid === "cone" ? " (a circle)" : ""} and the top of the axis directly over its centre.`,
    style: "outline",
    primitives: [line([-10, 0], [xyEnd, 0]), text([-16, 2], "X"), text([xyEnd + 2, 2], "Y"), ...initial.tv],
  });
  steps.push({
    title: "Front view in the simple position",
    explanation: isPlane
      ? "Project upward. The lamina lies on the HP, so its front view is a straight line on XY."
      : `Project up from the top view. The ${what} stands on XY, so its front view is ${spec.solid === "cone" ? "a triangle" : spec.solid === "pyramid" ? "a triangle" : "a rectangle"} of height ${round(spec.solid === "cone" ? spec.height : spec.solid === "plane" ? 0 : spec.height)} mm.`,
    style: "outline",
    primitives: [...initKeys.map((k) => line([k[0], -k[1]], [k[0], k[2]], "construction")), ...initial.fv],
  });

  // axis/surface angle construction in the tilted front view
  const finalAxisPts = (() => {
    if (isPlane) return null;
    const sh = built.shape;
    const move = (v: Vec3): Vec3 => { const q = rot(v, built.pivot, a); return [q[0] + dx, q[1], q[2]]; };
    if (sh.kind === "cone") return { apex: move([sh.centre[0], sh.centre[1], sh.h]), centre: move(sh.centre) };
    const poly = sh as Poly3;
    const half = poly.apex !== undefined ? poly.apex : poly.verts.length / 2;
    const bottom = mean(poly.verts.slice(0, half));
    return { apex: move(poly.apex !== undefined ? poly.verts[poly.apex] : mean(poly.verts.slice(half))), centre: move(bottom) };
  })();
  const angleMarks: Primitive[] = [];
  if (isPlane) {
    const piv = rot(built.pivot, built.pivot, a);
    angleMarks.push({ t: "arc", c: [piv[0] + dx, 0], r: 14, from: 180 - theta, to: 180, style: "construction" }, text([piv[0] + dx - 22, 3], `${theta}°`));
  } else if (finalAxisPts) {
    const { apex, centre } = finalAxisPts;
    const dirx = apex[0] - centre[0], dirz = apex[2] - centre[2];
    const sdown = centre[2] / (dirz / Math.hypot(dirx, dirz));
    const L = Math.hypot(dirx, dirz);
    const q: Point = [centre[0] - (dirx / L) * sdown, 0];
    angleMarks.push(line(q, [apex[0], apex[2]], "construction"), { t: "arc", c: q, r: 14, from: 0, to: theta, style: "construction" }, text([q[0] + 16, 3], `${theta}°`));
  }
  steps.push({
    title: isPlane ? `Tilt the front view to ${theta}°` : `Tilt the front view so the axis is at ${theta}°`,
    explanation: isPlane
      ? `Redraw the front view with its resting point on XY and the line of the lamina inclined at ${theta}° to XY. Its length stays the same.`
      : `Redraw the front view, keeping the same size and shape, so that its axis makes ${theta}° with XY and the point of the base that touches the HP is on XY. Parts that are behind are dotted.`,
    style: "outline",
    primitives: [...angleMarks, ...fin.fv],
  });

  // projectors and loci
  const proj: Primitive[] = [];
  fin.keys.forEach((k, i) => {
    const ik = built.shape.kind === "cone" ? null : (built.shape.kind === "poly" ? built.shape.verts[i] : built.shape.corners[i]);
    const yTv = -k[1];
    proj.push(line([k[0], k[2]], [k[0], yTv], "construction"));
    if (ik) proj.push(line([ik[0], -ik[1]], [k[0], yTv], "construction"));
  });
  if (built.shape.kind === "cone") {
    const s = built.shape;
    const iy = [[s.centre[0], s.centre[1]], [s.centre[0] + s.r, s.centre[1]], [s.centre[0], s.centre[1] + s.r], [s.centre[0] - s.r, s.centre[1]], [s.centre[0], s.centre[1] - s.r]];
    fin.keys.forEach((k, i) => proj.push(line([iy[i][0], -iy[i][1]], [k[0], -k[1]], "construction")));
  }
  steps.push({
    title: "Project the new top view",
    explanation: isPlane
      ? "Draw vertical projectors down from the corners of the tilted front view. From each corner of the first top view draw a horizontal line (the path it can only move along). Where they cross is the new position of that corner."
      : "Draw vertical projectors down from the key points of the tilted front view. From each matching point of the first top view draw a horizontal line (its locus, because depth does not change when the solid tilts). Where they cross is the new top-view point.",
    style: "construction",
    primitives: proj,
  });
  steps.push({
    title: "Draw the final top view",
    explanation: isPlane
      ? "Join the new points in order with thick lines. The top view is shortened in the direction of tilt but keeps its full width."
      : `Join the new points with thick lines. Edges that are hidden by the solid are dotted.${spec.solid === "cone" ? " Draw two tangents from the apex to the base ellipse as the outline." : ""}`,
    style: "outline",
    primitives: fin.tv,
  });

  return { ok: true, solution: { title, problem, givens, steps, ...(solid ? { solid } : {}) } };
}

/** Helpers for building the solid shown in 3D. */
export function solidFor(input: TiltInput): Solution["solid"] | undefined {
  if ("shape" in input) return undefined;
  if (input.solid === "cone") return { kind: "revolve", profile: [[0, 0], [input.diameter / 2, 0], [0, input.height]] };
  const n = SIDES[input.base];
  const R = input.side / (2 * Math.sin(Math.PI / n));
  const profile: Point[] = Array.from({ length: n }, (_, k) => [R * Math.cos((2 * Math.PI * k) / n), R * Math.sin((2 * Math.PI * k) / n)]);
  return input.solid === "prism" ? { kind: "extrude", profile, height: input.height } : { kind: "pyramid", profile, height: input.height };
}
