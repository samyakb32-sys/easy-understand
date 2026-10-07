import { describe, expect, it } from "vitest";
import { GAP, solveCylinderPenetration } from "@/lib/geometry/penetration";
import { solveConeCylinder, solveOffsetCylinders, solvePrismCylinder } from "@/lib/geometry/penetration2";
import { Solution, type Point, type Primitive } from "@/lib/schema";
import { renderIfAsked } from "./helpers/svg";

const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error((r as unknown as { reason: string }).reason);
  return (r as unknown as { solution: Solution }).solution;
};
type Poly = Extract<Primitive, { t: "poly" }>;
type Line = Extract<Primitive, { t: "line" }>;
const lastStep = (s: Solution) => s.steps[s.steps.length - 1];
const polys = (ps: Primitive[], hidden: boolean) => ps.filter((p): p is Poly => p.t === "poly" && (p.style === "hidden") === hidden);
const pointsOf = (ps: Poly[]) => ps.flatMap((p) => p.pts);
const outlineLines = (s: Solution, step: number) => s.steps[step].primitives.filter((p): p is Line => p.t === "line" && (p.style ?? s.steps[step].style) === "outline");
const texts = (s: Solution, step: number) => s.steps[step].primitives.filter((p): p is Extract<Primitive, { t: "text" }> => p.t === "text");
const dots = (s: Solution, step: number) => s.steps[step].primitives.filter((p): p is Extract<Primitive, { t: "circle" }> => p.t === "circle" && p.r < 1).map((p) => p.c);
const near = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(tol);

