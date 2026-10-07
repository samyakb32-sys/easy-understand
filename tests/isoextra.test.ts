import { describe, expect, it } from "vitest";
import { buildPart, buildPartAt, hull, solveIsometricComposite, type Part } from "@/lib/geometry/composite";
import { ISO_SCALE, isoPoint } from "@/lib/geometry/isometric";
import { notchedBlock, solveIsometricHoled, solveIsometricNotched, solveIsometricRow, visibleParts, type Face, type HoledInput, type NotchInput, type RowInput } from "@/lib/geometry/isoextra";
import { Solution as SolutionSchema, type Point, type Primitive, type Solution } from "@/lib/schema";
import { renderIfAsked } from "./helpers/svg";

type V3 = [number, number, number];
type Seg = [Point, Point];
const K = ISO_SCALE;
const C30 = Math.cos(Math.PI / 6);

const ok = <T extends { ok: boolean }>(r: T, name?: string) => {
  if (!r.ok) throw new Error((r as unknown as { reason: string }).reason);
  const s = (r as unknown as { solution: Solution }).solution;
  if (name) renderIfAsked(name, s);
  return s;
};
const reason = (r: { ok: boolean }) => (r.ok ? "" : (r as unknown as { reason: string }).reason);

/** screen point -> plan position (x, y) of the point of the plane z = z0 that projects there */
const unproject = (p: Point, z0: number, k = K): [number, number] => {
  const d = p[0] / (C30 * k), s = 2 * (p[1] / k - z0);
  return [(s + d) / 2, (s - d) / 2];
};
const dist = (p: Point, [a, b]: Seg) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const onAny = (p: Point, segs: Seg[]) => segs.some((s) => dist(p, s) < 1e-6);
const sample = (segs: Seg[], step = 0.7): Point[] => segs.flatMap(([a, b]) => {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  return Array.from({ length: n }, (_, i) => { const t = (i + 0.37) / n; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as Point; });
});
const segsOf = (ps: Primitive[]): Seg[] => ps.flatMap((p): Seg[] => (p.t === "line" ? [[p.a, p.b]] : p.t === "poly" ? p.pts.slice(0, -1).map((q, i) => [q, p.pts[i + 1]] as Seg) : []));
const outlineSegs = (s: Solution, from = 0) => s.steps.slice(from).flatMap((st) => segsOf(st.primitives.filter((p) => ("style" in p && p.style ? p.style : st.style) === "outline")));

// ------------------------------------------------------------------ solids side by side

