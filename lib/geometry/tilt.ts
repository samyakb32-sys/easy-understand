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

type Views = { fv: Primitive[]; tv: Primitive[]; /** key 3D points after the turns, in a fixed order */ keys: Vec3[]; minX: number; maxX: number; minY: number };

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
function views(b: Built, a: number, dx: number, phi = 0, dx2 = 0, dy = 0): Views {
  const p = (v: Vec3): Vec3 => {
    const q = a === 0 ? v : rot(v, b.pivot, a);
    let x = q[0] + dx, y = q[1];
    if (phi) {
      // second turn: about the vertical line through the resting point, so the plan of the axis makes phi with XY
      const px = b.pivot[0] + dx, py = b.pivot[1], c = Math.cos(phi), sn = Math.sin(phi);
      const ux = x - px, uy = y - py;
      x = px + ux * c + uy * sn;
      y = py - ux * sn + uy * c;
    }
    return [x + dx2, y + dy, q[2]];
  };
  const all: Vec3[] = [];
  const done = (fv: Primitive[], tv: Primitive[], keys: Vec3[]): Views => ({ fv, tv, keys, minX: Math.min(...all.map((v) => v[0])), maxX: Math.max(...all.map((v) => v[0])), minY: Math.min(...all.map((v) => v[1])) });
  const fvP = (v: Vec3): Point => [v[0], v[2]];
  const tvP = (v: Vec3): Point => [v[0], -v[1]];
  const fv: Primitive[] = [];
  const tv: Primitive[] = [];
  const s = b.shape;

  if (s.kind === "poly") {
    const verts = s.verts.map(p);
    all.push(...verts);
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
    return done(fv, tv, verts);
  }

  if (s.kind === "plane") {
    const ring = s.ring.map(p);
    all.push(...ring);
    const xs = ring.map((v) => v[0]);
    const zs = ring.map((v) => v[2]);
    const iMin = xs.indexOf(Math.min(...xs)), iMax = xs.indexOf(Math.max(...xs));
    if (phi) fv.push({ t: "poly", pts: ring.map(fvP), closed: true, style: "outline" });
    else fv.push(line([xs[iMin], zs[iMin]], [xs[iMax], zs[iMax]], "outline"));
    tv.push({ t: "poly", pts: ring.map(tvP), closed: true, style: "outline" });
    return done(fv, tv, s.corners.map(p));
  }

  // cone: apex at the end of the axis, base circle sampled; every outline comes from the 3D normals
  const N = 72;
  const apex = p([s.centre[0], s.centre[1], s.h]);
  const centre = p(s.centre);
  const rim = Array.from({ length: N }, (_, k) => {
    const t = (2 * Math.PI * k) / N;
    return p([s.centre[0] + s.r * Math.cos(t), s.centre[1] + s.r * Math.sin(t), 0]);
  });
  all.push(apex, ...rim);
  const axis = sub(apex, centre).map((c) => c / s.h) as Vec3;
  const latN = rim.map((v) => {
    const rad = sub(v, centre).map((c) => c / s.r) as Vec3;
    return [s.h * rad[0] + s.r * axis[0], s.h * rad[1] + s.r * axis[1], s.h * rad[2] + s.r * axis[2]] as Vec3;
  });
  const side = (proj: (v: Vec3) => Point, comp: 1 | 2, out: Primitive[]) => {
    const pts = rim.map(proj);
    const T = proj(apex), C = proj(centre);
    const baseVis = -axis[comp] > 1e-9;
    const vis = latN.map((n) => baseVis || n[comp] > 1e-9);
    // a base seen edge-on is a straight line
    const ex = Math.hypot(...[0, 1].map((k) => Math.max(...pts.map((q) => q[k])) - Math.min(...pts.map((q) => q[k]))));
    const flat = Math.abs(axis[comp]) < 1e-9;
    let ends: [Point, Point] | null = null;
    if (flat) {
      let best = 0;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j += 1) {
        const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
        if (d > best) { best = d; ends = [pts[i], pts[j]]; }
      }
      void ex;
      out.push(line(ends![0], ends![1], "outline"), line(T, ends![0], "outline"), line(T, ends![1], "outline"), line(T, C, "centre"));
      return;
    }
    out.push(...runs(pts, vis));
    const base0 = Math.atan2(C[1] - T[1], C[0] - T[0]);
    const diffs = pts.map((q) => {
      let d = Math.atan2(q[1] - T[1], q[0] - T[0]) - base0;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return d;
    });
    if (diffs.every((d) => Math.abs(d) < Math.PI / 2 - 1e-6)) {
      out.push(line(T, pts[diffs.indexOf(Math.max(...diffs))], "outline"), line(T, pts[diffs.indexOf(Math.min(...diffs))], "outline"));
    } else {
      out.push(line(T, pts[N / 4], "outline"), line(T, pts[(3 * N) / 4], "outline"));
    }
    out.push(line(T, C, "centre"));
  };
  side(fvP, 1, fv);
  side(tvP, 2, tv);
  return done(fv, tv, [apex, rim[0], rim[N / 4], rim[N / 2], rim[(3 * N) / 4]]);
}