// ---- two cylinders, axes offset --------------------------------------------------------------------------------------
describe("offset cylinders", () => {
  const R = 35, r = 20, e = 12, zc = 45, H = 90;
  const sol = () => ok(solveOffsetCylinders({ mainDiameter: 2 * R, mainHeight: H, branchDiameter: 2 * r, offset: e }));
  const fv = (hidden: boolean) => pointsOf(polys(lastStep(sol()).primitives, hidden));

  it("every visible point lies on both cylinders, on the near half of the branch", () => {
    const pts = fv(false);
    expect(pts.length).toBeGreaterThan(60);
    for (const [x, z] of pts) {
      const s = Math.sqrt(Math.max(0, r * r - (z - zc) ** 2));
      near(x * x + (e + s) ** 2, R * R, 1e-4); // depth e + s: on the branch (near half) and on the main cylinder
    }
  });
  it("every hidden point lies on both cylinders, on the far half of the branch", () => {
    const pts = fv(true);
    expect(pts.length).toBeGreaterThan(60);
    for (const [x, z] of pts) {
      const s = Math.sqrt(Math.max(0, r * r - (z - zc) ** 2));
      near(x * x + (e - s) ** 2, R * R, 1e-4);
    }
  });
  it("draws the curve on both sides, mirrored, with both visible and hidden parts", () => {
    const right = [...fv(false), ...fv(true)].filter(([x]) => x > 0), left = [...fv(false), ...fv(true)].filter(([x]) => x < 0);
    expect(right.length).toBe(left.length);
    expect(Math.max(...fv(false).map(([x]) => x))).toBeCloseTo(Math.sqrt(R * R - e * e), 4); // the visible part ends where y = e (top and bottom of the branch)
    expect(Math.min(...fv(false).map(([x]) => Math.abs(x)))).toBeCloseTo(Math.sqrt(R * R - (e + r) ** 2), 4); // nearest point to the axis: y = e + r
  });
  it("the branch lines stop on the curve and the main outline is cut around the branch", () => {
    const s = sol();
    const xe = Math.sqrt(R * R - e * e);
    const branch = outlineLines(s, 1).filter((l) => l.a[1] > 0 && l.a[1] === l.b[1] && Math.abs(l.a[1] - zc) > r - 1e-6);
    expect(branch.length).toBe(4);
    for (const l of branch) expect(Math.min(Math.abs(l.a[0]), Math.abs(l.b[0]))).toBeCloseTo(xe, 4);
    const sides = outlineLines(s, 0).filter((l) => Math.abs(Math.abs(l.a[0]) - R) < 1e-9 && l.a[0] === l.b[0]);
    for (const l of sides) expect(Math.min(l.a[1], l.b[1]) >= zc + r - 1e-6 || Math.max(l.a[1], l.b[1]) <= zc - r + 1e-6).toBe(true);
  });
  it("the top-view points lie on the main circle at the depths e + r cos(30k)", () => {
    const cyTV = -(R + GAP), d = dots(sol(), 3);
    expect(d).toHaveLength(24);
    for (const [x, v] of d) near(x * x + (cyTV - v) ** 2, R * R, 1e-6);
    const depths = [...new Set(d.map(([, v]) => +(cyTV - v).toFixed(6)))].sort((a, b) => a - b);
    expect(depths).toEqual([...new Set(Array.from({ length: 12 }, (_, k) => +(e + r * Math.cos((k * Math.PI) / 6)).toFixed(6)))].sort((a, b) => a - b));
  });
  it("draws no dashed line for the branch inside the main cylinder", () => {
    sol().steps.slice(0, 2).forEach((st) => st.primitives.forEach((p) => expect((p as { style?: string }).style).not.toBe("hidden")));
  });
  it("tangent case e + r = R: the two curves meet on the axis", () => {
    const s = ok(solveOffsetCylinders({ mainDiameter: 80, mainHeight: 90, branchDiameter: 30, offset: 25 }));
    const pts = pointsOf(polys(lastStep(s).primitives, false));
    expect(Math.min(...pts.map(([x]) => Math.abs(x)))).toBeLessThan(1e-3);
  });
  it("zero offset is the ordinary case, a bad offset is refused", () => {
    expect(ok(solveOffsetCylinders({ mainDiameter: 60, mainHeight: 80, branchDiameter: 40, offset: 0 })).title).toBe(ok(solveCylinderPenetration({ mainDiameter: 60, mainHeight: 80, branchDiameter: 40 })).title);
    const r1 = solveOffsetCylinders({ mainDiameter: 60, mainHeight: 80, branchDiameter: 40, offset: 12 }); // 12 + 20 > 30
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toMatch(/offset/);
    expect(solveOffsetCylinders({ mainDiameter: 60, mainHeight: 80, branchDiameter: 20, offset: -5 }).ok).toBe(false);
    expect(solveOffsetCylinders({ mainDiameter: 40, mainHeight: 80, branchDiameter: 50, offset: 5 }).ok).toBe(false);
    expect(solveOffsetCylinders({ mainDiameter: 60, mainHeight: 80, branchDiameter: 20, offset: 5, axisHeight: 8 }).ok).toBe(false);
    expect(solveOffsetCylinders({ mainDiameter: 60, mainHeight: 80, branchDiameter: 20, offset: 5, axisHeight: 71 }).ok).toBe(false);
    expect(solveOffsetCylinders({ mainDiameter: 60, mainHeight: 80, branchDiameter: 20, offset: 5, axisHeight: 70 }).ok).toBe(true);
  });
});

