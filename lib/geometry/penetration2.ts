import type { Point, Primitive, Step } from "../schema";
import { round } from "./basic";
import { GAP, dot, groupLabels, line, radialLabel, solveCylinderPenetration, text, type Result } from "./penetration";

/* ---- a tiny hidden-line engine ----------------------------------------------------------------------------------
 * 3D: x right, y towards the viewer (depth in front of the VP), z up. A solid is a convex body described by its chord
 * along an axis through a point. Every edge or contour line is a parametric 3D curve; it is cut where it passes inside
 * another solid, and the rest is visible or hidden depending on whether anything lies between it and the observer
 * (front view: looking along -y; top view: looking down; left side view: looking along +x). */
type V3 = [number, number, number];
type Axis = 0 | 1 | 2;
type Solid = (axis: Axis, p: V3) => [number, number] | null;
type View = { ax: Axis; sgn: 1 | -1; proj: (p: V3) => Point };
/** `limb`: a silhouette line of a curved surface, which is simply left out where something is in front of it. `edgeOn`: lies in a plane seen edge-on, so it is drawn as part of the outline. */
type El = { view: View; f: (t: number) => V3; t0: number; t1: number; limb?: boolean; straight?: boolean; edgeOn?: boolean };
const EPS = 1e-6;
const DEG = Math.PI / 180;

/** Cylinder with its axis along `k` through (a, b) of the other two coordinates (in x, y, z order), between lo and hi. */
const cylinder = (k: Axis, [a, b]: [number, number], r: number, lo: number, hi: number): Solid => (ax, p) => {
  const [i, j] = ([0, 1, 2] as const).filter((q) => q !== k);
  const di = p[i] - a, dj = p[j] - b;
  if (ax === k) return di * di + dj * dj <= r * r + EPS ? [lo, hi] : null;
  if (p[k] < lo - EPS || p[k] > hi + EPS) return null;
  const [d, c] = ax === i ? [dj, a] : [di, b];
  if (Math.abs(d) > r + EPS) return null;
  const h = Math.sqrt(Math.max(0, r * r - d * d));
  return [c - h, c + h];
};
/** Vertical cone on the HP, axis through the origin. */
const cone = (R: number, h: number): Solid => (ax, [x, y, z]) => {
  if (ax === 2) { const rho = Math.hypot(x, y); return rho <= R + EPS ? [0, h * (1 - rho / R)] : null; }
  const rz = R * (1 - z / h), d = ax === 0 ? y : x;
  if (z < -EPS || z > h + EPS || Math.abs(d) > rz + EPS) return null;
  const s = Math.sqrt(Math.max(0, rz * rz - d * d));
  return [-s, s];
};
/** Vertical prism on the HP whose base is the convex polygon `poly` (counter-clockwise in x, y). */
const prism = (poly: Point[], h: number): Solid => (ax, p) => {
  if (ax !== 2 && (p[2] < -EPS || p[2] > h + EPS)) return null;
  let u0 = ax === 2 ? 0 : -Infinity, u1 = ax === 2 ? h : Infinity;
  for (let n = 0; n < poly.length; n++) {
    const [px, py] = poly[n], [qx, qy] = poly[(n + 1) % poly.length];
    const ex = qx - px, ey = qy - py;
    const c0 = ex * (p[1] - py) - ey * (p[0] - px); // >= 0 when p is inside this edge
    const c1 = ax === 0 ? -ey : ax === 1 ? ex : 0;
    if (Math.abs(c1) < 1e-12) { if (c0 < -EPS * Math.hypot(ex, ey)) return null; continue; }
    const u = p[ax] - c0 / c1;
    if (c1 > 0) u0 = Math.max(u0, u); else u1 = Math.min(u1, u);
  }
  return u0 <= u1 ? [u0, u1] : null;
};

const inside = (s: Solid, p: V3) => ([0, 1, 2] as const).every((a) => { const c = s(a, p); return !!c && c[0] + EPS < p[a] && p[a] < c[1] - EPS; });

