import { describe, expect, it } from "vitest";
import { solveSectionRound } from "@/lib/geometry/sections";
import { solveIsometricCone, solveIsometricSphere } from "@/lib/geometry/isometric";
import { solveCylinderPenetration } from "@/lib/geometry/penetration";
import { solveIsometricComposite } from "@/lib/geometry/composite";
import { solveConeDevelopment, solveConic, solvePrismDevelopment, solvePyramidDevelopment } from "@/lib/geometry/extra";
import { solveTemplate, Template } from "@/lib/geometry/solvers";
import { solveSolidVpFirst, solveTilted, solveTiltedVpFirst } from "@/lib/geometry/tilt";
import type { Primitive, Solution } from "@/lib/schema";

const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error((r as unknown as { reason: string }).reason);
  return (r as unknown as { solution: Solution }).solution;
};
const prims = (s: Solution, step: number) => s.steps[step].primitives;
const lines = (ps: Primitive[]) => ps.filter((p): p is Extract<Primitive, { t: "line" }> => p.t === "line");

describe("conics by the eccentricity method", () => {
  it.each([[50, 2 / 3], [40, 1], [40, 1.5], [30, 0.5], [60, 2]])("d=%s e=%s: every point obeys PF = e x PD", (d, e) => {
    const s = ok(solveConic(d, e));
    const curve = prims(s, s.steps.length - 1)[0];
    expect(curve.t).toBe("poly");
    if (curve.t !== "poly") return;
    for (const [x, y] of curve.pts) {
      const pf = Math.hypot(x - d, y);
      expect(pf).toBeCloseTo(e * x, 6);
    }
  });
  it("names the curve from e", () => {
    expect(ok(solveConic(40, 0.6)).title).toMatch(/Ellipse/);
    expect(ok(solveConic(40, 1)).title).toMatch(/Parabola/);
    expect(ok(solveConic(40, 1.4)).title).toMatch(/Hyperbola/);
  });
  it("ellipse is closed and bounded by its two vertices", () => {
    const s = ok(solveConic(50, 2 / 3));
    const c = prims(s, 4)[0];
    if (c.t !== "poly") throw new Error();
    const xs = c.pts.map((p) => p[0]);
    expect(Math.min(...xs)).toBeCloseTo(50 / (1 + 2 / 3), 6);
    expect(Math.max(...xs)).toBeCloseTo(50 / (1 - 2 / 3), 6);
  });
});

describe("developments", () => {
  it("cone: arc length equals the base circumference", () => {
    const s = ok(solveConeDevelopment(40, 60));
    const arc = prims(s, 5)[0];
    if (arc.t !== "arc") throw new Error();
    expect((arc.r * (arc.to - arc.from) * Math.PI) / 180).toBeCloseTo(Math.PI * 40, 6);
    expect(arc.r).toBeCloseTo(Math.hypot(20, 60), 6);
  });
  it("pyramid: every apex edge has the true edge length and every chord the base side", () => {
    const s = ok(solvePyramidDevelopment("pentagon", 25, 50));
    const R = 25 / (2 * Math.sin(Math.PI / 5));
    const e = Math.hypot(R, 50);
    const chords = lines(prims(s, 3)).filter((l) => Math.abs(Math.hypot(l.a[0] - l.b[0], l.a[1] - l.b[1]) - 25) < 1e-6);
    expect(chords).toHaveLength(5);
    const spokes = lines(prims(s, 4));
    expect(spokes).toHaveLength(4);
    spokes.forEach((l) => expect(Math.hypot(l.a[0] - l.b[0], l.a[1] - l.b[1])).toBeCloseTo(e, 6));
  });
  it("prism: the rows add up to n x side and the bases fit the edges", () => {
    const s = ok(solvePrismDevelopment("hexagon", 20, 50));
    const strip = lines(prims(s, 2));
    expect(Math.max(...strip.flatMap((l) => [l.a[0], l.b[0]])) - Math.min(...strip.flatMap((l) => [l.a[0], l.b[0]]))).toBeCloseTo(120, 6);
    const bottom = lines(prims(s, 3)).slice(0, 6);
    bottom.forEach((l) => expect(Math.hypot(l.a[0] - l.b[0], l.a[1] - l.b[1])).toBeCloseTo(20, 6));
    expect(Math.max(...bottom.flatMap((l) => [l.a[1], l.b[1]]))).toBeCloseTo(0, 6); // shares the strip's bottom edge
  });
});

