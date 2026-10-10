import { describe, expect, it } from "vitest";
import { SAMPLES } from "@/lib/samples";
import { solveConic, solvePyramidDevelopment } from "@/lib/geometry/extra";
import { solveSectionPolyhedron, solveSectionRound } from "@/lib/geometry/sections";
import { solveSolidVpFirst, solveTilted, solveTiltedVpFirst } from "@/lib/geometry/tilt";
import type { Point, Primitive, Solution } from "@/lib/schema";

const ok = (r: { ok: true; solution: Solution } | { ok: false; reason: string }): Solution => {
  if (!r.ok) throw new Error(r.reason);
  return r.solution;
};
type L = Extract<Primitive, { t: "line" }>;
const lines = (ps: Primitive[]) => ps.filter((p): p is L => p.t === "line");
const len = (l: L) => Math.hypot(l.a[0] - l.b[0], l.a[1] - l.b[1]);
const onSeg = (p: Point, l: L, tol = 1e-6) => {
  const dx = l.b[0] - l.a[0], dy = l.b[1] - l.a[1], n = dx * dx + dy * dy;
  const t = n ? Math.max(0, Math.min(1, ((p[0] - l.a[0]) * dx + (p[1] - l.a[1]) * dy) / n)) : 0;
  return Math.hypot(p[0] - (l.a[0] + t * dx), p[1] - (l.a[1] + t * dy)) < tol;
};
const thick = (st: { style: string }, p: L) => (p.style ?? st.style) === "outline";

describe("tilted cones: no false outline lines", () => {
  it.each(["cone-inclined", "cone-hp-vp", "cone-vp-first"])("%s: the axis-on view is a plain circle with the apex at the centre", (k) => {
    const st = SAMPLES[k].steps[0];
    // the only thick or zero-length line allowed is the XY reference line
    const odd = lines(st.primitives).filter((l) => (thick(st, l) && Math.abs(l.a[1]) > 1e-9) || len(l) < 1e-6);
    expect(odd).toEqual([]);
    expect(st.primitives.some((p) => p.t === "circle" && p.r < 2)).toBe(true); // the apex dot
  });
  it("apex inside the base ellipse: no tangents and the caption says so", () => {
    const s = ok(solveTilted({ solid: "cone", diameter: 60, height: 30, angle: 70 }));
    const fin = s.steps[4];
    expect(lines(fin.primitives).filter((l) => thick(fin, l))).toEqual([]);
    expect(fin.explanation).not.toMatch(/two tangents/);
    expect(fin.explanation).toMatch(/inside the base ellipse/);
    expect(fin.primitives.some((p) => p.t === "poly" && p.style === "outline" && p.pts.length > 30)).toBe(true);
  });
  it("apex outside the base ellipse: two real tangents, as before", () => {
    const s = ok(solveTilted({ solid: "cone", diameter: 40, height: 60, angle: 40 }));
    const fin = s.steps[4];
    expect(lines(fin.primitives).filter((l) => thick(fin, l))).toHaveLength(2);
    expect(fin.explanation).toMatch(/two tangents/);
  });
});