// ---- cone and cylinder -----------------------------------------------------------------------------------------------
describe("cone and cylinder", () => {
  const R = 40, h = 90, r = 15, zc = 35;
  const rho = (z: number) => R * (1 - z / h);
  const cyTV = -(R + GAP);
  const sol = () => ok(solveConeCylinder({ coneDiameter: 2 * R, coneHeight: h, branchDiameter: 2 * r, axisHeight: zc }));
  const front = (ps: Poly[]) => pointsOf(ps).filter(([, y]) => y > 0);
  const top = (ps: Poly[]) => pointsOf(ps).filter(([, y]) => y < 0);

  it("front view: every curve point lies on the cone and on the cylinder", () => {
    const pts = front(polys(lastStep(sol()).primitives, false));
    expect(pts.length).toBeGreaterThan(60);
    for (const [x, z] of pts) {
      const y2 = r * r - (z - zc) ** 2; // on the cylinder
      near(x * x + y2, rho(z) ** 2, 1e-4); // on the cone
    }
  });
  it("top view: visible points are on the upper half of the cylinder, hidden ones on the lower half", () => {
    const p = lastStep(sol()).primitives;
    const check = (pts: Point[], upper: boolean) => {
      expect(pts.length).toBeGreaterThan(40);
      for (const [x, v] of pts) {
        const y = cyTV - v, z = h * (1 - Math.hypot(x, y) / R); // height of the cone surface above (x, y)
        near(y * y + (z - zc) ** 2, r * r, 1e-4); // and the same point is on the cylinder
        expect(upper ? z - zc : zc - z).toBeGreaterThan(-1e-4);
      }
    };
    check(top(polys(p, false)), true);
    check(top(polys(p, true)), false);
  });
  it("the top view curve is a closed loop on each side of the axis", () => {
    const loops = [...polys(lastStep(sol()).primitives, false), ...polys(lastStep(sol()).primitives, true)].filter((q) => q.pts[0][1] < 0);
    const xs = pointsOf(loops).map(([x]) => x);
    expect(Math.min(...xs)).toBeCloseTo(-rho(zc - r), 3);
    expect(Math.max(...xs)).toBeCloseTo(rho(zc - r), 3);
  });
  it("uses one section circle per distinct height and groups the points that share a spot", () => {
    const s = sol();
    expect(s.steps).toHaveLength(7);
    const circles = s.steps[3].primitives.filter((p): p is Extract<Primitive, { t: "circle" }> => p.t === "circle");
    const heights = [0, 0.5, 0.866025403784, 1, -0.5, -0.866025403784, -1].map((k) => zc + k * r);
    expect(circles.map((c) => c.r).sort((a, b) => a - b).map((x) => +x.toFixed(6))).toEqual(heights.map((z) => +rho(z).toFixed(6)).sort((a, b) => a - b));
    expect(circles.every((c) => c.c[0] === 0 && c.c[1] === cyTV)).toBe(true);
    const labels = texts(s, 5).map((t) => t.text); // front view labels
    expect(labels).toContain("1,7");
    expect(labels).toContain("4");
  });
  it("the top-view points lie on the circle of their own height", () => {
    const d = dots(sol(), 4);
    expect(d).toHaveLength(24);
    for (const [x, v] of d) {
      const y = cyTV - v, onCircle = [0, 0.5, 0.866025403784, 1, -0.5, -0.866025403784, -1].some((k) => Math.abs(x * x + y * y - rho(zc + k * r) ** 2) < 1e-6 && Math.abs(y * y + (k * r) ** 2 - r * r) < 1e-6);
      expect(onCircle).toBe(true);
    }
  });
  it("rejects a cylinder that breaks out of the slant sides, or is placed wrongly", () => {
    const wide = solveConeCylinder({ coneDiameter: 80, coneHeight: 90, branchDiameter: 60, axisHeight: 35 });
    expect(wide.ok).toBe(false);
    if (!wide.ok) expect(wide.reason).toMatch(/too wide/);
    expect(solveConeCylinder({ coneDiameter: 80, coneHeight: 90, branchDiameter: 30, axisHeight: 80 }).ok).toBe(false); // near the apex
    expect(solveConeCylinder({ coneDiameter: 80, coneHeight: 90, branchDiameter: 30, axisHeight: 10 }).ok).toBe(false); // sinks below the base
    expect(solveConeCylinder({ coneDiameter: 80, coneHeight: 90, branchDiameter: 30, axisHeight: 90 }).ok).toBe(false);
    expect(solveConeCylinder({ coneDiameter: 80, coneHeight: 0, branchDiameter: 30, axisHeight: 20 }).ok).toBe(false);
  });
  it("the limit is exact: just inside the slant is accepted, just outside refused", () => {
    const room = (40 * (90 - 35)) / Math.hypot(40, 90);
    expect(solveConeCylinder({ coneDiameter: 80, coneHeight: 90, branchDiameter: 2 * (room - 0.01), axisHeight: 35 }).ok).toBe(true);
    expect(solveConeCylinder({ coneDiameter: 80, coneHeight: 90, branchDiameter: 2 * (room + 0.01), axisHeight: 35 }).ok).toBe(false);
  });
  it("the branch lines in the front view stop on the cone", () => {
    const lines = outlineLines(sol(), 1).filter((l) => l.a[1] === l.b[1] && l.a[1] > 0 && Math.abs(l.a[1] - zc) > r - 1e-6);
    expect(lines).toHaveLength(4);
    for (const l of lines) expect(Math.min(Math.abs(l.a[0]), Math.abs(l.b[0]))).toBeCloseTo(rho(l.a[1]), 4);
  });
});