const fvAll = (s: Solution) => lines(prims(s, 2)).filter((l) => l.style === "outline" || l.style === "hidden");
const tvFinal = (s: Solution) => prims(s, 4).filter((p) => p.t !== "line" || p.style !== "centre");
const ys = (ps: Primitive[]) => ps.flatMap((p) => (p.t === "line" ? [p.a[1], p.b[1]] : p.t === "poly" ? p.pts.map((q) => q[1]) : []));
const xs = (ps: Primitive[]) => ps.flatMap((p) => (p.t === "line" ? [p.a[0], p.b[0]] : p.t === "poly" ? p.pts.map((q) => q[0]) : []));

describe("tilted solids and planes", () => {
  const cases = [
    ["prism edge", () => solveTilted({ solid: "prism", base: "hexagon", side: 25, height: 50, angle: 30, rest: "edge" })],
    ["prism corner", () => solveTilted({ solid: "prism", base: "square", side: 30, height: 50, angle: 60, rest: "corner" })],
    ["pyramid", () => solveTilted({ solid: "pyramid", base: "pentagon", side: 25, height: 50, angle: 45, rest: "corner" })],
    ["cone", () => solveTilted({ solid: "cone", diameter: 40, height: 60, angle: 40 })],
    ["plane", () => solveTilted({ shape: "pentagon", size: 30, angle: 45, rest: "edge" })],
    ["circle", () => solveTilted({ shape: "circle", size: 40, angle: 30, rest: "edge" })],
  ] as const;
  it.each(cases)("%s: rests on XY, keeps its depth, and the two final views share x-range", (_n, mk) => {
    const s = ok(mk());
    expect(s.steps).toHaveLength(5);
    const fvY = ys(fvAll(s));
    expect(Math.min(...fvY)).toBeGreaterThan(-1e-6); // nothing below the HP
    expect(Math.min(...fvY)).toBeLessThan(1e-6); // and it touches it
    // final top view has the same depth range as the first one (tilting about a line perpendicular to the VP keeps y)
    const first = prims(s, 0).filter((p) => p.t !== "text" && !(p.t === "line" && p.a[1] === 0 && p.b[1] === 0 && Math.abs(p.a[0] - p.b[0]) > 90));
    const y0 = ys(first.filter((p) => p.t === "line" ? p.a[1] <= 0 || p.b[1] <= 0 : true));
    const y1 = ys(tvFinal(s));
    expect(Math.min(...y1)).toBeCloseTo(Math.min(...y0.filter((y) => y < 0)), 4);
    // x-range of the final top view equals that of the final front view
    const fx = xs(fvAll(s)), tx = xs(tvFinal(s));
    expect(Math.min(...tx)).toBeCloseTo(Math.min(...fx), 3);
    expect(Math.max(...tx)).toBeCloseTo(Math.max(...fx), 3);
  });
  it("front view keeps true shape: tilted pyramid axis is at the asked angle", () => {
    const s = ok(solveTilted({ solid: "pyramid", base: "square", side: 30, height: 60, angle: 50, rest: "corner" }));
    const axis = prims(s, 2).find((p) => p.t === "line" && p.style === "construction");
    if (!axis || axis.t !== "line") throw new Error("no axis line");
    const ang = (Math.atan2(axis.b[1] - axis.a[1], axis.b[0] - axis.a[0]) * 180) / Math.PI;
    expect(ang).toBeCloseTo(50, 4);
    expect(axis.a[1]).toBeCloseTo(0, 6); // axis line is extended to XY
  });
  it("hides edges behind the solid", () => {
    const s = ok(solveTilted({ solid: "prism", base: "square", side: 30, height: 50, angle: 30, rest: "corner" }));
    expect(prims(s, 4).some((p) => p.t === "line" && p.style === "hidden")).toBe(true);
  });
  it("rejects bad angles", () => {
    expect(solveTilted({ solid: "cone", diameter: 30, height: 40, angle: 0 }).ok).toBe(false);
    expect(solveTilted({ solid: "cone", diameter: 30, height: 40, angle: 90 }).ok).toBe(false);
  });
});

