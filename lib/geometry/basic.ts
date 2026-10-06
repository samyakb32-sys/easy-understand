import type { Point } from "../schema";

const rad = (d: number) => (d * Math.PI) / 180;
export const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Intersections of two circles. Returns [] when they do not meet. */
export function circleIntersections(c1: Point, r1: number, c2: Point, r2: number): Point[] {
  const dx = c2[0] - c1[0];
  const dy = c2[1] - c1[1];
  const d = Math.hypot(dx, dy);
  if (d === 0 || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = c1[0] + (a * dx) / d;
  const my = c1[1] + (a * dy) / d;
  return [
    [mx + (h * dy) / d, my - (h * dx) / d],
    [mx - (h * dy) / d, my + (h * dx) / d],
  ];
}

export type LineProjection = {
  /** Height of B above the HP, depth of B in front of the VP. */
  height: number;
  depth: number;
  /** Front-view length (a'b') and top-view length (ab). */
  frontLength: number;
  topLength: number;
  /** Horizontal separation of the end projectors. */
  dx: number;
  feasible: boolean;
};

/**
 * Line of true length L inclined theta to the HP and phi to the VP.
 * Feasible only if sin^2(theta) + sin^2(phi) <= 1.
 */
export function lineProjection(L: number, theta: number, phi: number): LineProjection {
  const height = L * Math.sin(rad(theta));
  const depth = L * Math.sin(rad(phi));
  const frontLength = L * Math.cos(rad(phi));
  const topLength = L * Math.cos(rad(theta));
  const sq = frontLength ** 2 - height ** 2;
  return { height, depth, frontLength, topLength, dx: Math.sqrt(Math.max(0, sq)), feasible: sq >= -1e-9 };
}

/** Regular pentagon on a given side, base AB along the x axis from (0,0). Vertices in order A,B,C,D,E. */
export function pentagonOnBase(s: number) {
  const diag = (s * (1 + Math.sqrt(5))) / 2;
  const A: Point = [0, 0];
  const B: Point = [s, 0];
  const pick = (pts: Point[], wantLeft: boolean): Point =>
    (pts.filter((p) => p[1] > 0).sort((p, q) => (wantLeft ? p[0] - q[0] : q[0] - p[0])) as Point[])[0];
  const apex = circleIntersections(A, diag, B, diag).find((p) => p[1] > 0)!;
  const E = pick(circleIntersections(A, s, B, diag), true); // adjacent to A
  const C = pick(circleIntersections(B, s, A, diag), false); // adjacent to B
  return { A, B, C, D: apex, E, diag };
}