// ---- square prism and cylinder ---------------------------------------------------------------------------------------
describe("square prism and cylinder", () => {
  const s = 60, H = 80, r = 20, zc = 40;
  const W = s / Math.SQRT2;
  it("faces inclined: the front view curve is an arc of a circle of radius r about the edge, all visible", () => {
    const sol = ok(solvePrismCylinder({ side: s, height: H, branchDiameter: 2 * r, facesInclined: true }));
    const fin = lastStep(sol).primitives;
    expect(polys(fin, true)).toHaveLength(0); // the back arcs lie exactly behind the front ones
    const pts = pointsOf(polys(fin, false));
    expect(pts.length).toBeGreaterThan(60);
    for (const [x, z] of pts) {
      const y = Math.sqrt(Math.max(0, r * r - (z - zc) ** 2)); // depth on the cylinder
      near(Math.abs(x) + y, W, 1e-4); // on a face of the prism: |x| + |y| = W
    }
    expect(Math.max(...pts.map(([x]) => x))).toBeCloseTo(W, 4);
    expect(Math.min(...pts.map(([x]) => Math.abs(x)))).toBeCloseTo(W - r, 4);
  });
  it("faces inclined: the top-view points lie on the four faces |x| + |y| = W, on the front and the back", () => {
    const d = dots(ok(solvePrismCylinder({ side: s, height: H, branchDiameter: 2 * r, facesInclined: true })), 3);
    expect(d).toHaveLength(24);
    for (const [x, v] of d) near(Math.abs(x) + Math.abs(-(W + GAP) - v), W, 1e-6);
    expect(d.some(([, v]) => -(W + GAP) - v < 0)).toBe(true);
  });
  it("faces inclined: the top view of the prism is a square standing on its corner, side s", () => {
    const sol = ok(solvePrismCylinder({ side: s, height: H, branchDiameter: 2 * r, facesInclined: true }));
    const tv = outlineLines(sol, 0).filter((l) => l.a[1] < -1e-9 && l.b[1] < -1e-9);
    expect(tv).toHaveLength(4);
    for (const l of tv) { near(Math.hypot(l.a[0] - l.b[0], l.a[1] - l.b[1]), s, 1e-6); for (const [x, v] of [l.a, l.b]) near(Math.abs(x) + Math.abs(-(W + GAP) - v), W, 1e-6); }
  });
  it("nothing is dashed in the prism drawings: the branch is not seen inside the prism", () => {
    for (const inc of [false, true]) ok(solvePrismCylinder({ side: s, height: H, branchDiameter: 2 * r, facesInclined: inc })).steps.forEach((st) => st.primitives.forEach((p) => expect((p as { style?: string }).style).not.toBe("hidden")));
  });
  it("base edge parallel to the VP: the top-view points lie on the side faces", () => {
    for (const [x] of dots(ok(solvePrismCylinder({ side: s, height: H, branchDiameter: 2 * r })), 3)) near(Math.abs(x), s / 2);
  });
  it("faces inclined: the middle edge is drawn whole, the corner edges are cut by the branch", () => {
    const sol = ok(solvePrismCylinder({ side: s, height: H, branchDiameter: 2 * r, facesInclined: true }));
    const vertical = outlineLines(sol, 0).filter((l) => l.a[0] === l.b[0] && l.a[1] !== l.b[1] && l.a[1] >= 0 && l.b[1] >= 0);
    const mid = vertical.filter((l) => Math.abs(l.a[0]) < 1e-9 && l.a[1] >= 0);
    expect(mid.some((l) => Math.abs(Math.min(l.a[1], l.b[1])) < 1e-9 && Math.abs(Math.max(l.a[1], l.b[1]) - H) < 1e-6)).toBe(true);
    const corner = vertical.filter((l) => Math.abs(Math.abs(l.a[0]) - W) < 1e-6);
    corner.forEach((l) => expect(Math.min(l.a[1], l.b[1]) >= zc + r - 1e-6 || Math.max(l.a[1], l.b[1]) <= zc - r + 1e-6).toBe(true));
  });
  it("base edge parallel to the VP: the curve is a circle on each side face, a straight line in the front view", () => {
    const sol = ok(solvePrismCylinder({ side: s, height: H, branchDiameter: 2 * r }));
    const pts = pointsOf(polys(lastStep(sol).primitives, false));
    expect(pts.length).toBeGreaterThan(60);
    for (const [x, z] of pts) {
      near(Math.abs(x), s / 2);
      expect(Math.abs(z - zc)).toBeLessThanOrEqual(r + 1e-9);
    }
    expect(Math.max(...pts.map(([, z]) => z))).toBeCloseTo(zc + r, 6);
    expect(Math.min(...pts.map(([, z]) => z))).toBeCloseTo(zc - r, 6);
  });
  it("limits: the cylinder may be as wide as the face, or the diagonal when the faces are inclined", () => {
    expect(solvePrismCylinder({ side: 50, height: 80, branchDiameter: 50 }).ok).toBe(true);
    expect(solvePrismCylinder({ side: 50, height: 80, branchDiameter: 51 }).ok).toBe(false);
    expect(solvePrismCylinder({ side: 50, height: 80, branchDiameter: 70, facesInclined: true }).ok).toBe(true);
    expect(solvePrismCylinder({ side: 50, height: 80, branchDiameter: 71, facesInclined: true }).ok).toBe(false);
    expect(solvePrismCylinder({ side: 50, height: 60, branchDiameter: 40, axisHeight: 15 }).ok).toBe(false);
    expect(solvePrismCylinder({ side: 50, height: 60, branchDiameter: 40, axisHeight: 20 }).ok).toBe(true);
    expect(solvePrismCylinder({ side: 0, height: 60, branchDiameter: 40 }).ok).toBe(false);
  });
});