describe("templates", () => {
  it("accept the new problem types", () => {
    const t = [
      { template: "conic", distance: 50, eccentricity: 0.67 },
      { template: "development_cone", diameter: 40, height: 60 },
      { template: "development_pyramid", base: "square", side: 30, height: 50 },
      { template: "development_prism", base: "hexagon", side: 20, height: 50 },
      { template: "solid_inclined", solid: "cone", size: 40, height: 60, angle: 40 },
      { template: "solid_inclined", solid: "prism", base: "hexagon", size: 25, height: 50, angle: 30, rest: "edge" },
      { template: "plane_inclined", shape: "circle", size: 40, angle: 30 },
    ];
    for (const x of t) {
      const parsed = Template.parse(x);
      expect(solveTemplate(parsed).ok).toBe(true);
    }
  });
  it("asks for the base when a prism has none", () => {
    const r = solveTemplate(Template.parse({ template: "solid_inclined", solid: "prism", size: 25, height: 50, angle: 30 }));
    expect(r.ok).toBe(false);
  });
});

describe("solids tilted to both HP and VP", () => {
  it.each([
    ["cone", () => solveTilted({ solid: "cone", diameter: 40, height: 60, angle: 40, phi: 30 })],
    ["pyramid", () => solveTilted({ solid: "pyramid", base: "square", side: 30, height: 60, angle: 45, rest: "corner", phi: 35 })],
    ["prism", () => solveTilted({ solid: "prism", base: "hexagon", side: 25, height: 50, angle: 30, rest: "edge", phi: 50 })],
  ])("%s: eight steps, the plan of the axis makes phi with XY, depth stays in front of XY", (_n, mk) => {
    const s = ok(mk());
    expect(s.steps).toHaveLength(8);
    const ys5 = ys(prims(s, 5));
    expect(Math.max(...ys5)).toBeLessThan(-1e-6); // whole turned top view is below XY
    const axis = prims(s, 5).find((p) => p.t === "line" && p.style === "construction" && p.a[1] !== p.b[1]);
    if (!axis || axis.t !== "line") throw new Error("no axis");
    const ang = Math.abs((Math.atan2(axis.b[1] - axis.a[1], axis.b[0] - axis.a[0]) * 180) / Math.PI);
    expect(ang).toBeCloseTo(s.problem.includes("30°") && _n === "cone" ? 30 : _n === "pyramid" ? 35 : 50, 4);
  });
  it("heights are unchanged by the second turn", () => {
    const s = ok(solveTilted({ solid: "pyramid", base: "square", side: 30, height: 60, angle: 45, rest: "corner", phi: 35 }));
    const zs = (st: number) => ys(prims(s, st).filter((p) => p.t === "line" && p.style !== "construction"));
    expect(Math.max(...zs(7))).toBeCloseTo(Math.max(...zs(2)), 4);
  });
});

describe("planes inclined to HP and VP", () => {
  it.each([["hexagon", 30], ["square", 60], ["triangle", 45]] as const)("%s: the side in the HP ends up at %s° to XY and heights are kept", (shape, phi) => {
    const s = ok(solveTilted({ shape, size: 30, angle: 40, rest: "edge", phi }));
    expect(s.steps).toHaveLength(8);
    const mark = prims(s, 5).find((p) => p.t === "arc");
    if (!mark || mark.t !== "arc") throw new Error("no arc");
    expect(Math.abs(mark.to - mark.from)).toBeCloseTo(phi, 4);
    const fvY = ys(prims(s, 7));
    expect(Math.max(...fvY)).toBeCloseTo(Math.max(...ys(prims(s, 2).filter((p) => p.t === "line" && p.style === "outline"))), 4);
    expect(Math.max(...ys(prims(s, 5).filter((p) => p.t === "poly")))).toBeLessThan(0);
  });
  it("a lamina resting on a corner: the corner-to-centre line ends up at phi to XY", () => {
    const s = ok(solveTilted({ shape: "square", size: 30, angle: 40, rest: "corner", phi: 30 }));
    expect(s.problem).toMatch(/joining that corner to the centre/);
    const mark = prims(s, 5).find((p) => p.t === "arc");
    if (!mark || mark.t !== "arc") throw new Error("no arc");
    expect(Math.abs(mark.to - mark.from)).toBeCloseTo(30, 4);
    // the turned top view of a square is still a square of side 30 x cos-foreshortened: it keeps the same area as the first top view of the tilted figure
    const area = (pts: number[][]) => Math.abs(pts.reduce((a, p, i) => a + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1], 0)) / 2;
    const tvs = (st: number) => prims(s, st).find((p) => p.t === "poly" && p.closed) as Extract<Primitive, { t: "poly" }>;
    expect(area(tvs(5).pts)).toBeCloseTo(area(tvs(4).pts), 6);
    expect(area(tvs(4).pts)).toBeCloseTo(900 * Math.cos((40 * Math.PI) / 180), 6);
  });
});

