import { describe, expect, it } from "vitest";
import { ellipsePerimeter } from "@/lib/geometry/basic";
import { ISO_SCALE, isoPoint, solveIsometricCylinder, solveIsometricPrism } from "@/lib/geometry/isometric";
import { solveSectionPolyhedron, solveSectionRound } from "@/lib/geometry/sections";
import { cutPolyhedron, polygonArea, prismPoly, pyramidPoly, regularPolygon } from "@/lib/geometry/solvers-support";
import { solveTemplate, Template } from "@/lib/geometry/solvers";
import { SAMPLES } from "@/lib/samples";
import { Solution } from "@/lib/schema";
import { buildTimeline, primitiveLength } from "@/lib/timeline";

/** Lines in a step drawn as firm outline (visible edges); hidden ones are thin construction lines. */
const stepLines = (sol: Solution, title: RegExp) => {
  const step = sol.steps.find((s) => title.test(s.title))!;
  return step.primitives.filter((p) => p.t === "line" && (p.style ?? step.style) === "outline");
};

describe("isometric projection", () => {
  it("draws axes 30° from horizontal and keeps lengths along an axis", () => {
    const [x, y] = isoPoint(10, 0, 0, 1);
    expect(Math.hypot(x, y)).toBeCloseTo(10, 9);
    expect((Math.atan2(y, x) * 180) / Math.PI).toBeCloseTo(30, 9);
    expect(isoPoint(0, 0, 10, 1)).toEqual([0, 10]);
    expect(Math.hypot(...isoPoint(10, 0, 0, ISO_SCALE))).toBeCloseTo(8.165, 3);
  });

  it("matches the ellipse axes used for a circle (major 1.2247 r k, minor 0.7071 r k)", () => {
    const r = 20, k = ISO_SCALE;
    let maxX = 0, maxY = 0;
    for (let a = 0; a < 360; a += 0.5) {
      const [px, py] = isoPoint(r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180), 0, k);
      maxX = Math.max(maxX, Math.abs(px));
      maxY = Math.max(maxY, Math.abs(py));
    }
    const sol = solveIsometricCylinder({ diameter: 40, height: 50, scale: "isometric" }).solution;
    const e = sol.steps[2].primitives.find((p) => p.t === "ellipse")!;
    if (e.t !== "ellipse") throw new Error("expected an ellipse");
    expect(e.rx).toBeCloseTo(maxX, 2);
    expect(e.ry).toBeCloseTo(maxY, 2);
  });

  it("shows 3 vertical and 2 base edges of a cuboid (9 visible edges in all)", () => {
    const r = solveIsometricPrism({ base: "rectangle", side: 50, width: 30, height: 40, scale: "true" });
    if (!r.ok) throw new Error(r.reason);
    expect(stepLines(r.solution, /Raise/)).toHaveLength(3);
    expect(stepLines(r.solution, /Final/)).toHaveLength(2);
  });

  it.each([
    ["hexagon", 4], // three visible faces share four vertical edges
    ["triangle", 3],
    ["pentagon", 3], // only the -90° and 198° face normals point at the viewer, and they are adjacent
  ] as const)("hides the far side of a %s prism", (base, verticals) => {
    const r = solveIsometricPrism({ base, side: 25, height: 40, scale: "isometric" });
    if (!r.ok) throw new Error(r.reason);
    expect(stepLines(r.solution, /Raise/)).toHaveLength(verticals);
  });

  it("asks for a width when the base is a rectangle", () => {
    expect(solveIsometricPrism({ base: "rectangle", side: 50, height: 40, scale: "true" }).ok).toBe(false);
  });
});

