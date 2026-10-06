import type { Point, Primitive, Solution, Step } from "../schema";
import { round } from "./basic";
import { cutPolyhedron, edgeNormal, polygonArea, prismPoly, pyramidPoly, regularPolygon, SIDES, type RegularBase } from "./solids";

type Result = { ok: true; solution: Solution } | { ok: false; reason: string };

const line = (a: Point, b: Point, style?: Extract<Primitive, { t: "line" }>["style"]): Primitive => ({ t: "line", a, b, style });
const text = (at: Point, s: string, size?: number): Primitive => ({ t: "text", at, text: s, size });
const dot = (c: Point): Primitive => ({ t: "circle", c, r: 0.9 });
const GAP = 15; // distance of the solid from the VP, mm

/** A corner of the section: plan coordinates (x, y), height z and distance s along the cutting line. */
type Corner = { x: number; y: number; z: number; s: number };

type Layout = {
  title: string;
  problem: string;
  givens: { name: string; value: string }[];
  theta: number;
  k: number;
  yOff: number; // top view screen y = plan y - yOff
  xmin: number;
  xmax: number;
  frontVerts: Point[];
  front: Primitive[];
  top: Primitive[];
  corners: Corner[]; // the marked points
  curve?: Corner[]; // optional dense outline for curved sections
  labelled: boolean; // number the points (polyhedra only)
  solid: Solution["solid"];
  shapeName: string;
};