const boxFaces = (x0: number, x1: number, y0: number, y1: number, h: number): Face[] => [
  { pts: [[x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]], n: [0, 0, 1] },
  { pts: [[x0, y0, 0], [x0, y1, 0], [x0, y1, h], [x0, y0, h]], n: [-1, 0, 0] },
  { pts: [[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], n: [1, 0, 0] },
  { pts: [[x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h]], n: [0, -1, 0] },
  { pts: [[x0, y1, 0], [x1, y1, 0], [x1, y1, h], [x0, y1, h]], n: [0, 1, 0] },
];
const boxEdges = (x0: number, x1: number, y0: number, y1: number, h: number): [V3, V3][] => {
  const e: [V3, V3][] = [];
  for (const y of [y0, y1]) for (const z of [0, h]) e.push([[x0, y, z], [x1, y, z]]);
  for (const x of [x0, x1]) for (const z of [0, h]) e.push([[x, y0, z], [x, y1, z]]);
  for (const x of [x0, x1]) for (const y of [y0, y1]) e.push([[x, y, 0], [x, y, h]]);
  return e;
};
type Box = [number, number, number, number, number]; // x0, x1, y0, y1, height

/** What the row solver should draw for boxes, found a different way: face by face against every box (no silhouettes). */
const expectedBoxes = (boxes: Box[]): Seg[] => {
  const faces = boxes.flatMap((b) => boxFaces(...b));
  return boxes.flatMap((b) => boxEdges(...b).flatMap(([a, c]) => visibleParts(a, c, faces, K)));
};
const drawn = (s: Solution) => outlineSegs(s, 2);
const prism = (side: number, width: number, height: number): Part => ({ kind: "prism", base: "rectangle", side, width, height });
const row = (i: Partial<RowInput> & Pick<RowInput, "parts">) => solveIsometricRow({ gap: 0, along: "x", scale: "isometric", ...i });

describe("isometric_row", () => {
  const same = (s: Solution, boxes: Box[]) => {
    const want = expectedBoxes(boxes), got = drawn(s);
    sample(want).forEach((p) => expect(onAny(p, got), `missing ${p}`).toBe(true));
    sample(got).forEach((p) => expect(onAny(p, want), `stray ${p}`).toBe(true));
  };
  it("touching boxes along x: the same visible lines as a face-by-face hidden-line removal", () => {
    same(ok(row({ parts: [prism(40, 30, 30), prism(30, 50, 50)] }), "row-boxes"), [[0, 40, 10, 40, 30], [40, 70, 0, 50, 50]]);
  });
  it("boxes with a gap along y (the other axis), a tall box in front of a low one", () => {
    // along y the length of the box (side) runs across the row: centred on the widest
    same(ok(row({ parts: [prism(30, 20, 60), prism(50, 30, 25)], gap: 8, along: "y" })), [[10, 40, 0, 20, 60], [0, 50, 28, 58, 25]]);
  });
  it("three boxes: the farthest is hidden behind two nearer ones", () => {
    same(ok(row({ parts: [prism(20, 20, 40), prism(20, 20, 20), prism(20, 20, 70)], gap: 4 })), [[0, 20, 0, 20, 40], [24, 44, 0, 20, 20], [48, 68, 0, 20, 70]]);
  });
  it("puts each solid where the gap and the footprints say (bases, in the construction step)", () => {
    const s = ok(row({ parts: [prism(40, 30, 30), { kind: "cylinder", diameter: 20, height: 30 }], gap: 5, along: "x" }));
    const base = s.steps[1].primitives.filter((p) => p.t === "poly");
    const pts = base.flatMap((p) => (p.t === "poly" ? p.pts : []));
    // the prism base corner (0, 0) is at O; the cylinder's isometric square starts at x = 45 and is centred across the row at y = 15
    expect(pts.some((q) => Math.hypot(q[0], q[1]) < 1e-9)).toBe(true);
    const sq = pts.filter((q) => Math.abs(unproject(q, 0)[0] - 45) < 1e-6 || Math.abs(unproject(q, 0)[0] - 65) < 1e-6);
    expect(sq.length).toBeGreaterThan(0);
    const rhombusCentre = isoPoint(55, 15, 0, K);
    expect(pts.some((q) => Math.abs(q[0] - rhombusCentre[0]) < 1e-6 && Math.abs(q[1] - (rhombusCentre[1] + 10 * K)) < 1e-6)).toBe(true); // top corner of the rhombus
  });
  it("round solids: nothing of a farther solid is drawn inside a nearer one, and nothing visible is dropped", () => {
    const parts: Part[] = [{ kind: "cylinder", diameter: 40, height: 50 }, { kind: "cone", diameter: 44, height: 60 }, { kind: "sphere", diameter: 30 }];
    const s = ok(row({ parts, gap: 3, along: "y" }), "row-round");
    // the cylinder stands at y = 0..40, centre (22, 20); a ray through a point of the paper meets it if some z in [0, 50] puts that point inside the circle
    const inCylinder = (p: Point, margin: number) => {
      for (let z = 0; z <= 50; z += 0.05) { const [x, y] = unproject(p, z); if (Math.hypot(x - 22, y - 20) < 20 - margin) return true; }
      return false;
    };
    const cone = s.steps[3].primitives.flatMap((p) => (p.t === "poly" ? p.pts : []));
    expect(cone.length).toBeGreaterThan(20);
    cone.forEach((p) => expect(inCylinder(p, 0.01), `drawn behind the cylinder at ${p}`).toBe(false));
    // sample the cone's whole outline (as it would be drawn alone) and see that every point outside the cylinder is still drawn
    const alone = buildPartAt(parts[1], [22, 40 + 3 + 22], 0, K);
    if (typeof alone === "string") throw new Error(alone);
    const full = alone.edges.flatMap((e) => e.slice(0, -1).map((a, i) => [a, e[i + 1]] as Seg));
    const kept = segsOf(s.steps[3].primitives);
    sample(full, 0.3).filter((p) => !inCylinder(p, -0.01)).forEach((p) => expect(onAny(p, kept), `dropped ${p}`).toBe(true));
  });
  it.each(["sphere", "cone", "hemisphere"] as const)("a nearer %s hides the part of a farther cylinder behind its silhouette", (kind) => {
    const near: Part = kind === "cone" ? { kind, diameter: 31, height: 40 } : { kind, diameter: 31 };
    const far: Part = { kind: "cylinder", diameter: 30, height: 40 };
    const s = ok(row({ parts: [near, far], gap: 2 }), `row-near-${kind}`);
    const sil = buildPartAt(near, [15.5, 15.5], 0, K);
    if (typeof sil === "string") throw new Error(sil);
    const inside = (p: Point) => sil.silhouette.every((q, i) => { const r = sil.silhouette[(i + 1) % sil.silhouette.length]; return (r[0] - q[0]) * (p[1] - q[1]) - (r[1] - q[1]) * (p[0] - q[0]) > 0.05 * Math.hypot(r[0] - q[0], r[1] - q[1]); });
    const pts = s.steps[3].primitives.flatMap((p) => (p.t === "poly" ? p.pts : []));
    expect(pts.length).toBeGreaterThan(20);
    sample(segsOf(s.steps[3].primitives), 0.2).forEach((p) => expect(inside(p), `drawn behind the ${kind} at ${p}`).toBe(false));
    // and the cylinder's outline is cut, not dropped: some of it is still drawn
    expect(segsOf(s.steps[3].primitives).length).toBeGreaterThan(1);
  });
  it("three spheres with a gap: the farthest circle is cut by the middle one", () => {
    const sph: Part = { kind: "sphere", diameter: 30 };
    const s = ok(row({ parts: [sph, sph, sph], gap: 2 }), "row-three-spheres");
    const c = isoPoint(79, 15, 0, K), m = isoPoint(47, 15, 0, K);
    expect(Math.hypot(c[0] - m[0], c[1] - m[1])).toBeLessThan(30); // they do overlap on the paper
    const far = segsOf(s.steps[4].primitives);
    sample(far, 0.1).forEach((p) => expect(Math.hypot(p[0] - m[0], p[1] - (m[1] + 15 * K)) >= 15 - 0.05, `at ${p}`).toBe(true));
  });
  it("draws no line twice where solids touch", () => {
    const s = ok(row({ parts: [prism(30, 30, 30), prism(30, 30, 30), prism(30, 30, 30)] }));
    const segs = drawn(s);
    for (let a = 0; a < segs.length; a++) {
      for (let b = a + 1; b < segs.length; b++) {
        const [p, q] = segs[a], [r, t] = segs[b];
        const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (dist(r, segs[a]) > 1e-6 || dist(t, segs[a]) > 1e-6) continue; // not collinear with a
        const along = (c: Point) => ((c[0] - p[0]) * (q[0] - p[0]) + (c[1] - p[1]) * (q[1] - p[1])) / len ** 2;
        const [u0, u1] = [along(r), along(t)].sort((m, n) => m - n);
        expect(Math.min(1, u1) - Math.max(0, u0), `${segs[a]} overlaps ${segs[b]}`).toBeLessThan(1e-6);
      }
    }
  });
  it("has 4 to 5 steps, no empty step, and no solid", () => {
    for (const n of [2, 3]) {
      const s = ok(row({ parts: Array.from({ length: n }, () => prism(20, 20, 20)) }));
      expect(s.steps).toHaveLength(n + 2);
      s.steps.forEach((st) => { expect(st.primitives.length).toBeGreaterThan(0); expect(st.explanation.length).toBeGreaterThan(20); });
      expect(s.solid).toBeUndefined();
    }
  });
  it("uses true lengths when asked", () => {
    const a = drawn(ok(row({ parts: [prism(20, 20, 20), prism(20, 20, 20)], scale: "true" })));
    const b = drawn(ok(row({ parts: [prism(20, 20, 20), prism(20, 20, 20)] })));
    expect(Math.max(...a.flatMap(([p, q]) => [p[1], q[1]])) / Math.max(...b.flatMap(([p, q]) => [p[1], q[1]]))).toBeCloseTo(1 / K, 6);
  });
  it("rejects what cannot be drawn instead of throwing", () => {
    expect(reason(row({ parts: [prism(20, 20, 20)] }))).toMatch(/2 or 3/);
    expect(reason(row({ parts: Array.from({ length: 4 }, () => prism(20, 20, 20)) }))).toMatch(/2 or 3/);
    expect(reason(row({ parts: [prism(20, 20, 20), prism(20, 20, 20)], gap: -1 }))).toMatch(/gap/);
    expect(reason(row({ parts: [prism(20, 20, 20), prism(20, 0, 20)] }))).toMatch(/positive/);
    expect(reason(row({ parts: [prism(20, 20, 20), { kind: "cylinder", diameter: NaN, height: 5 }] }))).toMatch(/positive/);
    expect(reason(row({ parts: [{ kind: "prism", base: "rectangle", side: 20, height: 20 }, prism(20, 20, 20)] }))).toMatch(/width/);
    expect(reason(row({ parts: [prism(20, 20, 20), { kind: "cone", diameter: 100, height: 5 }] }))).toMatch(/flat/);
  });
});

// ------------------------------------------------------------------ holes

const hole = (i: Partial<HoledInput> & Pick<HoledInput, "solid" | "height" | "holeDiameter">) => solveIsometricHoled({ scale: "isometric", ...i });
const ellipseAt = (p: Primitive, t: number): Point => {
  if (p.t !== "ellipse") throw new Error("not an ellipse");
  const a = (t * Math.PI) / 180;
  return [p.c[0] + p.rx * Math.cos(a), p.c[1] + p.ry * Math.sin(a)];
};

describe("isometric_holed", () => {
  const cases: [string, Partial<HoledInput> & Pick<HoledInput, "solid" | "height" | "holeDiameter">][] = [
    ["rectangle through", { solid: "prism", base: "rectangle", side: 60, width: 44, height: 18, holeDiameter: 24 }],
    ["hexagon blind", { solid: "prism", base: "hexagon", side: 30, height: 40, holeDiameter: 30, holeDepth: 15 }],
    ["triangle blind", { solid: "prism", base: "triangle", side: 60, height: 30, holeDiameter: 15, holeDepth: 8 }],
    ["pentagon through", { solid: "prism", base: "pentagon", side: 40, height: 12, holeDiameter: 30 }],
    ["cylinder through", { solid: "cylinder", diameter: 60, height: 20, holeDiameter: 30 }],
    ["cylinder blind", { solid: "cylinder", diameter: 60, height: 40, holeDiameter: 30, holeDepth: 12 }],
  ];
  const ellipseOf = (s: Solution, title: string) => {
    const e = s.steps.find((st) => st.title === title)?.primitives[0];
    if (!e || e.t !== "ellipse") throw new Error(`no ellipse in "${title}"`);
    return e;
  };

  it.each(cases)("%s: the top ellipse is the circle of the hole about the centre of the top face", (name, input) => {
    const s = ok(hole(input), `hole-${name.replace(" ", "-")}`);
    const top = ellipseOf(s, "Ellipse of the hole");
    const polys = s.steps[1].primitives.filter((p) => p.t === "poly");
    const base = polys[input.solid === "prism" ? polys.length - 1 : 0]; // the base polygon, or the cylinder's isometric square
    if (base.t !== "poly") throw new Error();
    const centre = [0, 1].map((c) => base.pts.map((q) => unproject(q, 0)[c]).reduce((a, b) => a + b, 0) / base.pts.length);
    for (let t = 0; t < 360; t += 15) {
      const [x, y] = unproject(ellipseAt(top, t), input.height);
      expect(Math.hypot(x - centre[0], y - centre[1])).toBeCloseTo(input.holeDiameter / 2, 6);
    }
  });

  it.each(cases)("%s: the arc shown is exactly the part of the floor edge that is seen through the opening", (_, input) => {
    const s = ok(hole(input));
    const depth = input.holeDepth ?? input.height, rh = input.holeDiameter / 2, h = input.height;
    const top = ellipseOf(s, "Ellipse of the hole");
    const [cx, cy] = unproject(top.c, h);
    const arc = s.steps.find((st) => /^(Floor|Bottom)/.test(st.title))?.primitives[0];
    let seen = 0;
    for (let t = 0.7; t < 360; t += 1.37) {
      const x = cx + rh * Math.cos((t * Math.PI) / 180), y = cy + rh * Math.sin((t * Math.PI) / 180);
      // looking down, a point of the floor circle is seen if the point straight "towards the viewer" in the top plane is inside the hole
      const seenThrough = Math.hypot(x - depth - cx, y - depth - cy) < rh;
      const q = isoPoint(x, y, h - depth, K);
      let onArc = false;
      if (arc?.t === "ellipse") {
        const th = ((Math.atan2((q[1] - arc.c[1]) / arc.ry, (q[0] - arc.c[0]) / arc.rx) * 180) / Math.PI + 360) % 360;
        onArc = th > arc.from! && th < arc.to!;
      }
      expect(onArc, `floor point at ${t} degrees`).toBe(seenThrough);
      seen += seenThrough ? 1 : 0;
    }
    expect(seen > 0).toBe(!!arc);
    if (arc?.t === "ellipse") {
      for (const t of [arc.from!, arc.to!]) {
        const [x, y] = unproject(ellipseAt(arc, t), h - depth);
        expect(Math.hypot(x - depth - cx, y - depth - cy)).toBeCloseTo(rh, 6); // the ends are where the floor edge goes behind the rim
      }
    }
  });

  it("through hole: only the back arc of the bottom edge; blind hole: the back arc of the floor edge", () => {
    const thru = ok(hole({ solid: "cylinder", diameter: 60, height: 20, holeDiameter: 30 }));
    const blind = ok(hole({ solid: "cylinder", diameter: 60, height: 40, holeDiameter: 30, holeDepth: 12 }));
    const a = thru.steps[thru.steps.length - 1].primitives[0], b = blind.steps[blind.steps.length - 1].primitives[0];
    if (a.t !== "ellipse" || b.t !== "ellipse") throw new Error();
    expect(thru.steps[thru.steps.length - 1].title).toMatch(/Bottom/);
    expect(blind.steps[blind.steps.length - 1].title).toMatch(/Floor/);
    expect(a.to! - a.from!).toBeLessThan(180); // less than the whole back half
    expect(a.c[1]).toBeCloseTo(ellipseOf(thru, "Ellipse of the hole").c[1] - 20 * K, 6); // 20 mm lower on the paper
    expect(b.c[1]).toBeCloseTo(ellipseOf(blind, "Ellipse of the hole").c[1] - 12 * K, 6);
  });

  it("a deep hole hides its floor: the floor shows only while depth < hole diameter x tan(35.26 degrees) = 0.7071 x diameter", () => {
    const steps = (depth: number) => ok(hole({ solid: "cylinder", diameter: 60, height: 60, holeDiameter: 20, holeDepth: depth })).steps.length;
    expect(steps(14.1)).toBe(6);
    expect(steps(14.2)).toBe(5);
    const deep = ok(hole({ solid: "prism", base: "square", side: 50, height: 60, holeDiameter: 20 }));
    expect(deep.steps.some((st) => /Bottom|Floor/.test(st.title))).toBe(false);
    expect(deep.steps[deep.steps.length - 1].explanation).toMatch(/hides its open bottom/);
  });

  it("gives the 3D viewer a ring for a cylinder with a through hole and a cup for a blind hole; nothing for a prism", () => {
    const thru = ok(hole({ solid: "cylinder", diameter: 60, height: 20, holeDiameter: 30 }));
    const blind = ok(hole({ solid: "cylinder", diameter: 60, height: 40, holeDiameter: 30, holeDepth: 12 }));
    expect(thru.solid).toEqual({ kind: "revolve", profile: [[15, 0], [30, 0], [30, 20], [15, 20], [15, 0]] });
    expect(blind.solid).toEqual({ kind: "revolve", profile: [[0, 0], [30, 0], [30, 40], [15, 40], [15, 28], [0, 28]] });
    expect(ok(hole(cases[0][1])).solid).toBeUndefined();
  });

  it("has 5 or 6 steps, none empty, and the outline of the outer solid is not changed by the hole", () => {
    for (const [, c] of cases) {
      const s = ok(hole(c));
      expect(s.steps.length).toBeGreaterThanOrEqual(5);
      expect(s.steps.length).toBeLessThanOrEqual(7);
      s.steps.forEach((st) => expect(st.primitives.length).toBeGreaterThan(0));
    }
    const s = ok(hole({ solid: "prism", base: "square", side: 40, height: 30, holeDiameter: 10 }));
    const outer = s.steps.find((st) => /top face/.test(st.title))!.primitives;
    expect(outer.filter((p) => p.t === "poly" && p.pts.length === 5)).toHaveLength(1); // the closed top outline: four corners and back to the first
  });

  it("rejects a hole that does not fit in the top face, with the size that does", () => {
    expect(reason(hole({ solid: "prism", base: "rectangle", side: 60, width: 30, height: 20, holeDiameter: 30 }))).toMatch(/does not fit.*30 mm across/);
    expect(reason(hole({ solid: "prism", base: "rectangle", side: 60, width: 30, height: 20, holeDiameter: 29.9 }))).toBe("");
    expect(reason(hole({ solid: "prism", base: "hexagon", side: 20, height: 20, holeDiameter: 34.6 }))).toBe(""); // across flats 34.64
    expect(reason(hole({ solid: "prism", base: "hexagon", side: 20, height: 20, holeDiameter: 34.7 }))).toMatch(/34\.64/);
    expect(reason(hole({ solid: "prism", base: "triangle", side: 60, height: 20, holeDiameter: 35 }))).toMatch(/34\.64/); // 2 x inradius
    expect(reason(hole({ solid: "cylinder", diameter: 40, height: 20, holeDiameter: 40 }))).toMatch(/does not fit/);
    expect(reason(hole({ solid: "prism", base: "pentagon", side: 30, height: 20, holeDiameter: 41.3 }))).toMatch(/does not fit/); // across flats 41.35
  });

  it("rejects missing or impossible numbers instead of throwing", () => {
    expect(reason(hole({ solid: "prism", height: 20, holeDiameter: 5 }))).toMatch(/base shape/);
    expect(reason(hole({ solid: "prism", base: "rectangle", side: 30, height: 20, holeDiameter: 5 }))).toMatch(/width/);
    expect(reason(hole({ solid: "cylinder", height: 20, holeDiameter: 5 }))).toMatch(/diameter/);
    expect(reason(hole({ solid: "cylinder", diameter: 40, height: 20, holeDiameter: 10, holeDepth: 25 }))).toMatch(/only 20 mm high/);
    expect(reason(hole({ solid: "cylinder", diameter: 40, height: 20, holeDiameter: 0 }))).toMatch(/positive/);
    expect(reason(hole({ solid: "cylinder", diameter: 40, height: 20, holeDiameter: 10, holeDepth: -1 }))).toMatch(/positive/);
    expect(reason(hole({ solid: "cylinder", diameter: 40, height: Infinity, holeDiameter: 10 }))).toMatch(/positive/);
  });
});

// ------------------------------------------------------------------ notched block

const notch = (i: Partial<NotchInput>) => solveIsometricNotched({ length: 71, width: 53, height: 41, notchLength: 29, notchWidth: 19, notchDepth: 13, at: "front", scale: "isometric", ...i });
const input = (i: Partial<NotchInput>): NotchInput => ({ length: 71, width: 53, height: 41, notchLength: 29, notchWidth: 19, notchDepth: 13, at: "front", scale: "isometric", ...i });
const AT = ["front", "right", "left", "back"] as const;
/** strictly inside the solid (the box less the closed notch), with a margin of eps */
const inSolid = ([x, y, z]: V3, i: NotchInput, eps = 1e-6) => {
  const { x: nx, y: ny, z: nz } = notchedBlock(i).notch;
  if (x <= eps || x >= i.length - eps || y <= eps || y >= i.width - eps || z <= eps || z >= i.height - eps) return false;
  return !(x > nx[0] - eps && x < nx[1] + eps && y > ny[0] - eps && y < ny[1] + eps && z > nz[0] - eps);
};
/**
 * An edge point is seen if the ray from it towards the viewer never passes through the solid. Found exactly, with no faces: the stretch of the
 * ray inside the box, less the stretch inside the (closed) notch; any piece of real length means the solid is in the way.
 */
const rayVisible = (p: V3, i: NotchInput) => {
  const d: V3 = [-1, -1, 1];
  const span = (lo: V3, hi: V3, open: boolean): [number, number] => {
    let t0 = 0, t1 = Infinity;
    for (let c = 0; c < 3; c++) {
      const u = (lo[c] - p[c]) / d[c], v = (hi[c] - p[c]) / d[c];
      t0 = Math.max(t0, Math.min(u, v));
      t1 = Math.min(t1, Math.max(u, v));
    }
    return open || t0 <= t1 ? [t0, t1] : [0, -1];
  };
  const [b0, b1] = span([0, 0, 0], [i.length, i.width, i.height], true);
  const { x, y, z } = notchedBlock(i).notch;
  const [n0, n1] = span([x[0], y[0], z[0]], [x[1], y[1], z[1]], false);
  return !(Math.min(b1, n0) - b0 > 1e-7 || b1 - Math.max(b0, n1) > 1e-7);
};
describe("hidden lines by faces", () => {
  it("a cube shows 9 of its 12 edges", () => {
    const faces = boxFaces(0, 10, 0, 10, 10);
    const all = boxEdges(0, 10, 0, 10, 10);
    const bottom: Face = { pts: [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]], n: [0, 0, -1] };
    for (const f of [faces, [...faces, bottom]]) {
      const len = all.flatMap(([a, b]) => visibleParts(a, b, f, K)).reduce((s, [p, q]) => s + Math.hypot(q[0] - p[0], q[1] - p[1]), 0);
      expect(len).toBeCloseTo(9 * 10 * K, 4);
    }
  });
  it("a low box in front hides the foot of a taller one behind it, and no more", () => {
    const faces = [...boxFaces(0, 10, 0, 10, 5), ...boxFaces(0, 10, 10, 20, 15)];
    // the back box's vertical edge at (5, 10) stands behind the front box's top (height 5): hidden below z = 5, seen from there up
    const vis = visibleParts([5, 10, 0], [5, 10, 15], faces, K);
    expect(vis).toHaveLength(1);
    expect(vis[0][0][1]).toBeCloseTo(isoPoint(5, 10, 5, K)[1], 4);
    expect(vis[0][1][1]).toBeCloseTo(isoPoint(5, 10, 15, K)[1], 4);
  });
});

