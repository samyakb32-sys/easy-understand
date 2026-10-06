import { describe, expect, it } from "vitest";
import { lineProjection, pentagonOnBase } from "@/lib/geometry/basic";
import { solveLineProjection } from "@/lib/geometry/solvers";
import { SAMPLES } from "@/lib/samples";
import { Solution } from "@/lib/schema";
import { buildTimeline } from "@/lib/timeline";

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("line projection", () => {
  it("reproduces the true length from the two views", () => {
    const L = 60;
    const p = lineProjection(L, 30, 45);
    expect(p.feasible).toBe(true);
    // 3D length from dx, depth, height must equal L
    expect(Math.sqrt(p.dx ** 2 + p.depth ** 2 + p.height ** 2)).toBeCloseTo(L, 6);
    expect(p.frontLength).toBeCloseTo(L * Math.cos(Math.PI / 4), 6);
  });
  it("rejects impossible inclinations", () => {
    const r = solveLineProjection(50, 60, 60);
    expect(r.ok).toBe(false);
  });
});

describe("pentagon", () => {
  it("has five equal sides and equal diagonals", () => {
    const s = 30;
    const { A, B, C, D, E } = pentagonOnBase(s);
    const v = [A, B, C, D, E];
    for (let i = 0; i < 5; i++) expect(dist(v[i], v[(i + 1) % 5])).toBeCloseTo(s, 6);
    const d = dist(A, D);
    expect(dist(B, E)).toBeCloseTo(d, 6);
    expect(dist(C, A)).toBeCloseTo(d, 6);
  });
});

describe("samples", () => {
  it.each(Object.entries(SAMPLES))("%s validates and has a timeline", (_k, sol) => {
    expect(Solution.safeParse(sol).success).toBe(true);
    const tl = buildTimeline(sol);
    expect(tl.total).toBeGreaterThan(0);
    expect(tl.stepStarts).toHaveLength(sol.steps.length);
  });
});