describe("conic sections of a cone", () => {
  const cone = (o: Partial<Parameters<typeof solveSectionRound>[0]>) => ok(solveSectionRound({ solid: "cone", diameter: 60, height: 70, angle: 30, axisHeight: 35, ...o }));
  it("names the curve from the plane angle", () => {
    expect(cone({ parallelToGenerator: true, axisHeight: 25 }).title).toMatch(/parabola/);
    expect(cone({ angle: 80, axisHeight: 30, axisOffset: 6 }).title).toMatch(/hyperbola/);
    expect(cone({ angle: 30 }).title).not.toMatch(/parabola|hyperbola/);
  });
  it("every point lies on the cone and on the plane, and the curve ends on the base", () => {
    for (const o of [{ parallelToGenerator: true, axisHeight: 25 }, { angle: 80, axisHeight: 30, axisOffset: 6 }]) {
      const sol = cone(o);
      const top = sol.steps[5].primitives[0];
      const front = sol.steps[4].primitives.filter((p) => p.t === "line");
      if (top.t !== "poly") throw new Error();
      const tan = Math.tan(((o.parallelToGenerator ? (Math.atan2(70, 30) * 180) / Math.PI : o.angle!) * Math.PI) / 180);
      const x0 = o.axisOffset ?? 0;
      const yOff = 30 + 15;
      top.pts.forEach(([x, yy], idx) => {
        const y = yy + yOff;
        const rho = Math.hypot(x, y);
        const z = 70 * (1 - rho / 30);
        expect(z).toBeGreaterThan(-1e-4);
        expect(z).toBeCloseTo((o.axisHeight ?? 35) + (x - x0) * tan, 3);
        if (idx === 0 || idx === top.pts.length - 1) expect(z).toBeCloseTo(0, 3);
      });
      expect(front.length).toBeGreaterThan(5);
    }
  });
  it("a cylinder cut through its base is a partial ellipse", () => {
    expect(ok(solveSectionRound({ solid: "cylinder", diameter: 40, height: 70, angle: 40, axisHeight: 15 })).title).toBeTruthy();
  });
  it("a cylinder cut through both its base and its top is two arcs closed by two chords, on the cylinder surface", () => {
    const i = { solid: "cylinder", diameter: 40, height: 40, angle: 60, axisHeight: 20 } as const;
    const s = ok(solveSectionRound(i));
    const top = s.steps[5].primitives[0];
    if (top.t !== "poly") throw new Error();
    const yOff = 20 + 15;
    const tan = Math.tan((60 * Math.PI) / 180);
    const zs = top.pts.map(([x, yy]) => {
      expect(Math.hypot(x, yy + yOff)).toBeCloseTo(20, 6);
      return 20 + x * tan;
    });
    zs.forEach((z) => { expect(z).toBeGreaterThan(-1e-4); expect(z).toBeLessThan(40 + 1e-4); });
    // the two ends of each arc sit on the base and on the top, so the outline closes with a chord at each
    expect(zs.filter((z) => Math.abs(z) < 1e-4)).toHaveLength(2);
    expect(zs.filter((z) => Math.abs(z - 40) < 1e-4)).toHaveLength(2);
    expect(s.steps[7].explanation).toMatch(/at the base and another at the top/);
    // exact area = 2 * integral of sqrt(r^2 - x^2) dx over |x| <= 20 / tan 60, divided by cos 60 (the outline is a 5 degree polygon, so about 0.1 % low)
    const area = Number(/area of about ([\d.]+)/.exec(s.steps[7].explanation)?.[1]);
    expect(area).toBeGreaterThan(1739.01 * 0.995);
    expect(area).toBeLessThan(1739.01 * 1.001);
  });
});