describe("isometric_notched", () => {
  it.each(AT)("model (%s): faces are the right way out, edges are on the surface, the surface area is that of the block", (at) => {
    const i = input({ at });
    const { faces, edges } = notchedBlock(i);
    expect(edges).toHaveLength(21);
    const area = faces.reduce((s, f) => { const [a, b, , d] = f.pts; return s + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]); }, 0);
    const { length: L, width: W, height: H } = i;
    expect(area + L * W).toBeCloseTo(2 * (L * W + L * H + W * H), 6); // cutting a corner leaves the surface area unchanged
    for (const f of faces) {
      const c: V3 = [0, 1, 2].map((a) => f.pts.reduce((s, p) => s + p[a], 0) / 4) as V3;
      const off = (e: number): V3 => [c[0] + f.n[0] * e, c[1] + f.n[1] * e, c[2] + f.n[2] * e];
      expect(inSolid(off(-1e-3), i, 0), `inside of the face at ${c}`).toBe(true);
      expect(inSolid(off(1e-3), i, 0), `outside of the face at ${c}`).toBe(false);
    }
    for (const { a, b } of edges) {
      const m: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      // on the surface: not inside, but some point a hair away is
      const near = [-1, 1].some((dx) => [-1, 1].some((dy) => [-1, 1].some((dz) => inSolid([m[0] + dx * 1e-3, m[1] + dy * 1e-3, m[2] + dz * 1e-3], i, 0))));
      expect(!inSolid(m, i, 1e-6) && near, `edge ${a} ${b}`).toBe(true);
    }
  });
  it("names the corner as the viewer sees the block", () => {
    const o = (at: NotchInput["at"]) => {
      const { corner } = notchedBlock(input({ at }));
      return isoPoint(corner.xo, corner.yo, 0, K);
    };
    expect(Math.abs(o("front")[0])).toBeLessThan(1e-9);
    expect(o("front")[1]).toBe(Math.min(...AT.map((a) => o(a)[1]))); // lowest on the paper
    expect(o("back")[1]).toBe(Math.max(...AT.map((a) => o(a)[1]))); // highest
    expect(o("right")[0]).toBeGreaterThan(0);
    expect(o("left")[0]).toBeLessThan(0);
  });
  /** another edge that is seen at this very spot of the paper (a hidden edge can lie exactly behind a visible one) */
  const behindSeen = (q: Point, own: [V3, V3], i: NotchInput) => notchedBlock(i).edges.some(({ a, b }) => {
    if (a === own[0]) return false;
    const [a2, b2] = [isoPoint(...a, K), isoPoint(...b, K)];
    const l2 = (b2[0] - a2[0]) ** 2 + (b2[1] - a2[1]) ** 2;
    const t = Math.max(0, Math.min(1, ((q[0] - a2[0]) * (b2[0] - a2[0]) + (q[1] - a2[1]) * (b2[1] - a2[1])) / l2));
    return Math.hypot(a2[0] + (b2[0] - a2[0]) * t - q[0], a2[1] + (b2[1] - a2[1]) * t - q[1]) < 1e-6 && rayVisible([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], i);
  });
  const agrees = (i: NotchInput, step = 2.2) => {
    const s = ok(solveIsometricNotched(i), `notch-${i.at}-${i.notchLength}-${i.notchWidth}-${i.notchDepth}`);
    const lines = outlineSegs(s);
    let seen = 0, hidden = 0;
    for (const { a, b } of notchedBlock(i).edges) {
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step);
      for (let j = 0; j < n; j++) {
        const f = (j + 0.37) / n;
        const p: V3 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
        const want = rayVisible(p, i) || behindSeen(isoPoint(...p, K), [a, b], i);
        expect(onAny(isoPoint(...p, K), lines), `${a}->${b} at ${f.toFixed(3)} should be ${want ? "drawn" : "hidden"}`).toBe(want);
        if (want) seen++; else hidden++;
      }
    }
    expect(seen).toBeGreaterThan(50);
    expect(hidden).toBeGreaterThan(5);
    // nothing is drawn that is not part of an edge: every outline point lies on an edge's projection
    const edgeSegs = notchedBlock(i).edges.map(({ a, b }): Seg => [isoPoint(...a, K), isoPoint(...b, K)]);
    sample(lines, 0.5).forEach((p) => expect(onAny(p, edgeSegs), `stray ${p}`).toBe(true));
  };
  it.each([...AT.flatMap((at) => [[at, 29, 19, 13], [at, 24, 17, 31]] as const)])("%s %s x %s x %s: the outline lines are exactly the edges a ray can reach", (at, nl, nw, nd) => {
    agrees(input({ at, notchLength: nl, notchWidth: nw, notchDepth: nd }));
  });
  // the hidden floor edge, moved along the line of sight by the depth, falls exactly on the seam between the two halves of the top face
  it.each([...AT.flatMap((at) => [[at, 80, 60, 50, 30, 25, 25], [at, 80, 60, 50, 25, 20, 25], [at, 80, 60, 50, 20, 20, 20], [at, 80, 60, 50, 19, 30, 19], [at, 60, 40, 30, 15, 10, 10], [at, 50, 50, 50, 25, 25, 25]] as const)])("%s block %s x %s x %s, notch %s x %s x %s: a depth equal to the notch width or length leaves no line across the top face", (at, length, width, height, nl, nw, nd) => {
    agrees({ ...input({ at, notchLength: nl, notchWidth: nw, notchDepth: nd }), length, width, height });
  });
  it.each(AT)("%s: a slot 1 mm short of the whole length draws no tick at the end of the rim", (at) => {
    agrees({ ...input({ at, notchLength: 79, notchWidth: 20, notchDepth: 20 }), length: 80, width: 60, height: 50 }, 0.4);
  });
  it.each(AT)("%s: the thin lines of the early steps are all part of the final drawing, so none is left floating in the cut", (at) => {
    const i = input({ at });
    const s = ok(solveIsometricNotched(i));
    const final = outlineSegs(s);
    const early = s.steps.slice(0, 2).flatMap((st) => segsOf(st.primitives));
    expect(early.length).toBeGreaterThanOrEqual(7);
    sample(early, 0.5).forEach((p) => expect(onAny(p, final), `construction line left at ${p}`).toBe(true));
  });
  it.each(AT)("%s: 4 to 6 steps, none empty, explaining with the real numbers", (at) => {
    for (const nd of [13, 38]) {
      const s = ok(notch({ at, notchDepth: nd }));
      expect(s.steps.length).toBeGreaterThanOrEqual(4);
      expect(s.steps.length).toBeLessThanOrEqual(7);
      s.steps.forEach((st) => expect(st.primitives.length).toBeGreaterThan(0));
      const text = s.steps.map((st) => st.explanation).join(" ");
      expect(text).toContain("29 mm");
      expect(text).toContain("19 mm");
      expect(s.solid).toBeUndefined();
    }
  });
  it("scales with the isometric scale (true lengths are 1/0.816 longer on the paper)", () => {
    const top = (s: Solution) => Math.max(...outlineSegs(s).flatMap(([p, q]) => [p[1], q[1]]));
    expect(top(ok(notch({ scale: "true" }))) / top(ok(notch({ scale: "isometric" })))).toBeCloseTo(1 / K, 6);
  });
  it("rejects a notch that fills or does not fit the block, and impossible numbers", () => {
    expect(reason(notch({ notchLength: 71 }))).toMatch(/length 71 mm is not less than/);
    expect(reason(notch({ notchWidth: 60 }))).toMatch(/width 60 mm/);
    expect(reason(notch({ notchDepth: 41 }))).toMatch(/depth 41 mm/);
    expect(reason(notch({ notchLength: 100, notchWidth: 100, notchDepth: 100 }))).toMatch(/length.*width.*depth/);
    expect(reason(notch({ length: 0 }))).toMatch(/positive/);
    expect(reason(notch({ notchDepth: -3 }))).toMatch(/positive/);
    expect(reason(notch({ height: NaN }))).toMatch(/positive/);
  });
});

