import type { Point } from "../schema";

export type Vec3 = [number, number, number];
export type RegularBase = "triangle" | "square" | "pentagon" | "hexagon";
export const SIDES: Record<RegularBase, number> = { triangle: 3, square: 4, pentagon: 5, hexagon: 6 };

/** Regular polygon, counter-clockwise, centred on the origin, with one edge horizontal at the bottom. */
export function regularPolygon(n: number, side: number): Point[] {
  const R = side / (2 * Math.sin(Math.PI / n));
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n + Math.PI / n - Math.PI / 2;
    return [R * Math.cos(a), R * Math.sin(a)] as Point;
  });
}

export function polygonArea(pts: Point[]): number {
  let s = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    s += p[0] * q[1] - q[0] * p[1];
  });
  return Math.abs(s) / 2;
}

export const polygonCentroid = (pts: Point[]): Point => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];

/** Outward horizontal normal of edge i of a counter-clockwise polygon. */
export function edgeNormal(pts: Point[], i: number): Point {
  const a = pts[i], b = pts[(i + 1) % pts.length];
  return [b[1] - a[1], -(b[0] - a[0])];
}

/** Solid as vertices and edges. Coordinates are (x, y, z): x right, y into the plan view (away from the viewer in the top view), z up. */
export type Poly = { verts: Vec3[]; edges: [number, number][] };

export function prismPoly(base: Point[], h: number): Poly {
  const n = base.length;
  const verts: Vec3[] = [...base.map(([x, y]) => [x, y, 0] as Vec3), ...base.map(([x, y]) => [x, y, h] as Vec3)];
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) edges.push([i, (i + 1) % n], [n + i, n + ((i + 1) % n)], [i, n + i]);
  return { verts, edges };
}

export function pyramidPoly(base: Point[], h: number): Poly {
  const n = base.length;
  const [cx, cy] = polygonCentroid(base);
  const verts: Vec3[] = [...base.map(([x, y]) => [x, y, 0] as Vec3), [cx, cy, h]];
  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) edges.push([i, (i + 1) % n], [i, n]);
  return { verts, edges };
}

export type SectionPoint = { p: Vec3; /** distance along the cutting line from the axis point */ s: number };

/**
 * Cuts a convex solid with the plane  z = k + x·tanθ  (perpendicular to the VP, through the axis at height k).
 * Returns the section polygon's corners ordered around the polygon, or [] if the plane misses the solid.
 */
export function cutPolyhedron(poly: Poly, k: number, thetaDeg: number): SectionPoint[] {
  const th = (thetaDeg * Math.PI) / 180;
  const f = (v: Vec3) => v[2] - k - v[0] * Math.tan(th);
  const eps = 1e-7;
  const pts: Vec3[] = [];
  const push = (v: Vec3) => { if (!pts.some((q) => Math.hypot(q[0] - v[0], q[1] - v[1], q[2] - v[2]) < 1e-6)) pts.push(v); };
  for (const [i, j] of poly.edges) {
    const a = poly.verts[i], b = poly.verts[j];
    const fa = f(a), fb = f(b);
    if (Math.abs(fa) < eps) push(a);
    if (Math.abs(fb) < eps) push(b);
    if ((fa > eps && fb < -eps) || (fa < -eps && fb > eps)) {
      const t = fa / (fa - fb);
      push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  if (pts.length < 3) return [];
  const withS = pts.map((p) => ({ p, s: p[0] / Math.cos(th) }));
  // a convex polygon's corners sort by angle round their centre, measured in the plane's own coordinates (s, y)
  const cs = withS.reduce((a, q) => a + q.s, 0) / withS.length;
  const cy = withS.reduce((a, q) => a + q.p[1], 0) / withS.length;
  return withS.sort((a, b) => Math.atan2(a.p[1] - cy, a.s - cs) - Math.atan2(b.p[1] - cy, b.s - cs));
}