describe("sections of solids", () => {
  it("cuts a square prism into a rectangle with the right true size", () => {
    const base = regularPolygon(4, 40);
    const cut = cutPolyhedron(prismPoly(base, 70), 35, 30);
    expect(cut).toHaveLength(4);
    // true shape: 40 wide (depth) by 40 / cos30 long
    const area = polygonArea(cut.map((c) => [c.s, c.p[1]]));
    expect(area).toBeCloseTo(40 * (40 / Math.cos(Math.PI / 6)), 6);
    // every corner lies on the plane z = k + x tan(theta)
    for (const c of cut) expect(c.p[2]).toBeCloseTo(35 + c.p[0] * Math.tan(Math.PI / 6), 9);
  });

  it("gives a 4-cornered section for a square pyramid cut across its lateral edges", () => {
    const cut = cutPolyhedron(pyramidPoly(regularPolygon(4, 40), 60), 20, 30);
    expect(cut).toHaveLength(4);
    for (const c of cut) {
      expect(c.p[2]).toBeCloseTo(20 + c.p[0] * Math.tan(Math.PI / 6), 9);
      expect(c.p[2]).toBeGreaterThanOrEqual(0);
      expect(c.p[2]).toBeLessThanOrEqual(60);
    }
  });

  it("returns nothing when the plane misses the solid", () => {
    expect(cutPolyhedron(prismPoly(regularPolygon(4, 40), 70), 300, 30)).toEqual([]);
    expect(solveSectionPolyhedron({ solid: "prism", base: "square", side: 40, height: 70, angle: 30, axisHeight: 300 }).ok).toBe(false);
  });

  it("makes a hexagonal prism section with 6 corners and a horizontal cut equal to the base area", () => {
    const base = regularPolygon(6, 25);
    const flat = cutPolyhedron(prismPoly(base, 70), 35, 1e-6 + 0.0001);
    expect(polygonArea(flat.map((c) => [c.p[0], c.p[1]]))).toBeCloseTo(polygonArea(base), 3);
    expect(cutPolyhedron(prismPoly(base, 70), 35, 30)).toHaveLength(6);
  });

  it("finds the ellipse of an oblique cut through a cylinder (area = pi r^2 / cos theta)", () => {
    const r = solveSectionRound({ solid: "cylinder", diameter: 40, height: 70, angle: 30, axisHeight: 35 });
    if (!r.ok) throw new Error(r.reason);
    const last = r.solution.steps.at(-1)!;
    expect(last.explanation).toMatch(/an ellipse/);
    const m = last.explanation.match(/area of about ([\d.]+)/)!;
    const exact = (Math.PI * 20 * 20) / Math.cos(Math.PI / 6);
    expect(Math.abs(+m[1] - exact) / exact).toBeLessThan(0.005);
  });

  it("explains when the plane leaves through the base", () => {
    const r = solveSectionRound({ solid: "cylinder", diameter: 40, height: 70, angle: 30, axisHeight: 5 });
    expect(r.ok).toBe(false);
  });

  it("handles a cone cut by a plane that stays inside it", () => {
    const r = solveSectionRound({ solid: "cone", diameter: 50, height: 80, angle: 10, axisHeight: 30 });
    expect(r.ok).toBe(true);
  });
});

describe("templates and samples", () => {
  it("parses the new templates and fills the default scale", () => {
    const t = Template.parse({ template: "isometric_prism", base: "hexagon", side: 25, height: 40 });
    expect(t.template === "isometric_prism" && t.scale).toBe("isometric");
    expect(solveTemplate(t).ok).toBe(true);
    expect(Template.safeParse({ template: "section_round", solid: "cone", diameter: 50, height: 80, angle: 95, axisHeight: 10 }).success).toBe(false);
  });

  it.each(Object.entries(SAMPLES))("sample %s is valid and plays in a sensible time", (_k, sol) => {
    expect(Solution.safeParse(sol).success).toBe(true);
    const tl = buildTimeline(sol);
    expect(tl.total).toBeLessThan(sol.steps.length * 9);
  });

  it("measures ellipse and poly lengths for the timeline", () => {
    expect(primitiveLength({ t: "ellipse", c: [0, 0], rx: 10, ry: 10 })).toBeCloseTo(2 * Math.PI * 10, 6);
    expect(primitiveLength({ t: "poly", pts: [[0, 0], [3, 4]], closed: true })).toBeCloseTo(10, 9);
    expect(ellipsePerimeter(5, 5)).toBeCloseTo(2 * Math.PI * 5, 9);
  });
});