// ------------------------------------------------------------------ robustness and the shared composite module

describe("every answer is a valid drawing or a reason, never an exception", () => {
  const finite = (s: Solution) => JSON.stringify(s.steps.map((st) => st.primitives), (_, v) => (typeof v === "number" && !Number.isFinite(v) ? "BAD" : v)).includes("BAD") === false;
  const check = (r: { ok: boolean }) => {
    if (r.ok) {
      const s = (r as unknown as { solution: Solution }).solution;
      expect(SolutionSchema.safeParse(s).success).toBe(true);
      expect(finite(s)).toBe(true);
      expect(s.steps.length).toBeGreaterThanOrEqual(4);
      expect(s.steps.length).toBeLessThanOrEqual(7);
      s.steps.forEach((st) => expect(st.primitives.length).toBeGreaterThan(0));
    } else expect(reason(r).length).toBeGreaterThan(10);
  };
  const sizes = [0, 0.5, 7, 40, 120];
  it("notched blocks over a grid of sizes", () => {
    for (const at of AT) for (const length of sizes) for (const nl of sizes) for (const nd of sizes) check(notch({ at, length, width: 33, height: 50, notchLength: nl, notchWidth: 11, notchDepth: nd }));
  });
  it("holes over a grid of sizes", () => {
    for (const solid of ["prism", "cylinder"] as const) for (const base of ["rectangle", "triangle", "hexagon"] as const) for (const hd of sizes) for (const depth of [undefined, ...sizes]) {
      check(hole({ solid, base, side: 40, width: 25, diameter: 40, height: 30, holeDiameter: hd, holeDepth: depth }));
    }
  });
  it("rows over a grid of parts", () => {
    const parts: Part[] = [prism(30, 20, 40), { kind: "prism", base: "hexagon", side: 20, height: 10 }, { kind: "cylinder", diameter: 25, height: 45 }, { kind: "cone", diameter: 30, height: 4 }, { kind: "cone", diameter: 30, height: 50 }, { kind: "sphere", diameter: 35 }, { kind: "hemisphere", diameter: 35 }];
    for (const a of parts) for (const b of parts) for (const gap of [0, 12]) for (const along of ["x", "y"] as const) check(row({ parts: [a, b], gap, along }));
  });
});

