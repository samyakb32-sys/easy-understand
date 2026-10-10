import { describe, expect, it } from "vitest";
import { solveIsometricComposite } from "@/lib/geometry/composite";
import { ISO_SCALE } from "@/lib/geometry/isometric";
import { solveIsometricRow } from "@/lib/geometry/isoextra";
import { solveCylinderPenetration } from "@/lib/geometry/penetration";
import { solveOffsetCylinders, solvePrismCylinder } from "@/lib/geometry/penetration2";
import type { Point, Solution } from "@/lib/schema";

const C30 = Math.cos(Math.PI / 6);
const solved = (r: { ok: boolean }) => {
  if (!r.ok) throw new Error((r as unknown as { reason: string }).reason);
  return (r as unknown as { solution: Solution }).solution;
};
const reason = (r: { ok: boolean }) => (r.ok ? "" : (r as unknown as { reason: string }).reason);

describe("row: solids share one axis across the row", () => {
  const H = 20;
  const unprojectAt = (p: Point, z0: number): [number, number] => {
    const d = p[0] / (C30 * ISO_SCALE), s = 2 * (p[1] / ISO_SCALE - z0);
    return [(s + d) / 2, (s - d) / 2];
  };
  it.each([["triangle", 3], ["pentagon", 5], ["hexagon", 6]] as const)("%s prism and a cylinder have their axes in line", (base, n) => {
    for (const along of ["x", "y"] as const) {
      const ci = along === "x" ? 1 : 0; // the plan coordinate across the row
      const s = solved(solveIsometricRow({ parts: [{ kind: "prism", base, side: 40, height: H }, { kind: "cylinder", diameter: 30, height: 30 }], gap: 30, along, scale: "isometric" }));
      // the nearest solid is never clipped: its top face is a closed polygon with one vertex per base corner, drawn at z = H
      const top = s.steps[2].primitives.find((p) => p.t === "poly" && p.pts.length >= n + 1 && p.pts[0][0] === p.pts[p.pts.length - 1][0] && p.pts[0][1] === p.pts[p.pts.length - 1][1]) as { pts: Point[] } | undefined;
      expect(top).toBeDefined();
      const prismAxis = top!.pts.slice(0, n).map((q) => unprojectAt(q, H)[ci]).reduce((a, b) => a + b, 0) / n;
      // the cylinder's base rhombus (last polygon of the bases step) is symmetric about its axis
      const polys = s.steps[1].primitives.filter((p) => p.t === "poly") as { pts: Point[] }[];
      const rh = polys[polys.length - 1].pts.map((q) => unprojectAt(q, 0)[ci]);
      expect(prismAxis).toBeCloseTo((Math.min(...rh) + Math.max(...rh)) / 2, 3);
    }
  });
});

describe("hidden solids", () => {
  const empty = (s: Solution) => s.steps.filter((st) => st.primitives.length === 0);
  it("a wholly hidden solid in a row says so instead of telling the student to draw it", () => {
    const s = solved(solveIsometricRow({ parts: [{ kind: "prism", base: "square", side: 40, height: 100 }, { kind: "sphere", diameter: 10 }], gap: 0, along: "x", scale: "isometric" }));
    expect(empty(s).length).toBeGreaterThan(0);
    for (const st of empty(s)) expect(st.explanation).toMatch(/completely hidden/);
    for (const st of s.steps.filter((x) => x.primitives.length > 0)) expect(st.explanation).not.toMatch(/completely hidden/);
  });
  it("a wholly hidden lower part of a composite says so", () => {
    const s = solved(solveIsometricComposite({ parts: [{ kind: "cylinder", diameter: 10, height: 5 }, { kind: "cylinder", diameter: 60, height: 20 }], scale: "isometric" }));
    expect(empty(s).length).toBeGreaterThan(0);
    for (const st of empty(s).filter((x) => x.style === "outline")) expect(st.explanation).toMatch(/completely hidden/);
  });
});

describe("branch wider than the main solid is tall", () => {
  const msg = [
    reason(solveCylinderPenetration({ mainDiameter: 100, mainHeight: 30, branchDiameter: 40 })),
    reason(solveOffsetCylinders({ mainDiameter: 100, mainHeight: 30, branchDiameter: 40, offset: 10 })),
    reason(solvePrismCylinder({ side: 100, height: 30, branchDiameter: 40 })),
  ];
  it.each([0, 1, 2])("refusal %i names the diameter, not an inverted range", (i) => {
    expect(msg[i]).toMatch(/diameter/);
    expect(msg[i]).toMatch(/at most 30 mm/);
    expect(msg[i]).not.toMatch(/between/);
  });
  it("still gives the range when the axis is merely too high", () => {
    expect(reason(solveCylinderPenetration({ mainDiameter: 100, mainHeight: 60, branchDiameter: 20, axisHeight: 55 }))).toMatch(/between 10 mm and 50 mm/);
  });
});