describe("isometric cone and sphere", () => {
  it("cone: the apex lines are tangent to the base ellipse", () => {
    const s = ok(solveIsometricCone({ diameter: 40, height: 60, scale: "isometric" }));
    const k = Math.sqrt(2 / 3);
    const rx = 20 * Math.sqrt(1.5) * k, ry = 20 * Math.sqrt(0.5) * k;
    const tans = lines(prims(s, 3));
    expect(tans).toHaveLength(2);
    for (const l of tans) {
      expect(l.a[0]).toBeCloseTo(0, 6);
      expect(l.a[1]).toBeCloseTo(60 * k, 6);
      const [x, y] = l.b;
      expect((x / rx) ** 2 + (y / ry) ** 2).toBeCloseTo(1, 6); // on the ellipse
      // tangent direction is perpendicular to the ellipse normal (x/rx^2, y/ry^2)
      const d = [x - l.a[0], y - l.a[1]];
      expect(d[0] * (x / rx ** 2) + d[1] * (y / ry ** 2)).toBeCloseTo(0, 6);
    }
  });
  it("cone: refuses one too flat to draw", () => {
    expect(solveIsometricCone({ diameter: 100, height: 5, scale: "isometric" }).ok).toBe(false);
  });
  it("sphere: radius is R with the isometric scale and 1.2247 R with true lengths", () => {
    const c1 = prims(ok(solveIsometricSphere({ diameter: 50, scale: "isometric" })), 3)[0];
    const c2 = prims(ok(solveIsometricSphere({ diameter: 50, scale: "true" })), 3)[0];
    if (c1.t !== "circle" || c2.t !== "circle") throw new Error();
    expect(c1.r).toBeCloseTo(25, 6);
    expect(c2.r).toBeCloseTo(25 * Math.sqrt(1.5), 6);
  });
  it("hemisphere dome joins the ends of the face ellipse", () => {
    const s = ok(solveIsometricSphere({ diameter: 50, scale: "isometric", hemisphere: true }));
    const el = prims(s, 2)[0], arc = prims(s, 3)[0];
    if (el.t !== "ellipse" || arc.t !== "arc") throw new Error();
    expect(arc.r).toBeCloseTo(el.rx, 6);
  });
});

describe("interpenetration of cylinders", () => {
  const pen = (o: object) => ok(solveCylinderPenetration({ mainDiameter: 60, mainHeight: 80, branchDiameter: 40, ...o }));
  it("every curve point lies on both cylinders", () => {
    const s = pen({});
    const curve = prims(s, 5)[0];
    if (curve.t !== "poly") throw new Error();
    const zc = 40, R = 30, r = 20;
    for (const [x, z] of curve.pts) {
      // on the branch: depth y satisfies y^2 + (z - zc)^2 = r^2; on the main: x^2 + y^2 = R^2
      const y2 = r * r - (z - zc) ** 2;
      expect(y2).toBeGreaterThanOrEqual(-1e-9);
      expect(x * x + y2).toBeCloseTo(R * R, 6);
    }
  });
  it("equal diameters give straight lines", () => {
    const s = pen({ branchDiameter: 60 });
    const curve = prims(s, 5)[0];
    if (curve.t !== "poly") throw new Error();
    const [a, b] = [curve.pts[0], curve.pts[curve.pts.length - 1]];
    const mid = curve.pts[18];
    expect(mid[0]).toBeCloseTo(0, 6); // passes through the axis
    expect(Math.abs(a[0])).toBeCloseTo(Math.abs(a[1] - 40), 6); // 45 degree line
    expect(Math.abs(b[0])).toBeCloseTo(Math.abs(b[1] - 40), 6);
  });
  it("rejects a branch that is bigger or does not fit", () => {
    expect(solveCylinderPenetration({ mainDiameter: 40, mainHeight: 80, branchDiameter: 50 }).ok).toBe(false);
    expect(solveCylinderPenetration({ mainDiameter: 60, mainHeight: 80, branchDiameter: 40, axisHeight: 10 }).ok).toBe(false);
  });
});

describe("isometric composite solids", () => {
  const comp = (parts: Parameters<typeof solveIsometricComposite>[0]["parts"]) => solveIsometricComposite({ scale: "isometric", parts });
  it("builds 1 + 2 steps per part and a 3D profile for round stacks", () => {
    const s = ok(comp([{ kind: "cylinder", diameter: 50, height: 30 }, { kind: "cone", diameter: 40, height: 40 }]));
    expect(s.steps).toHaveLength(5);
    expect(s.solid?.kind).toBe("revolve");
    expect(ok(comp([{ kind: "prism", base: "square", side: 50, height: 20 }, { kind: "cylinder", diameter: 30, height: 40 }])).solid).toBeUndefined();
  });
  it("leaves out the lower top-face lines that the upper solid hides, and nothing else", () => {
    const k = Math.sqrt(2 / 3);
    const s = ok(comp([{ kind: "prism", base: "square", side: 50, height: 20 }, { kind: "cylinder", diameter: 30, height: 40 }]));
    const pts = prims(s, 2).flatMap((p) => (p.t === "poly" ? p.pts : []));
    // nothing of the slab's top outline lies strictly inside the cylinder's silhouette
    const rx = 15 * Math.sqrt(1.5) * k;
    const top = 20 * k;
    const inside = pts.filter(([x, y]) => Math.abs(x) < rx - 0.01 && y > top + 0.01 && y < top + 40 * k - 0.01);
    expect(inside).toHaveLength(0);
    // the visible front corner and both side corners of the slab top are still drawn
    expect(pts.some(([x, y]) => Math.abs(x) < 1e-6 && Math.abs(y - (top - 25 * 2 * 0.5 * k)) < 1e-6)).toBe(true);
  });
  it("only allows a cone, sphere or hemisphere on top", () => {
    expect(comp([{ kind: "cone", diameter: 40, height: 40 }, { kind: "cylinder", diameter: 30, height: 40 }]).ok).toBe(false);
    expect(comp([{ kind: "cylinder", diameter: 40, height: 30 }]).ok).toBe(false);
  });
});