describe("composite helpers", () => {
  it("buildPartAt is buildPart moved across the paper by the plan position", () => {
    const part: Part = { kind: "prism", base: "pentagon", side: 25, height: 30 };
    const a = buildPart(part, 0, K), b = buildPartAt(part, [13, 7], 0, K);
    if (typeof a === "string" || typeof b === "string") throw new Error();
    const [dx, dy] = isoPoint(13, 7, 0, K);
    a.edges.forEach((e, i) => e.forEach((q, j) => { expect(b.edges[i][j][0]).toBeCloseTo(q[0] + dx, 9); expect(b.edges[i][j][1]).toBeCloseTo(q[1] + dy, 9); }));
    b.silhouette.forEach((q) => expect(Math.hypot(q[0] - dx, q[1] - dy)).toBeLessThan(200));
  });
  it("a silhouette hull has no zero-length edge, even for round parts whose ring ends where it starts", () => {
    const parts: Part[] = [{ kind: "sphere", diameter: 30 }, { kind: "cone", diameter: 30, height: 40 }, { kind: "hemisphere", diameter: 30 }, { kind: "cylinder", diameter: 30, height: 20 }];
    for (const p of parts) for (const d of [7, 30, 41.3]) {
      const b = buildPart({ ...p, diameter: d } as Part, 0, K);
      if (typeof b === "string") continue;
      b.silhouette.forEach((q, i) => expect(Math.hypot(q[0] - b.silhouette[(i + 1) % b.silhouette.length][0], q[1] - b.silhouette[(i + 1) % b.silhouette.length][1]), `${p.kind} ${d}`).toBeGreaterThan(1e-6));
    }
    expect(hull([[0, 0], [1, 0], [1, 1e-16], [1, 1], [0, 1]])).toHaveLength(4);
  });
  it("a sphere's guide is the square on the ground it rests in", () => {
    const b = buildPartAt({ kind: "sphere", diameter: 40 }, [0, 0], 0, K);
    if (typeof b === "string") throw new Error();
    const ys = b.construction[0].pts.map((q) => q[1]);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(0, 9);
  });
  it("the stacked composite refuses zero or negative sizes now", () => {
    expect(reason(solveIsometricComposite({ scale: "isometric", parts: [{ kind: "cylinder", diameter: 30, height: 0 }, { kind: "sphere", diameter: 20 }] }))).toMatch(/positive/);
  });
});