describe("circular lamina: phi is the top view of the diameter through the resting point", () => {
  const phiLine = (phi: number) => {
    const s = ok(solveTilted({ shape: "circle", size: 50, angle: 30, rest: "edge", phi }));
    const st = s.steps.find((x) => x.title.startsWith("Turn the top view"))!;
    const slanted = lines(st.primitives).filter((l) => Math.abs(l.a[1] - l.b[1]) > 1e-6);
    return { s, st, slanted };
  };
  it.each([20, 40, 70])("phi=%s: the drawn diameter makes phi with XY and ends on the ellipse", (phi) => {
    const { st, slanted } = phiLine(phi);
    expect(slanted).toHaveLength(1);
    const l = slanted[0];
    const ang = (Math.atan2(l.b[1] - l.a[1], l.b[0] - l.a[0]) * 180) / Math.PI;
    expect(Math.abs(Math.abs(ang) - phi)).toBeLessThan(1e-6);
    const ring = st.primitives.find((p) => p.t === "poly" && p.pts.length > 30);
    if (!ring || ring.t !== "poly") throw new Error("no ellipse");
    // one end of the line is the resting point on the ellipse, the other is its centre
    const near = (q: Point) => Math.min(...ring.pts.map((r) => Math.hypot(r[0] - q[0], r[1] - q[1])));
    expect(Math.min(near(l.a), near(l.b))).toBeLessThan(0.5);
  });
  it("the wording no longer puts a diameter 'in the HP'", () => {
    const { s, st } = phiLine(40);
    expect(s.problem).toMatch(/top view of the diameter through that point inclined at 40° to the VP/);
    expect(s.problem).not.toMatch(/diameter in the HP/);
    expect(st.explanation).toMatch(/diameter through the resting point/);
  });
  it("a corner-resting lamina is unchanged and VP-first says front view / HP", () => {
    const s = ok(solveTiltedVpFirst({ shape: "hexagon", size: 25, surfaceToVP: 50, sideToHP: 30, rest: "corner" }));
    expect(s.problem).toMatch(/front view of the line joining that corner to the centre inclined at 30° to the HP/);
    expect(s.problem).not.toMatch(/plan of the line/);
  });
});

describe("VP-first wording follows the swap of the planes", () => {
  it("solid: project down, hidden parts, axis towards the viewer", () => {
    const s = ok(solveSolidVpFirst({ solid: "cone", diameter: 40, height: 60, angle: 40, phi: 30 }));
    expect(s.steps[0].explanation).toMatch(/directly in front of its centre/);
    expect(s.steps[1].explanation).toMatch(/^Project down from the front view/);
    expect(s.steps.map((x) => x.explanation).join(" ")).not.toMatch(/Project up|behind|over its centre/);
  });
  it("laminas are not 'solids' and have no hidden edges", () => {
    for (const k of ["plane-hp-vp", "circle-hp-vp", "plane-vp-first"]) {
      const last = SAMPLES[k].steps.at(-1)!.explanation;
      expect(last).toMatch(/lamina is now inclined to both/);
      expect(last).not.toMatch(/solid|hidden/);
    }
    expect(SAMPLES["cone-hp-vp"].steps.at(-1)!.explanation).toMatch(/hidden edges/);
  });
});