function buildSteps(L: Layout): Solution {
  const th = (L.theta * Math.PI) / 180;
  const u: Point = [Math.cos(th), Math.sin(th)];
  const dir: Point = [-Math.sin(th), Math.cos(th)]; // perpendicular to the cutting line, pointing up and away
  const Q0: Point = [0, L.k];
  const F = (c: Corner): Point => [c.x, c.z];
  const T = (c: Corner): Point => [c.x, c.y - L.yOff];
  const d = (c: Corner) => L.yOff - c.y; // distance from XY in the top view = distance from X1Y1 in the auxiliary view

  const reach = Math.max(...L.frontVerts.map((v) => v[0] * dir[0] + (v[1] - L.k) * dir[1]), 0);
  const delta = reach + 14;
  const aux = (s: number): Point => [Q0[0] + dir[0] * delta + u[0] * s, Q0[1] + dir[1] * delta + u[1] * s];
  const trueAt = (c: Corner): Point => [c.x + dir[0] * (delta + d(c)), c.z + dir[1] * (delta + d(c))];
  const smin = Math.min(...L.corners.map((c) => c.s)), smax = Math.max(...L.corners.map((c) => c.s));
  const outline = L.curve ?? L.corners;
  const half = Math.max(Math.abs(L.xmin), Math.abs(L.xmax)) / Math.cos(th) + 12;
  const num = (i: number) => String(i + 1);
  const off = (p: Point): Point => [p[0] + 1.4, p[1] + 1.4];

  const area = polygonArea(outline.map((c) => [c.s, d(c)] as Point));
  // points that coincide in a view (front and back corners in the front view) share one label, e.g. "1,4"
  const labels = (fn: (c: Corner) => Point): Primitive[] => {
    if (!L.labelled) return [];
    const groups = new Map<string, { at: Point; ids: string[] }>();
    L.corners.forEach((c, i) => {
      const p = fn(c), key = `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
      const g = groups.get(key) ?? { at: p, ids: [] };
      g.ids.push(num(i));
      groups.set(key, g);
    });
    return [...groups.values()].map((g) => text(off(g.at), g.ids.join(",")));
  };

  const steps: Step[] = [
    {
      title: "Given views",
      explanation: "Draw the reference line XY. Draw the front view above it and the top view below it, with the solid standing on its base on the HP.",
      style: "outline",
      primitives: [line([L.xmin - 14, 0], [L.xmax + 14, 0]), text([L.xmin - 20, 2], "X"), text([L.xmax + 16, 2], "Y"), ...L.front, ...L.top],
    },
    {
      title: "Section plane",
      explanation: `The cutting plane is perpendicular to the VP, so in the front view it is a straight line. Draw it inclined at ${L.theta}° to XY through the axis at ${L.k} mm above the base.`,
      style: "centre",
      primitives: [line([Q0[0] - u[0] * half, Q0[1] - u[1] * half], [Q0[0] + u[0] * half, Q0[1] + u[1] * half]), text([Q0[0] + u[0] * half + 1, Q0[1] + u[1] * half], "S.P.")],
    },
    {
      title: "Mark the cut points",
      explanation: L.labelled
        ? `Mark each point where the cutting line crosses an edge of the solid in the front view and number them 1 to ${L.corners.length}. These are the corners of the section.`
        : `Mark the points where the cutting line meets the generators of the solid in the front view. The more points you take, the smoother the curve.`,
      style: "construction",
      primitives: [...L.corners.map((c) => dot(F(c))), ...labels(F)],
    },
    {
      title: "Project to the top view",
      explanation: "Draw vertical projectors down from each point to the matching edge or generator in the top view. Each projector meets it at the top view of that point.",
      style: "construction",
      primitives: [...L.corners.map((c) => line(F(c), T(c))), ...labels(T)],
    },
    {
      title: "Sectional top view",
      explanation: "Join the points in order. This is the sectional top view: the part of the solid above the plane has been removed.",
      style: "outline",
      primitives: [{ t: "poly", pts: outline.map(T), closed: true }],
    },
    {
      title: "Auxiliary plane X1Y1",
      explanation: "The cutting plane is not parallel to the HP or the VP, so its true shape needs an auxiliary view. Draw X1Y1 parallel to the cutting line, and projectors from each point perpendicular to the cutting line.",
      style: "construction",
      primitives: [line(aux(smin - 12), aux(smax + 12)), text(aux(smin - 18), "X₁"), text(aux(smax + 14), "Y₁"), ...L.corners.map((c) => line(F(c), trueAt(c)))],
    },
    {
      title: "True shape of the section",
      explanation: `Along each projector, measure from X1Y1 the same distance the point is from XY in the top view. Join the points. The true shape is ${L.shapeName}, with an area of about ${round(area, 1)} mm².`,
      style: "outline",
      primitives: [{ t: "poly", pts: outline.map(trueAt), closed: true }, ...labels(trueAt)],
    },
  ];
  return { title: L.title, problem: L.problem, givens: L.givens, steps, solid: L.solid };
}

const polyFrontVisible = (base: Point[], e: number) => edgeNormal(base, e)[1] < -1e-9;

export type SectionPolyInput = { solid: "prism" | "pyramid"; base: RegularBase; side: number; height: number; angle: number; axisHeight: number };

export function solveSectionPolyhedron(i: SectionPolyInput): Result {
  const base = regularPolygon(SIDES[i.base], i.side);
  const n = base.length, h = i.height;
  const poly = i.solid === "prism" ? prismPoly(base, h) : pyramidPoly(base, h);
  const cut = cutPolyhedron(poly, i.axisHeight, i.angle);
  if (cut.length < 3) {
    return { ok: false, reason: `The cutting plane does not cut this solid. Try an axis height between 0 and ${h} mm, or a smaller angle.` };
  }
  const xs = base.map((p) => p[0]);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymax = Math.max(...base.map((p) => p[1]));
  const yOff = ymax + GAP;

  // front view: silhouette plus the inner edges, hidden ones dashed
  const vertVisible = base.map((_, v) => polyFrontVisible(base, (v + n - 1) % n) || polyFrontVisible(base, v));
  const inner = new Map<string, boolean>();
  base.forEach((p, v) => {
    if (p[0] - xmin < 1e-6 || xmax - p[0] < 1e-6) return;
    const key = p[0].toFixed(4);
    inner.set(key, (inner.get(key) ?? false) || vertVisible[v]);
  });
  const front: Primitive[] =
    i.solid === "prism"
      ? [{ t: "poly", closed: true, pts: [[xmin, 0], [xmax, 0], [xmax, h], [xmin, h]] }, ...[...inner].map(([x, vis]) => line([+x, 0], [+x, h], vis ? "outline" : "hidden"))]
      : [{ t: "poly", closed: true, pts: [[xmin, 0], [xmax, 0], [0, h]] }, ...[...inner].map(([x, vis]) => line([+x, 0], [0, h], vis ? "outline" : "hidden"))];
  const topBase = base.map(([x, y]) => [x, y - yOff] as Point);
  const top: Primitive[] = [
    { t: "poly", pts: topBase, closed: true },
    ...(i.solid === "pyramid" ? topBase.map((p) => line(p, [0, -yOff])) : []),
  ];

  const corners: Corner[] = cut.map((c) => ({ x: c.p[0], y: c.p[1], z: c.p[2], s: c.s }));
  const sides = corners.length;
  const names: Record<number, string> = { 3: "a triangle", 4: "a quadrilateral", 5: "a pentagon", 6: "a hexagon", 7: "a heptagon", 8: "an octagon" };
  const solidName = `${i.base} ${i.solid}`;
  const sol = buildSteps({
    title: `Section of a ${solidName}`,
    problem: `A ${solidName}, base side ${i.side} mm and height ${h} mm, stands on its base on the HP with a base edge parallel to the VP. It is cut by a plane perpendicular to the VP and inclined at ${i.angle}° to the HP, passing through the axis at ${i.axisHeight} mm above the base. Draw the sectional top view and the true shape of the section.`,
    givens: [
      { name: "Base side", value: `${i.side} mm` },
      { name: "Height", value: `${h} mm` },
      { name: "Plane to HP", value: `${i.angle}°` },
      { name: "Axis height", value: `${i.axisHeight} mm` },
    ],
    theta: i.angle, k: i.axisHeight, yOff, xmin, xmax,
    frontVerts: [...base.map((p) => [p[0], 0] as Point), ...(i.solid === "prism" ? base.map((p) => [p[0], h] as Point) : [[0, h] as Point])],
    front, top, corners, labelled: true, shapeName: names[sides] ?? `a ${sides}-sided polygon`,
    solid: i.solid === "prism" ? { kind: "extrude", profile: base, height: h } : { kind: "pyramid", profile: base, height: h },
  });
  return { ok: true, solution: sol };
}

export type SectionRoundInput = { solid: "cylinder" | "cone"; diameter: number; height: number; angle: number; axisHeight: number };

export function solveSectionRound(i: SectionRoundInput): Result {
  const r = i.diameter / 2, h = i.height, th = (i.angle * Math.PI) / 180, tan = Math.tan(th);
  const at = (phiDeg: number): Corner | null => {
    const p = (phiDeg * Math.PI) / 180, cx = Math.cos(p), sy = Math.sin(p);
    // height z where the plane meets the surface at azimuth phi
    const z = i.solid === "cylinder" ? i.axisHeight + r * cx * tan : (i.axisHeight + r * cx * tan) / (1 + (r / h) * cx * tan);
    if (!(z >= -1e-6 && z <= h + 1e-6)) return null;
    const rho = i.solid === "cylinder" ? r : r * (1 - z / h);
    const x = rho * cx;
    return { x, y: rho * sy, z, s: x / Math.cos(th) };
  };
  const marks = Array.from({ length: 12 }, (_, m) => at(m * 30));
  const dense = Array.from({ length: 72 }, (_, m) => at(m * 5));
  if (marks.includes(null) || dense.includes(null)) {
    return { ok: false, reason: "This plane leaves the solid through its base or top, so the section is not a closed ellipse. Raise the axis height, reduce the angle, or choose a different solid for now." };
  }
  const yOff = r + GAP;
  const front: Primitive[] = [{ t: "poly", closed: true, pts: i.solid === "cylinder" ? [[-r, 0], [r, 0], [r, h], [-r, h]] : [[-r, 0], [r, 0], [0, h]] }];
  const top: Primitive[] = [{ t: "circle", c: [0, -yOff], r }];
  const solidName = i.solid;
  const sol = buildSteps({
    title: `Section of a ${solidName}`,
    problem: `A ${solidName} of base diameter ${i.diameter} mm and height ${h} mm stands on its base on the HP. It is cut by a plane perpendicular to the VP and inclined at ${i.angle}° to the HP, passing through the axis at ${i.axisHeight} mm above the base. Draw the sectional top view and the true shape of the section.`,
    givens: [
      { name: "Diameter", value: `${i.diameter} mm` },
      { name: "Height", value: `${h} mm` },
      { name: "Plane to HP", value: `${i.angle}°` },
      { name: "Axis height", value: `${i.axisHeight} mm` },
    ],
    theta: i.angle, k: i.axisHeight, yOff, xmin: -r, xmax: r,
    frontVerts: i.solid === "cylinder" ? [[-r, 0], [r, 0], [r, h], [-r, h]] : [[-r, 0], [r, 0], [0, h]],
    front, top, corners: marks as Corner[], curve: dense as Corner[], labelled: false, shapeName: "an ellipse",
    solid: { kind: "revolve", profile: i.solid === "cylinder" ? [[0, 0], [r, 0], [r, h], [0, h]] : [[0, 0], [r, 0], [0, h]] },
  });
  return { ok: true, solution: sol };
}