/** Runs of one element: cls 0 = not in the drawing (inside a solid, or a hidden contour), 1 = visible, 2 = hidden. */
function trace(el: El, solids: Solid[]) {
  const v = el.view, N = 144;
  const cls = (t: number) => {
    const p = el.f(t);
    if (solids.some((s) => inside(s, p))) return 0;
    const covered = solids.some((s) => { const c = s(v.ax, p); return !!c && (v.sgn > 0 ? c[1] > p[v.ax] + EPS : c[0] < p[v.ax] - EPS); });
    return covered && !el.edgeOn ? (el.limb ? 0 : 2) : 1;
  };
  const runs: { cls: number; pts: Point[] }[] = [];
  let tp = el.t0, cp = cls(tp), cur = { cls: cp, pts: [v.proj(el.f(tp))] };
  for (let i = 1; i <= N; i++) {
    const t = el.t0 + ((el.t1 - el.t0) * i) / N, c = cls(t);
    if (c !== cp) {
      let a = tp, b = t;
      for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if (cls(m) === cp) a = m; else b = m; }
      const edge = v.proj(el.f((a + b) / 2));
      cur.pts.push(edge);
      runs.push(cur);
      cur = { cls: c, pts: [edge] };
    }
    cur.pts.push(v.proj(el.f(t)));
    tp = t;
    cp = c;
  }
  runs.push(cur);
  if (el.t1 - el.t0 === 360 && runs.length > 1 && runs[0].cls === cur.cls) cur.pts.push(...runs.shift()!.pts); // a closed loop: join the two ends of the first run
  const len = (r: { pts: Point[] }) => r.pts.slice(1).reduce((s, q, k) => s + Math.hypot(q[0] - r.pts[k][0], q[1] - r.pts[k][1]), 0);
  return runs.filter((r) => len(r) > 1e-3).map((r) => (el.straight ? { ...r, pts: [r.pts[0], r.pts[r.pts.length - 1]] } : r));
}

/** Drawing primitives of the elements: visible parts plain, hidden parts dashed, and (front view only, when `guide`) the parts cut away as thin lines. */
const strokes = (els: El[], solids: Solid[], guide = false): Primitive[] =>
  els.flatMap((el) => trace(el, solids).flatMap(({ cls, pts }): Primitive[] => {
    if (cls === 0 && !(guide && el.view.ax === 1)) return [];
    const style = cls === 1 ? undefined : cls === 2 ? ("hidden" as const) : ("construction" as const);
    return [el.straight ? line(pts[0], pts[pts.length - 1], style) : { t: "poly", pts, ...(style ? { style } : {}) }];
  }));

/* ---- layout and the elements of each solid ---------------------------------------------------------------------- */
function layout(W: number, L: number) {
  const cxSV = L + 25 + W, cyTV = -(W + GAP);
  const F: View = { ax: 1, sgn: 1, proj: ([x, , z]) => [x, z] };
  const T: View = { ax: 2, sgn: 1, proj: ([x, y]) => [x, cyTV - y] };
  const S: View = { ax: 0, sgn: -1, proj: ([, y, z]) => [cxSV + y, z] };
  return { cxSV, cyTV, F, T, S, xyStart: -L - 8, xyEnd: cxSV + W + 12 };
}
type Lay = ReturnType<typeof layout>;