// ---- the drawings as a whole -----------------------------------------------------------------------------------------
const examples: [string, () => ReturnType<typeof solveOffsetCylinders>][] = [
  ["offset", () => solveOffsetCylinders({ mainDiameter: 70, mainHeight: 90, branchDiameter: 40, offset: 12 })],
  ["offset-tangent", () => solveOffsetCylinders({ mainDiameter: 80, mainHeight: 90, branchDiameter: 30, offset: 25 })],
  ["cone", () => solveConeCylinder({ coneDiameter: 80, coneHeight: 90, branchDiameter: 30, axisHeight: 35 })],
  ["prism-inclined", () => solvePrismCylinder({ side: 60, height: 80, branchDiameter: 40, facesInclined: true })],
  ["prism-flat", () => solvePrismCylinder({ side: 60, height: 80, branchDiameter: 40 })],
  ["cylinders", () => solveCylinderPenetration({ mainDiameter: 60, mainHeight: 80, branchDiameter: 40 })],
];
describe.each(examples)("%s drawing", (name, make) => {
  const s = ok(make());
  renderIfAsked(`pen2-${name}`, s);
  it("is a valid Solution with finite coordinates and no 3D solid", () => {
    expect(Solution.safeParse(s).success).toBe(true);
    expect(s.solid).toBeUndefined();
    const nums = JSON.stringify(s.steps.map((st) => st.primitives));
    expect(nums).not.toMatch(/null|NaN|Infinity/);
    s.steps.forEach((st) => { expect(st.explanation.length).toBeGreaterThan(40); expect(st.primitives.length).toBeGreaterThan(0); });
  });
  it("never puts two labels on the same spot or on top of each other in one step", () => {
    s.steps.forEach((st, k) => {
      const t = texts(s, k);
      for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
        const dx = Math.abs(t[i].at[0] - t[j].at[0]), dy = Math.abs(t[i].at[1] - t[j].at[1]);
        expect(dx > 1.9 * Math.min(t[i].text.length, t[j].text.length) || dy > 2.3, `${name} step ${k}: "${t[i].text}" and "${t[j].text}"`).toBe(true);
      }
    });
  });
  it("labels every one of the 12 points in the side view and in the front view", () => {
    const all = (k: number) => texts(s, k).flatMap((t) => t.text.split(",")).filter((x) => /^\d+$/.test(x)).map(Number).sort((a, b) => a - b);
    const twelve = Array.from({ length: 12 }, (_, i) => i + 1);
    expect(all(2)).toEqual(twelve);
    expect(all(s.steps.length - 2)).toEqual(twelve);
  });
});