const input_isCircle = (sp: Spec) => sp.solid === "plane" && sp.n === "circle";
const POLY_NAME = (n: number) => ({ 3: "triangle", 4: "square", 5: "pentagon", 6: "hexagon" })[n] ?? `${n}-gon`;

export type TiltInput =
  | { solid: "prism" | "pyramid"; base: RegularBase; side: number; height: number; angle: number; rest: "corner" | "edge"; /** plan of the axis to the VP, degrees */ phi?: number }
  | { solid: "cone"; diameter: number; height: number; angle: number; phi?: number }
  | { shape: RegularBase | "circle"; size: number; angle: number; rest: "corner" | "edge"; /** the side (or diameter) in the HP, inclined to the VP, degrees */ phi?: number };

export function solveTilted(input: TiltInput): Result {
  const isPlane = "shape" in input;
  const theta = input.angle;
  if (!(theta > 0 && theta < 90)) return { ok: false, reason: "The inclination must be between 0° and 90°." };
  const phiDeg = input.phi ?? 0;
  if (phiDeg && "shape" in input && input.shape !== "circle" && input.rest !== "edge") return { ok: false, reason: "To give the inclination of a side to the VP, the lamina must rest on that side (on the HP)." };
  if (phiDeg && !(phiDeg > 0 && phiDeg < 90)) return { ok: false, reason: "The inclination to the VP must be between 0° and 90°." };

  let spec: Spec;
  let title: string, problem: string, givens: { name: string; value: string }[];
  let solid: Solution["solid"];
  if (isPlane) {
    const n = input.shape === "circle" ? "circle" : SIDES[input.shape];
    spec = { solid: "plane", n, size: input.size, rest: input.rest };
    const name = input.shape === "circle" ? "circle" : input.shape;
    title = `Projection of a ${name} lamina${phiDeg ? " inclined to HP and VP" : ""}`;
    problem = input.shape === "circle"
      ? `A circular lamina of diameter ${input.size} mm rests on the HP on a point of its circumference, with its surface inclined at ${theta}° to the HP${phiDeg ? ` and the diameter in the HP inclined at ${phiDeg}° to the VP` : ""}. Draw its projections.`
      : `A ${name} lamina of side ${input.size} mm rests on the HP on ${input.rest === "edge" ? "one side" : "one corner"}, with its surface inclined at ${theta}° to the HP${phiDeg ? ` and that side inclined at ${phiDeg}° to the VP` : ""}. Draw its projections.`;
    givens = [{ name: input.shape === "circle" ? "Diameter" : "Side", value: `${input.size} mm` }, { name: "Surface inclined to HP", value: `${theta}°` }, ...(phiDeg ? [{ name: input.shape === "circle" ? "Diameter to VP" : "Side to VP", value: `${phiDeg}°` }] : [])];
  } else if (input.solid === "cone") {
    spec = { solid: "cone", r: input.diameter / 2, height: input.height };
    title = phiDeg ? "Cone with its axis inclined to the HP and VP" : "Cone with its axis inclined to the HP";
    problem = `A cone of base diameter ${input.diameter} mm and axis ${input.height} mm rests on a point of its base circle on the HP, with its axis inclined at ${theta}° to the HP${phiDeg ? ` and the plan of the axis inclined at ${phiDeg}° to the VP` : ""}. Draw its projections.`;
    givens = [{ name: "Base diameter", value: `${input.diameter} mm` }, { name: "Axis", value: `${input.height} mm` }, { name: "Axis inclined to HP", value: `${theta}°` }, ...(phiDeg ? [{ name: "Plan of axis to VP", value: `${phiDeg}°` }] : [])];
  } else {
    const n = SIDES[input.base];
    spec = { solid: input.solid, n, side: input.side, height: input.height, rest: input.rest };
    const nm = `${POLY_NAME(n)} ${input.solid}`;
    title = `${nm[0].toUpperCase()}${nm.slice(1)} with its axis inclined to the HP${phiDeg ? " and VP" : ""}`;
    problem = `A ${nm} of base side ${input.side} mm and axis ${input.height} mm rests on ${input.rest === "edge" ? "one edge" : "one corner"} of its base on the HP, with its axis inclined at ${theta}° to the HP${phiDeg ? ` and the plan of the axis inclined at ${phiDeg}° to the VP` : ""}. Draw its projections.`;
    givens = [{ name: "Base side", value: `${input.side} mm` }, { name: "Axis", value: `${input.height} mm` }, { name: "Axis inclined to HP", value: `${theta}°` }, ...(phiDeg ? [{ name: "Plan of axis to VP", value: `${phiDeg}°` }] : [])];
  }

  solid = solidFor(input);
  const built = build(spec);
  const a = rad(isPlane ? theta : 90 - theta);
  const initial = views(built, 0, 0);
  const probe = views(built, a, 0);
  // shift the final views to the right of the initial ones
  const dx = built.maxX + 30 - probe.minX;
  const fin = views(built, a, dx);
  const phi = rad(isPlane ? 90 - phiDeg : phiDeg); // a lamina's tilt edge starts perpendicular to XY, so it turns through 90 - phi
  const dx2 = fin.maxX + 30 - views(built, a, dx, phi).minX;
  const probe2 = views(built, a, dx, phi, dx2);
  const dy = GAP - probe2.minY;
  const fin2 = phiDeg ? views(built, a, dx, phi, dx2, dy) : null;
  const xyEnd = (fin2 ? fin2.maxX : fin.maxX) + 15;
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

  if (fin2) {
      const turn = (v: Vec3): Point => {
      const r1 = rot(v, built.pivot, a);
      const px = built.pivot[0] + dx, py = built.pivot[1], c = Math.cos(phi), sn = Math.sin(phi);
      const x1 = r1[0] + dx, y1 = r1[1];
      return [px + (x1 - px) * c + (y1 - py) * sn + dx2, -(py - (x1 - px) * sn + (y1 - py) * c + dy)];
    };
    const sh = built.shape;
    let turnMark: Primitive[];
    if (sh.kind === "plane") {
      const idx = input_isCircle(spec) ? [1, 3] : sh.corners.map((c, i) => (c[0] >= built.maxX - 1e-9 ? i : -1)).filter((i) => i >= 0);
      let A = turn(sh.corners[idx[0]]), B = turn(sh.corners[idx[1]]);
      if (B[0] < A[0]) [A, B] = [B, A];
      const ang = (Math.atan2(B[1] - A[1], B[0] - A[0]) * 180) / Math.PI;
      const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
      turnMark = [
        line([A[0] - 5, A[1]], [A[0] + len + 8, A[1]], "construction"),
        { t: "arc", c: A, r: Math.min(14, len / 2), from: Math.min(0, ang), to: Math.max(0, ang), style: "construction" },
        text([A[0] + 16, A[1] + (ang > 0 ? 3 : -5)], `${phiDeg}°`),
      ];
    } else {
    const poly = sh as Poly3;
    const half = poly.apex !== undefined ? poly.apex : (poly.verts?.length ?? 0) / 2;
    const apex2 = sh.kind === "cone" ? turn([sh.centre[0], sh.centre[1], sh.h]) : turn(poly.apex !== undefined ? poly.verts[poly.apex] : mean(poly.verts.slice(half)));
    const cen2 = sh.kind === "cone" ? turn(sh.centre) : turn(mean(poly.verts.slice(0, half)));
    // reference line through the base centre, parallel to XY, and the angle to the plan of the axis
    const len = Math.hypot(apex2[0] - cen2[0], apex2[1] - cen2[1]);
    const up = apex2[1] > cen2[1];
    turnMark = [
      line([cen2[0] - 5, cen2[1]], [cen2[0] + len + 8, cen2[1]], "construction"),
      line(cen2, apex2, "construction"),
      { t: "arc", c: cen2, r: Math.min(14, len / 2), from: up ? 0 : -phiDeg, to: up ? phiDeg : 0, style: "construction" },
      text([cen2[0] + 16, cen2[1] + (up ? 3 : -5)], `${phiDeg}°`),
    ];
    }
    steps.push({
      title: `Turn the top view through ${phiDeg}°`,
      explanation: isPlane ? `Copy the final top view to a new place, turned so the side (or diameter) that lies in the HP makes ${phiDeg}° with XY. Its shape does not change.` : `Copy the final top view to a new place, turned so the plan of the axis makes ${phiDeg}° with XY. Its size and shape do not change, and the solid still touches the HP at the same point. Edges that are hidden are dotted.`,
      style: "outline",
      primitives: [...turnMark, ...fin2.tv],
    });
    const proj2: Primitive[] = [];
    fin2.keys.forEach((k, i) => {
      const k1 = fin.keys[i];
      proj2.push(line([k[0], -k[1]], [k[0], k1[2]], "construction"), line([k1[0], k1[2]], [k[0], k1[2]], "construction"));
    });
    steps.push({
      title: "Project the new front view",
      explanation: "Draw vertical projectors up from the key points of the turned top view. From each matching point of the tilted front view draw a horizontal line (its height does not change when the solid turns). Where they cross is the new front-view point.",
      style: "construction",
      primitives: proj2,
    });
    steps.push({
      title: "Draw the final front view",
      explanation: "Join the new points with thick lines, dotting the hidden edges. The solid is now inclined to both the HP and the VP.",
      style: "outline",
      primitives: fin2.fv,
    });
  }
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

// ---------------------------------------------------------------- VP first

const SWAP: Record<string, string> = {
  "top view": "front view", "front view": "top view", "top-view": "front-view", "front-view": "top-view",
  "Top view": "Front view", "Front view": "Top view", "Top-view": "Front-view", "Front-view": "Top-view",
  HP: "VP", VP: "HP", upward: "downward", downward: "upward", "projectors down": "projectors up", "projectors up": "projectors down",
  height: "depth", depth: "height", heights: "depths", depths: "heights",
};
const swapWords = (s: string) => s.replace(/projectors (?:up|down)|\b(?:[Tt]op|[Ff]ront)[ -]view\b|\bHP\b|\bVP\b|\bupward\b|\bdownward\b|\b(?:height|depth)s?\b/g, (m) => SWAP[m] ?? m);

const flip = (p: Primitive): Primitive => {
  const f = (q: Point): Point => [q[0], -q[1]];
  switch (p.t) {
    case "line": return { ...p, a: f(p.a), b: f(p.b) };
    case "circle": return { ...p, c: f(p.c) };
    case "arc": return { ...p, c: f(p.c), from: -p.to, to: -p.from };
    case "ellipse": return { ...p, c: f(p.c), rot: p.rot ? -p.rot : p.rot, ...(p.from !== undefined && p.to !== undefined ? { from: -p.to, to: -p.from } : {}) };
    case "poly": return { ...p, pts: p.pts.map(f) };
    case "text": return { ...p, at: f(p.at) };
  }
};

/**
 * A lamina placed with its surface inclined to the VP first (true shape in the front view), then a side inclined to the HP.
 * Solved as the HP-first problem and then reflected in XY, which swaps the roles of the two planes.
 * `surfaceToVP` is the inclination of the surface to the VP; `sideToHP` that of the side lying in the VP to the HP.
 */
export function solveTiltedVpFirst(input: { shape: RegularBase | "circle"; size: number; surfaceToVP: number; sideToHP?: number; rest: "corner" | "edge" }): Result {
  const r = solveTilted({ shape: input.shape, size: input.size, angle: input.surfaceToVP, rest: input.rest, phi: input.sideToHP });
  if (!r.ok) return r;
  const s = r.solution;
  return {
    ok: true,
    solution: {
      ...s,
      title: swapWords(s.title).replace("inclined to HP and VP", "inclined to VP and HP"),
      problem: swapWords(s.problem),
      givens: s.givens.map((g) => ({ name: swapWords(g.name), value: g.value })),
      steps: s.steps.map((st) => ({ ...st, title: swapWords(st.title), explanation: swapWords(st.explanation), primitives: st.primitives.map(flip) })),
    },
  };
}