/** Circle of radius r about c, in the plane z = c[2] (k = 2) or the plane x = c[0] (k = 0); t in degrees. */
const circ = (k: 0 | 2, c: V3, r: number) => (t: number): V3 => {
  const u = r * Math.cos(t * DEG), w = r * Math.sin(t * DEG);
  return k === 2 ? [c[0] + u, c[1] + w, c[2]] : [c[0], c[1] + u, c[2] + w];
};
const seg = (a: V3, b: V3) => (t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const ln = (view: View, a: V3, b: V3, limb = false): El => ({ view, f: seg(a, b), t0: 0, t1: 1, straight: true, limb });
const arc = (view: View, f: El["f"], t0: number, t1: number): El => ({ view, f, t0, t1 });

/** The horizontal branch: axis along x at depth e and height zc, from x = -L to L. */
const branchEls = (V: Lay, e: number, zc: number, r: number, L: number): El[] => {
  const rim = (x: number) => circ(0, [x, e, zc], r);
  return [
    ln(V.F, [-L, e, zc + r], [L, e, zc + r], true), ln(V.F, [-L, e, zc - r], [L, e, zc - r], true), arc(V.F, rim(L), -90, 90), arc(V.F, rim(-L), -90, 90),
    ln(V.T, [-L, e + r, zc], [L, e + r, zc], true), ln(V.T, [-L, e - r, zc], [L, e - r, zc], true), arc(V.T, rim(L), 0, 180), arc(V.T, rim(-L), 0, 180),
    arc(V.S, rim(-L), 0, 360),
  ];
};
const cylinderEls = (V: Lay, R: number, H: number): El[] => {
  const rim = (z: number) => circ(2, [0, 0, z], R);
  return [
    ln(V.F, [R, 0, 0], [R, 0, H], true), ln(V.F, [-R, 0, 0], [-R, 0, H], true), arc(V.F, rim(0), 0, 180), arc(V.F, rim(H), 0, 180),
    arc(V.T, rim(H), 0, 360),
    ln(V.S, [0, R, 0], [0, R, H], true), ln(V.S, [0, -R, 0], [0, -R, H], true), arc(V.S, rim(0), 90, 270), arc(V.S, rim(H), 90, 270),
  ];
};
const coneEls = (V: Lay, R: number, h: number): El[] => {
  const rim = circ(2, [0, 0, 0], R);
  return [
    ln(V.F, [R, 0, 0], [0, 0, h], true), ln(V.F, [-R, 0, 0], [0, 0, h], true), arc(V.F, rim, 0, 180),
    arc(V.T, rim, 0, 360),
    ln(V.S, [0, R, 0], [0, 0, h], true), ln(V.S, [0, -R, 0], [0, 0, h], true), arc(V.S, rim, 90, 270),
  ];
};
/** Edges of a prism: in each view only the edges nearest the observer (the others lie exactly behind them). */
const prismEls = (V: Lay, poly: Point[], H: number): El[] => {
  const front = (n: number, k: 0 | 1) => poly[n][k] * (k === 1 ? 1 : -1) >= -EPS;
  return poly.flatMap(([px, py], n) => {
    const m = (n + 1) % poly.length, [qx, qy] = poly[m];
    const sides = (view: View, k: 0 | 1) => (front(n, k) ? [ln(view, [px, py, 0], [px, py, H])] : []).concat(front(n, k) && front(m, k) ? [0, H].map((z) => ln(view, [px, py, z], [qx, qy, z])) : []);
    return [...sides(V.F, 1), ...sides(V.S, 0), ln(V.T, [px, py, H], [qx, qy, H])];
  });
};

/* ---- the common construction ------------------------------------------------------------------------------------ */
const TS = Array.from({ length: 12 }, (_, k) => 30 * k);
type Pt = { t: number; n: number; x: number; y: number; z: number };

type Spec = {
  title: string; problem: string; givens: { name: string; value: string }[];
  W: number; L: number; e: number; r: number; zc: number;
  solids: Solid[];
  mainEls: (V: Lay) => El[];
  /** x of the right-hand curve point at depth y and height z */
  X: (y: number, z: number) => number;
  /** range of the branch-circle angle drawn in the front view; the whole 0..360 when the back half differs from the front */
  fv: [number, number];
  /** the curve also shows (hidden or visible) in the top view */
  tv?: boolean;
  /** the curve is a circle on a face seen edge-on in the front view */
  edgeOn?: boolean;
  s1: string; s2: string; last: string;
  /** the steps between dividing the circle and drawing the curve, given the points */
  mid: (V: Lay, pts: Pt[]) => Step[];
};

function assemble(o: Spec): Result {
  const { W, L, e, r, zc } = o, V = layout(W, L), { cxSV, cyTV } = V;
  const pts: Pt[] = TS.map((t, k) => {
    const y = e + r * Math.cos(t * DEG), z = zc + r * Math.sin(t * DEG);
    return { t, n: k + 1, y, z, x: o.X(y, z) };
  });
  const curve = (sg: number) => (t: number): V3 => { const y = e + r * Math.cos(t * DEG), z = zc + r * Math.sin(t * DEG); return [sg * o.X(y, z), y, z]; };
  const curveEls = [1, -1].flatMap((sg) => [{ ...arc(V.F, curve(sg), o.fv[0], o.fv[1]), edgeOn: o.edgeOn }, ...(o.tv ? [arc(V.T, curve(sg), 0, 360)] : [])]);
  const svPt = (p: Pt): Point => [cxSV + p.y, p.z];
  const steps: Step[] = [
    {
      title: "Views of the main solid",
      explanation: o.s1,
      style: "outline",
      primitives: [
        line([V.xyStart, 0], [V.xyEnd, 0]), text([V.xyStart - 6, 2], "X"), text([V.xyEnd + 2, 2], "Y"),
        ...strokes(o.mainEls(V), o.solids, true),
        line([-W - 4, cyTV], [W + 4, cyTV], "centre"), line([0, cyTV - W - 4], [0, cyTV + W + 4], "centre"),
      ],
    },
    {
      title: "The penetrating cylinder",
      explanation: o.s2,
      style: "outline",
      primitives: [
        ...strokes(branchEls(V, e, zc, r, L), o.solids),
        line([cxSV + e - r - 4, zc], [cxSV + e + r + 4, zc], "centre"), line([cxSV + e, zc - r - 4], [cxSV + e, zc + r + 4], "centre"),
      ],
    },
    {
      title: "Divide the circle into 12 parts",
      explanation: "In the side view, divide the circle of the branch into 12 equal parts and number the points 1 to 12. Each point is a place where the surface of the branch meets the surface of the other solid.",
      style: "construction",
      primitives: pts.flatMap((p) => [dot(svPt(p)), radialLabel([cxSV + e, zc], r, p.t, String(p.n))]),
    },
    ...o.mid(V, pts),
    {
      title: "Draw the curve of intersection",
      explanation: o.last,
      style: "outline",
      primitives: strokes(curveEls, o.solids),
    },
  ];
  return { ok: true, solution: { title: o.title, problem: o.problem, givens: o.givens, steps } };
}

/** Horizontal line across the top view at each point's depth, meeting the other solid on the left and right. */
const depthStep = (V: Lay, pts: Pt[], title: string, explanation: string): Step => {
  const depths = [...new Set(pts.map((p) => round(p.y, 6)))];
  return {
    title, explanation, style: "construction",
    primitives: [
      ...depths.map((y) => { const x = Math.max(...pts.filter((p) => round(p.y, 6) === y).map((p) => p.x)); return line([-x, V.cyTV - y], [x, V.cyTV - y]); }),
      ...pts.flatMap((p) => [dot([p.x, V.cyTV - p.y]), dot([-p.x, V.cyTV - p.y])]),
      ...groupLabels(pts.map((p) => ({ p: [p.x, V.cyTV - p.y] as Point, n: p.n }))),
    ],
  };
};
/** Verticals from the top view, horizontals from the side view; they cross at the front view of each point. */
const projectStep = (V: Lay, pts: Pt[], explanation: string, horizontals = true): Step => ({
  title: "Project up to the front view",
  explanation,
  style: "construction",
  primitives: [
    ...pts.flatMap((p) => [line([p.x, V.cyTV - p.y], [p.x, p.z]), line([-p.x, V.cyTV - p.y], [-p.x, p.z]), ...(horizontals ? [line([V.cxSV + p.y, p.z], [-p.x, p.z])] : [])]),
    ...groupLabels(pts.map((p) => ({ p: [p.x, p.z] as Point, n: p.n }))),
  ],
});

const positive = (...v: number[]) => v.every((n) => Number.isFinite(n) && n > 0);
const NOT_POSITIVE: Result = { ok: false, reason: "All the diameters, heights and the side must be positive numbers." };
const mm = (n: number) => `${round(n)} mm`;

/* ---- 1. two cylinders, branch axis off-centre -------------------------------------------------------------------- */
export type OffsetCylinders = { mainDiameter: number; mainHeight: number; branchDiameter: number; offset: number; axisHeight?: number };

/**
 * Vertical cylinder completely pierced by a horizontal cylinder (axis parallel to the VP, at right angles to the
 * vertical axis but passing `offset` in front of it). The curves on the right and left are not mirror images of the
 * front and back, so the half of each curve on the far side of the branch is hidden and dashed in the front view.
 */
export function solveOffsetCylinders(i: OffsetCylinders): Result {
  const R = i.mainDiameter / 2, r = i.branchDiameter / 2, H = i.mainHeight, e = i.offset, zc = i.axisHeight ?? H / 2;
  if (!positive(R, r, H) || !Number.isFinite(e) || !Number.isFinite(zc)) return NOT_POSITIVE;
  if (e < 0) return { ok: false, reason: "The offset is measured from the vertical axis towards the viewer, so it must be positive." };
  if (e === 0) return solveCylinderPenetration({ mainDiameter: i.mainDiameter, mainHeight: H, branchDiameter: i.branchDiameter, axisHeight: i.axisHeight });
  if (r > R + 1e-9) return { ok: false, reason: "The cylinder that passes through must not be larger than the vertical cylinder. Swap them, or reduce its diameter." };
  if (e + r > R + 1e-9) return { ok: false, reason: `With its axis ${mm(e)} off-centre the horizontal cylinder sticks out beyond the sides of the vertical one. The offset plus the branch radius (${mm(e + r)}) must not be more than the main radius (${mm(R)}); the offset can be at most ${mm(R - r)}.` };
  if (2 * r > H + 1e-9) return { ok: false, reason: `The branch cylinder is wider than the main one is tall: its diameter (${mm(2 * r)}) is more than the height (${mm(H)}). Reduce the diameter to at most ${mm(H)}.` };
  if (zc - r < -1e-9 || zc + r > H + 1e-9) return { ok: false, reason: `The branch cylinder does not fit inside the height of the main one. Its axis must be between ${mm(r)} and ${mm(H - r)} above the base.` };
  const L = R + 15, xe = Math.sqrt(R * R - e * e);
  return assemble({
    title: "Interpenetration of two cylinders (axes not intersecting)",
    problem: `A vertical cylinder of diameter ${i.mainDiameter} mm and height ${H} mm is completely pierced by a horizontal cylinder of diameter ${i.branchDiameter} mm. The axis of the horizontal cylinder is parallel to the VP, ${mm(zc)} above the base, at right angles to the vertical axis and ${mm(e)} in front of it. Draw the curves of intersection.`,
    givens: [
      { name: "Vertical cylinder", value: `Ø${i.mainDiameter} × ${H} mm` },
      { name: "Horizontal cylinder", value: `Ø${i.branchDiameter} mm` },
      { name: "Branch axis height", value: mm(zc) },
      { name: "Offset of the axes", value: mm(e) },
    ],
    W: R, L, e, r, zc,
    solids: [cylinder(2, [0, 0], R, 0, H), cylinder(0, [e, zc], r, -L, L)],
    mainEls: (V) => cylinderEls(V, R, H),
    X: (y) => Math.sqrt(Math.max(0, R * R - y * y)),
    fv: [0, 360],
    s1: `Draw XY. The vertical cylinder (diameter ${i.mainDiameter} mm, height ${H} mm) is a rectangle in the front view, a circle in the top view, and a rectangle in the left side view placed to the right. The thin lines mark where the branch will cut its sides.`,
    s2: `The horizontal cylinder (diameter ${i.branchDiameter} mm) has its axis ${mm(zc)} above the base and parallel to the VP, but ${mm(e)} in front of the vertical axis. In the side view you look along it, so it is a circle whose centre is ${mm(e)} from the centre line of the main cylinder. In the front view it is a rectangle, and in the top view a strip ${i.branchDiameter} mm wide whose centre line is ${mm(e)} in front of (below) the centre of the circle. Its lines stop where they meet the main cylinder.`,
    mid: (V, pts) => [
      depthStep(V, pts, "Find the points in the top view",
        `Each point is ${mm(e)} + ${mm(r)}·cos θ in front of the vertical axis in the side view (a negative value means behind it); that is its depth in the top view. Draw a line across the top-view circle at that depth. The vertical cylinder is end-on in the top view, so the point lies where this line meets the circle, on the right and on the left. Points that share a depth (for example 2 and 12) land on the same spot.`),
      projectStep(V, pts, "From each point in the top view draw a vertical line up to the front view. From the same numbered point in the side view draw a horizontal line across to the front view. Where they cross is the front view of that point."),
    ],
    last: `Join the points in order with a smooth curve on each side. Points 10, 11, 12, 1, 2, 3 and 4 are on the half of the branch nearer the viewer, so that part of each curve is seen and drawn as a full line. The other half, points 4 to 10, is behind the branch, so it is dashed. The side lines of the branch stop where they meet the curve, ${mm(xe)} from the axis.`,
  });
}

/* ---- 2. cone and horizontal cylinder ----------------------------------------------------------------------------- */
export type ConeCylinder = { coneDiameter: number; coneHeight: number; branchDiameter: number; axisHeight: number };

/**
 * Vertical cone, base on the HP, completely pierced by a horizontal cylinder (axis parallel to the VP, meeting the
 * cone's axis at right angles). Horizontal section planes cut the cone in circles; the points are found on those circles.
 */
export function solveConeCylinder(i: ConeCylinder): Result {
  const R = i.coneDiameter / 2, h = i.coneHeight, r = i.branchDiameter / 2, zc = i.axisHeight;
  if (!positive(R, h, r, zc)) return NOT_POSITIVE;
  if (zc - r < -1e-9 || zc >= h) return { ok: false, reason: `The branch axis must be between ${mm(r)} (so the cylinder rests on or above the base) and ${mm(h)} (the apex) above the base.` };
  const room = (R * (h - zc)) / Math.hypot(R, h); // distance from the branch axis to the slant side
  if (r > room + 1e-9) return { ok: false, reason: `The horizontal cylinder is too wide for the cone at that height: its radius (${mm(r)}) must not be more than ${mm(room)} so that it stays inside the cone's side view. Reduce its diameter or lower its axis, otherwise the curve breaks into two loops.` };
  const L = R + 15, rho = (z: number) => R * (1 - z / h);
  return assemble({
    title: "Interpenetration of a cone and a cylinder",
    problem: `A vertical cone of base diameter ${i.coneDiameter} mm and height ${h} mm, standing on the HP, is completely pierced by a horizontal cylinder of diameter ${i.branchDiameter} mm. The axis of the cylinder is parallel to the VP, ${mm(zc)} above the base, and meets the axis of the cone at right angles. Draw the curves of intersection.`,
    givens: [
      { name: "Cone", value: `Ø${i.coneDiameter} × ${h} mm` },
      { name: "Horizontal cylinder", value: `Ø${i.branchDiameter} mm` },
      { name: "Branch axis height", value: mm(zc) },
    ],
    W: R, L, e: 0, r, zc,
    solids: [cone(R, h), cylinder(0, [0, zc], r, -L, L)],
    mainEls: (V) => coneEls(V, R, h),
    X: (y, z) => Math.sqrt(Math.max(0, rho(z) ** 2 - y * y)),
    fv: [-90, 90],
    tv: true,
    s1: `Draw XY. The cone (base diameter ${i.coneDiameter} mm, height ${h} mm) is a triangle in the front view and the left side view, and a circle in the top view. The thin lines mark where the cylinder will cut its slant sides.`,
    s2: `The horizontal cylinder (diameter ${i.branchDiameter} mm) has its axis ${mm(zc)} above the base, parallel to the VP and meeting the axis of the cone. In the side view you look along it, so it is a circle inside the triangle. In the front view it is a rectangle and in the top view a strip ${i.branchDiameter} mm wide. Its lines stop where they meet the cone.`,
    mid: (V, pts) => {
      const heights = [...new Set(pts.map((p) => round(p.z, 6)))].map((z) => pts.find((p) => round(p.z, 6) === z)!);
      const p1 = pts[0];
      return [
        {
          title: "Horizontal section planes",
          explanation: `Points at the same height lie in one horizontal plane. That plane cuts the cone in a circle of radius ${round(R)}·(1 − z/${h}) and the cylinder in straight lines, so each point must lie on the circle at its height. Draw a horizontal line from each point across the front view, and in the top view draw the circle for that height (points 1 and 7 are at ${mm(p1.z)}, so their circle has radius ${mm(rho(p1.z))}; there are ${heights.length} different heights, so ${heights.length} circles).`,
          style: "construction",
          primitives: heights.flatMap((p) => [line([V.cxSV + p.y, p.z], [-rho(p.z), p.z]), { t: "circle" as const, c: [0, V.cyTV] as Point, r: rho(p.z) }]),
        },
        depthStep(V, pts, "Find the points in the top view",
          `Each point is ${mm(r)}·cos θ from the centre line in the side view, which is its depth in the top view. Draw a line across the top view at that depth. The point lies where this line meets the circle of its own height, on the right and on the left.`),
        projectStep(V, pts, "From each point in the top view draw a vertical line up to the front view, to meet the horizontal line of the same height. Where they cross is the front view of that point.", false),
      ];
    },
    last: `Join the points in order with a smooth curve on each side, in the front view and in the top view. In the top view the points on the upper half of the cylinder (1 to 7) are seen from above, so that part of the curve is a full line; the points under the cylinder (7 to 12 and back to 1) are hidden, so that part is dashed. The lines of the cylinder stop where they meet the curve.`,
  });
}

/* ---- 3. square prism and horizontal cylinder --------------------------------------------------------------------- */
export type PrismCylinder = { side: number; height: number; branchDiameter: number; axisHeight?: number; facesInclined?: boolean };

/**
 * Vertical square prism completely pierced by a horizontal cylinder (axis parallel to the VP, meeting the prism axis at
 * right angles). With a base edge parallel to the VP the cylinder meets two faces square-on and the curve is a circle on
 * each; with the faces equally inclined to the VP (the usual textbook case) it meets four faces and the curve is made of
 * circular arcs in the front view.
 */
export function solvePrismCylinder(i: PrismCylinder): Result {
  const s = i.side, H = i.height, r = i.branchDiameter / 2, zc = i.axisHeight ?? H / 2, inc = !!i.facesInclined;
  if (!positive(s, H, r) || !Number.isFinite(zc)) return NOT_POSITIVE;
  const W = inc ? s / Math.SQRT2 : s / 2; // half the width of the prism, seen in the front and top views
  if (r > W + 1e-9) return { ok: false, reason: `The cylinder must not be wider than the prism: its diameter (${i.branchDiameter} mm) can be at most ${mm(2 * W)} here.` };
  if (2 * r > H + 1e-9) return { ok: false, reason: `The cylinder is wider than the prism is tall: its diameter (${mm(2 * r)}) is more than the height (${mm(H)}). Reduce the diameter to at most ${mm(H)}.` };
  if (zc - r < -1e-9 || zc + r > H + 1e-9) return { ok: false, reason: `The cylinder does not fit inside the height of the prism. Its axis must be between ${mm(r)} and ${mm(H - r)} above the base.` };
  const poly: Point[] = inc ? [[W, 0], [0, W], [-W, 0], [0, -W]] : [[W, -W], [W, W], [-W, W], [-W, -W]];
  const L = W + 15;
  return assemble({
    title: "Interpenetration of a square prism and a cylinder",
    problem: `A vertical square prism of base side ${s} mm and height ${H} mm, ${inc ? "with its faces equally inclined to the VP" : "with a base edge parallel to the VP"}, is completely pierced by a horizontal cylinder of diameter ${i.branchDiameter} mm. The axis of the cylinder is parallel to the VP, ${mm(zc)} above the base, and meets the axis of the prism at right angles. Draw the curves of intersection.`,
    givens: [
      { name: "Square prism", value: `${s} × ${s} × ${H} mm` },
      { name: "Faces", value: inc ? "equally inclined to the VP" : "a base edge parallel to the VP" },
      { name: "Horizontal cylinder", value: `Ø${i.branchDiameter} mm` },
      { name: "Branch axis height", value: mm(zc) },
    ],
    W, L, e: 0, r, zc,
    solids: [prism(poly, H), cylinder(0, [0, zc], r, -L, L)],
    mainEls: (V) => prismEls(V, poly, H),
    X: (y) => (inc ? W - Math.abs(y) : W),
    fv: [-90, 90],
    edgeOn: !inc,
    s1: inc
      ? `Draw XY. The prism has a ${s} mm square base turned so that its faces are equally inclined to the VP. The top view is that square with its diagonal ${round(2 * W)} mm across, parallel to XY. The front view is a rectangle ${round(2 * W)} mm wide and ${H} mm high with a middle edge, and so is the side view. The thin lines mark where the cylinder will cut the right and left edges.`
      : `Draw XY. The prism has a ${s} mm square base with an edge parallel to the VP. The top view is that square, and the front view and the side view are rectangles ${s} mm wide and ${H} mm high. The thin lines mark where the cylinder will cut the sides.`,
    s2: `The horizontal cylinder (diameter ${i.branchDiameter} mm) has its axis ${mm(zc)} above the base, parallel to the VP and meeting the vertical axis. In the side view you look along it, so it is a circle. In the front view it is a rectangle and in the top view a strip ${i.branchDiameter} mm wide. Its lines stop where they meet the prism.`,
    mid: (V, pts) => [
      depthStep(V, pts, "Find the points in the top view",
        inc
          ? `Each point is ${mm(r)}·cos θ from the centre line in the side view, which is its depth in the top view. Draw a line across the top view at that depth. Each point lies where this line meets a face of the prism (the sides of the square), on the right and on the left. Points that share a depth, such as 2 and 12, land on the same spot.`
          : `Each point is ${mm(r)}·cos θ from the centre line in the side view, which is its depth in the top view. Draw a line across the top view at that depth. The cylinder meets the left and right faces square-on, so every point lies where this line meets those faces (the vertical sides of the square).`),
      projectStep(V, pts, "From each point in the top view draw a vertical line up to the front view. From the same numbered point in the side view draw a horizontal line across to the front view. Where they cross is the front view of that point."),
    ],
    last: inc
      ? `Join the points in order. Each face is a plane, so the curve on it is part of an ellipse; because the faces are at 45° to the VP it appears in the front view as an arc of a circle of radius ${mm(r)} about the edge. The curve on the back faces is directly behind the one on the front faces, so it is hidden and has the same outline. The lines of the cylinder stop where they meet these arcs.`
      : `The cylinder meets each of the two side faces at right angles, so the curve of intersection on each is a circle of radius ${mm(r)}. In the front view and the top view that circle is seen edge-on as a straight line along the face, and in the side view it is the circle you already drew. The lines of the cylinder stop at the faces.`,
  });
}