describe("two cylinders at right angles (existing solver)", () => {
  it("has no dashed lines: nothing of the branch is seen inside the main cylinder in the top view", () => {
    const s = ok(solveCylinderPenetration({ mainDiameter: 60, mainHeight: 80, branchDiameter: 40 }));
    s.steps.forEach((st) => st.primitives.forEach((p) => expect((p as { style?: string }).style).not.toBe("hidden")));
  });
  it("front view labels of points that coincide are shared", () => {
    const s = ok(solveCylinderPenetration({ mainDiameter: 60, mainHeight: 80, branchDiameter: 40 }));
    expect(texts(s, 4).map((t) => t.text)).toEqual(expect.arrayContaining(["1,7", "2,6", "3,5", "8,12", "9,11"]));
  });
});

describe("robustness", () => {
  it("never throws and always answers, whatever the numbers", () => {
    const vals = [0, -1, 1e-9, 5, 17.3, 40, 100, 1e6, NaN, Infinity];
    for (const a of vals) for (const b of vals) for (const c of vals) {
      for (const f of [
        () => solveOffsetCylinders({ mainDiameter: a, mainHeight: b, branchDiameter: c, offset: a / 4 }),
        () => solveConeCylinder({ coneDiameter: a, coneHeight: b, branchDiameter: c, axisHeight: b / 2 }),
        () => solvePrismCylinder({ side: a, height: b, branchDiameter: c, facesInclined: a > b }),
      ]) {
        const r = f();
        if (r.ok) expect(JSON.stringify(r.solution)).not.toMatch(/null|NaN|Infinity/);
        else expect(r.reason.length).toBeGreaterThan(10);
      }
    }
  });
  it("accepts a sweep of valid inputs and draws finite, bounded coordinates", () => {
    let n = 0;
    for (let R = 20; R <= 60; R += 10) for (let r = 5; r < R; r += 7) for (let e = 3; e + r <= R; e += 9) {
      const s = ok(solveOffsetCylinders({ mainDiameter: 2 * R, mainHeight: 3 * R, branchDiameter: 2 * r, offset: e }));
      for (const st of s.steps) for (const p of st.primitives) {
        const c = p.t === "line" ? [p.a, p.b] : p.t === "poly" ? p.pts : p.t === "text" ? [p.at] : p.t === "circle" ? [p.c] : [];
        c.forEach(([x, y]) => { expect(Math.abs(x)).toBeLessThan(10 * R); expect(Math.abs(y)).toBeLessThan(10 * R); });
      }
      n++;
    }
    for (let d = 10; d <= 60; d += 10) for (let z = 20; z < 90; z += 15) if (solveConeCylinder({ coneDiameter: 100, coneHeight: 100, branchDiameter: d, axisHeight: z }).ok) n++;
    expect(n).toBeGreaterThan(20);
  });
});