describe("sections", () => {
  it.each(["section-cone-parabola", "section-cone-hyperbola", "section-cylinder"])("%s: generators are drawn and every cut point lies on one in both views", (k) => {
    const sol = SAMPLES[k];
    const titles = sol.steps.map((s) => s.title);
    const gi = titles.indexOf("Divide the base and draw the generators");
    expect(gi).toBeGreaterThan(0);
    expect(gi).toBeLessThan(titles.indexOf("Mark the cut points"));
    const gens = lines(sol.steps[gi].primitives);
    const cone = k.includes("cone");
    const h = 70;
    const front = gens.filter((l) => l.a[1] >= -1e-9 && l.b[1] >= -1e-9 && Math.abs(l.a[1] - l.b[1]) > 1); // front-view generators
    expect(front.length).toBeGreaterThanOrEqual(7);
    front.forEach((l) => cone ? expect(Math.min(l.a[1], l.b[1]) < 1e-9 && Math.max(l.a[1], l.b[1])).toBeCloseTo(h, 6) : expect(len(l)).toBeCloseTo(h, 6));
    const dots = sol.steps[titles.indexOf("Mark the cut points")].primitives.filter((p) => p.t === "circle");
    const proj = lines(sol.steps[titles.indexOf("Project to the top view")].primitives);
    expect(dots.length).toBeGreaterThanOrEqual(5);
    dots.forEach((d) => {
      if (d.t !== "circle") return;
      expect(front.some((l) => onSeg(d.c, l, 1e-4))).toBe(true);
    });
    // the lower end of each projector (its top-view point) lies on a radial generator drawn in the top view
    const radial = gens.filter((l) => l.a[1] < 0 && l.b[1] < 0 && Math.abs(l.a[0]) < 1e-9 && Math.abs(l.a[1] + (cone ? 30 : 20) + 15) < 1e-6);
    expect(radial.length).toBeGreaterThanOrEqual(12);
    proj.forEach((p) => expect(radial.some((l) => onSeg(p.b, l, 1e-4))).toBe(true));
  });

  it("pyramid: the part of every lateral edge above the plane is thin, the part below stays thick", () => {
    const sol = ok(solveSectionPolyhedron({ solid: "pyramid", base: "square", side: 40, height: 60, angle: 30, axisHeight: 20 }));
    const st = sol.steps[0];
    const top = lines(st.primitives).filter((l) => l.a[1] < -1 && l.b[1] < -1);
    const apexLines = top.filter((l) => Math.abs(l.a[0]) < 1e-6 && Math.abs(l.b[0]) > 1e-6 ? true : Math.abs(l.b[0]) < 1e-6 && Math.abs(l.a[0]) > 1e-6);
    expect(apexLines.length).toBeGreaterThanOrEqual(4);
    // nothing thick reaches the apex (the plane removes the apex end of every edge)
    const reachesApex = (l: L) => [l.a, l.b].some((q) => Math.abs(q[0]) < 1e-6 && Math.abs(q[1] - (-(40 / 2 + 15))) < 1e-6);
    expect(top.filter((l) => reachesApex(l) && thick(st, l))).toEqual([]);
    expect(top.filter((l) => reachesApex(l) && l.style === "construction").length).toBeGreaterThanOrEqual(4);
    // every section corner in the top view is the end of a thick lateral-edge piece
    const corners = sol.steps[3].primitives.filter((p): p is L => p.t === "line").map((l) => l.b);
    corners.forEach((c) => expect(top.some((l) => thick(st, l) && (onSeg(c, l, 1e-6)))).toBe(true));
    expect(sol.steps.find((s) => s.title === "Sectional top view")!.explanation).toMatch(/only the thick edges/);
  });

  it("the section-plane trace stays near the solid: not through the top view", () => {
    for (const k of ["section-pyramid", "section-prism", "section-cone-parabola", "section-cone-hyperbola", "section-cylinder"]) {
      const sp = lines(SAMPLES[k].steps[1].primitives)[0];
      const h = k === "section-pyramid" ? 60 : 70;
      for (const y of [sp.a[1], sp.b[1]]) {
        expect(y).toBeGreaterThanOrEqual(-6 - 1e-6);
        expect(y).toBeLessThanOrEqual(h + 10 + 1e-6);
      }
    }
  });

  it("a shallow plane is still drawn as a full trace", () => {
    const sp = lines(ok(solveSectionRound({ solid: "cylinder", diameter: 40, height: 30, angle: 5, axisHeight: 15 })).steps[1].primitives)[0];
    expect(len(sp)).toBeGreaterThan(40);
  });
});

describe("conic vertex and pyramid development", () => {
  it.each([[40, 1], [40, 1.5], [30, 3]])("d=%s e=%s: the polyline does not kink at the vertex", (d, e) => {
    const s = ok(solveConic(d, e));
    const c = s.steps.at(-1)!.primitives[0];
    if (c.t !== "poly") throw new Error();
    const k = c.pts.findIndex((q) => Math.abs(q[1]) < 1e-9);
    // the true curve is smooth at V: the two chords either side must nearly continue each other (old spacing: a 14 degree corner)
    const dir = (p: Point, q: Point) => Math.atan2(q[1] - p[1], q[0] - p[0]);
    const kink = Math.abs(dir(c.pts[k], c.pts[k + 1]) - dir(c.pts[k - 1], c.pts[k]));
    expect(Math.min(kink, 2 * Math.PI - kink)).toBeLessThan((4 * Math.PI) / 180);
    expect(c.pts.length).toBe(81 * 2 - 1);
  });
  it("pyramid development: top view only (no 'projections', no base attached), square base side parallel to XY", () => {
    const s = ok(solvePyramidDevelopment("square", 30, 50));
    expect(s.problem).not.toMatch(/projections/);
    expect(s.steps.at(-1)!.explanation).not.toMatch(/with the base/i);
    const sides = lines(s.steps[0].primitives).filter((l) => len(l) > 29 && len(l) < 31);
    expect(sides.some((l) => Math.abs(l.a[1] - l.b[1]) < 1e-9)).toBe(true);
  });
});