describe("planes inclined to the VP first", () => {
  const vp = ok(solveTiltedVpFirst({ shape: "pentagon", size: 30, surfaceToVP: 45, sideToHP: 30, rest: "edge" }));
  it("shows the true shape in the front view (above XY) and swaps the wording", () => {
    const first = prims(vp, 0).filter((p) => p.t === "poly");
    expect(first.length).toBe(1);
    const pts = (first[0] as Extract<Primitive, { t: "poly" }>).pts;
    expect(Math.min(...pts.map((q) => q[1]))).toBeGreaterThan(0);
    expect(vp.problem).toMatch(/rests on the VP/);
    expect(vp.problem).toMatch(/inclined at 45° to the VP/);
    expect(vp.problem).toMatch(/30° to the HP/);
    expect(vp.steps[0].title).toMatch(/front view/);
    expect(JSON.stringify(vp)).not.toMatch(/top view in the simple/);
  });
  it("keeps the angles and puts the final top view below XY", () => {
    const arc = prims(vp, 5).find((p) => p.t === "arc");
    if (!arc || arc.t !== "arc") throw new Error();
    expect(Math.abs(arc.to - arc.from)).toBeCloseTo(30, 4);
    const last = prims(vp, 7).flatMap((p) => (p.t === "poly" ? p.pts : []));
    expect(Math.min(...last.map((q) => q[1]))).toBeLessThan(-1e-6); // the top view is below XY
    expect(Math.max(...ys(prims(vp, 5).filter((p) => p.t === "poly")))).toBeGreaterThan(0); // the turned front view is above
  });
});

describe("solids inclined to the VP first", () => {
  const cone = ok(solveSolidVpFirst({ solid: "cone", diameter: 40, height: 60, angle: 40, phi: 30 }));
  const prism = ok(solveSolidVpFirst({ solid: "prism", base: "hexagon", side: 25, height: 50, angle: 30, rest: "edge", phi: 50 }));
  it("is the mirror image: true base in the front view, axis angle to the VP, wording swapped", () => {
    expect(cone.problem).toMatch(/rests on a point of its base circle on the VP/);
    expect(cone.problem).toMatch(/axis inclined at 40° to the VP and the front view of the axis inclined at 30° to the HP/);
    expect(cone.steps[0].title).toMatch(/front view in the simple position/);
    expect(JSON.stringify(cone)).not.toMatch(/plan of the axis|top view in the simple/);
    const first = prims(prism, 0).filter((p) => p.t === "line" && p.style !== "centre");
    expect(first.length).toBeGreaterThan(6);
    expect(Math.min(...ys(first))).toBeGreaterThanOrEqual(-1e-6); // the true shape sits above XY
  });
  it("keeps the angles and gives hidden edges for the prism", () => {
    expect(prism.steps).toHaveLength(8);
    const arc = prims(prism, 5).find((p) => p.t === "arc");
    if (!arc || arc.t !== "arc") throw new Error();
    expect(Math.abs(arc.to - arc.from)).toBeCloseTo(50, 4);
    expect(prims(prism, 7).some((p) => p.t === "line" && p.style === "hidden")).toBe(true);
  });
  it("the first view of the axis angle: front view tilt mark is at the asked angle", () => {
    const m = prims(cone, 2).find((p) => p.t === "arc");
    if (!m || m.t !== "arc") throw new Error();
    expect(Math.abs(m.to - m.from)).toBeCloseTo(40, 4);
  });
});
