import { z } from "zod";
import type { Point, Primitive, Solution, Step } from "../schema";
import { circleIntersections, lineProjection, pentagonOnBase, round } from "./basic";
import { solveConeDevelopment, solveConic, solvePrismDevelopment, solvePyramidDevelopment } from "./extra";
import { solveIsometricCylinder, solveIsometricPrism } from "./isometric";
import { solveTilted } from "./tilt";
import { solveSectionPolyhedron, solveSectionRound } from "./sections";

/**
 * Deterministic solvers: the AI only classifies the problem and extracts the numbers (a Template);
 * the coordinates and the teaching order come from here, so the maths is never guessed.
 */
export const Template = z.discriminatedUnion("template", [
  z.object({
    template: z.literal("line_projection"),
    length: z.number().positive(),
    /** degrees to the HP / to the VP */
    thetaHP: z.number().min(0).max(90),
    phiVP: z.number().min(0).max(90),
  }),
  z.object({ template: z.literal("pentagon"), side: z.number().positive() }),
  z.object({ template: z.literal("cylinder_development"), diameter: z.number().positive(), height: z.number().positive() }),
  z.object({ template: z.literal("prism_views"), side: z.number().positive(), height: z.number().positive() }),
  z.object({
    template: z.literal("isometric_prism"),
    base: z.enum(["rectangle", "triangle", "square", "pentagon", "hexagon"]),
    /** side of a regular base, or the length of a rectangular one */
    side: z.number().positive(),
    width: z.number().positive().optional(),
    height: z.number().positive(),
    scale: z.enum(["isometric", "true"]).default("isometric"),
  }),
  z.object({ template: z.literal("isometric_cylinder"), diameter: z.number().positive(), height: z.number().positive(), scale: z.enum(["isometric", "true"]).default("isometric") }),
  z.object({
    template: z.literal("section_polyhedron"),
    solid: z.enum(["prism", "pyramid"]),
    base: z.enum(["triangle", "square", "pentagon", "hexagon"]),
    side: z.number().positive(),
    height: z.number().positive(),
    /** inclination of the section plane to the HP, degrees */
    angle: z.number().min(1).max(80),
    /** where the plane crosses the axis, mm above the base */
    axisHeight: z.number().min(0),
  }),
  z.object({
    template: z.literal("section_round"),
    solid: z.enum(["cylinder", "cone"]),
    diameter: z.number().positive(),
    height: z.number().positive(),
    angle: z.number().min(1).max(80),
    axisHeight: z.number().min(0),
  }),
  z.object({ template: z.literal("conic"), distance: z.number().positive(), eccentricity: z.number().positive() }),
  z.object({ template: z.literal("development_cone"), diameter: z.number().positive(), height: z.number().positive() }),
  z.object({ template: z.literal("development_pyramid"), base: z.enum(["triangle", "square", "pentagon", "hexagon"]), side: z.number().positive(), height: z.number().positive() }),
  z.object({ template: z.literal("development_prism"), base: z.enum(["triangle", "square", "pentagon", "hexagon"]), side: z.number().positive(), height: z.number().positive() }),
  z.object({
    template: z.literal("solid_inclined"),
    solid: z.enum(["prism", "pyramid", "cone"]),
    base: z.enum(["triangle", "square", "pentagon", "hexagon"]).optional(),
    /** base side (prism, pyramid) or base diameter (cone) */
    size: z.number().positive(),
    height: z.number().positive(),
    /** inclination of the axis to the HP, degrees */
    angle: z.number().min(1).max(89),
    /** inclination of the PLAN (top view) of the axis to the VP, degrees. Leave out when the axis is only tilted to the HP. */
    phi: z.number().min(1).max(89).optional(),
    rest: z.enum(["corner", "edge"]).default("corner"),
  }),
  z.object({
    template: z.literal("plane_inclined"),
    shape: z.enum(["triangle", "square", "pentagon", "hexagon", "circle"]),
    /** side, or diameter for a circle */
    size: z.number().positive(),
    /** inclination of the surface to the HP, degrees */
    angle: z.number().min(1).max(89),
    rest: z.enum(["corner", "edge"]).default("edge"),
  }),
]);
export type Template = z.infer<typeof Template>;

export type SolveResult = { ok: true; solution: Solution } | { ok: false; reason: string };

const deg = (r: number) => (r * 180) / Math.PI;
const line = (a: Point, b: Point): Extract<Primitive, { t: "line" }> => ({ t: "line", a, b });
const text = (at: Point, s: string, size?: number): Primitive => ({ t: "text", at, text: s, size });
const polygon = (pts: Point[]): Primitive[] => pts.map((p, i) => line(p, pts[(i + 1) % pts.length]));
/** Short arc centred on `c` passing through `p`, to show where an arc crosses. */
const arcThrough = (c: Point, r: number, p: Point, spread = 16): Primitive => {
  const a = deg(Math.atan2(p[1] - c[1], p[0] - c[0]));
  return { t: "arc", c, r, from: a - spread, to: a + spread };
};
const xyLine = (x0: number, x1: number): Primitive[] => [line([x0, 0], [x1, 0]), text([x0 - 6, 2], "X"), text([x1 + 2, 2], "Y")];

export function solveTemplate(t: Template): SolveResult {
  switch (t.template) {
    case "line_projection":
      return solveLineProjection(t.length, t.thetaHP, t.phiVP);
    case "pentagon":
      return { ok: true, solution: solvePentagon(t.side) };
    case "cylinder_development":
      return { ok: true, solution: solveCylinder(t.diameter, t.height) };
    case "prism_views":
      return { ok: true, solution: solvePrism(t.side, t.height) };
    case "isometric_prism":
      return solveIsometricPrism(t);
    case "isometric_cylinder":
      return solveIsometricCylinder(t);
    case "section_polyhedron":
      return solveSectionPolyhedron(t);
    case "section_round":
      return solveSectionRound(t);
    case "conic":
      return solveConic(t.distance, t.eccentricity);
    case "development_cone":
      return solveConeDevelopment(t.diameter, t.height);
    case "development_pyramid":
      return solvePyramidDevelopment(t.base, t.side, t.height);
    case "development_prism":
      return solvePrismDevelopment(t.base, t.side, t.height);
    case "solid_inclined":
      if (t.solid === "cone") return solveTilted({ solid: "cone", diameter: t.size, height: t.height, angle: t.angle, phi: t.phi });
      if (!t.base) return { ok: false, reason: "Tell me the base shape (triangle, square, pentagon or hexagon)." };
      return solveTilted({ solid: t.solid, base: t.base, side: t.size, height: t.height, angle: t.angle, rest: t.rest, phi: t.phi });
    case "plane_inclined":
      return solveTilted({ shape: t.shape, size: t.size, angle: t.angle, rest: t.rest });
  }
}

export function solveLineProjection(L: number, theta: number, phi: number): SolveResult {
  const p = lineProjection(L, theta, phi);
  if (!p.feasible) {
    return {
      ok: false,
      reason: `Not possible: sin²θ + sin²φ must be ≤ 1, but sin²${theta}° + sin²${phi}° = ${round(
        Math.sin((theta * Math.PI) / 180) ** 2 + Math.sin((phi * Math.PI) / 180) ** 2,
        3,
      )}.`,
    };
  }
  const ax = 10;
  const a: Point = [ax, 0];
  const bFront: Point = [ax + p.dx, p.height];
  const bTop: Point = [ax + p.dx, -p.depth];
  const right = ax + L + 20;
  const th = (theta * Math.PI) / 180;
  const ph = (phi * Math.PI) / 180;
  const steps: Step[] = [
    {
      title: "Reference line",
      explanation:
        "Draw the XY reference line. Everything above it is the front view (FV), everything below is the top view (TV). End A is on both planes, so a' and a coincide on XY.",
      style: "outline",
      primitives: [...xyLine(0, right), text([ax - 4, 3], "a'"), text([ax - 4, -5], "a")],
    },
    {
      title: `True length at ${theta}° to HP (front view)`,
      explanation: `Draw a'b₁' = ${L} mm at ${theta}° to XY. Its vertical rise is the true height of B: ${round(p.height)} mm. Draw a horizontal locus through b₁' - the front view of B must lie on it.`,
      style: "construction",
      primitives: [
        line(a, [ax + L * Math.cos(th), p.height]),
        text([ax + L * Math.cos(th) + 2, p.height + 2], "b₁'"),
        line([ax, p.height], [right, p.height]),
        text([right - 10, p.height + 3], "locus of b'"),
      ],
    },
    {
      title: `True length at ${phi}° to VP (top view)`,
      explanation: `In the top view draw ab₂ = ${L} mm at ${phi}° to XY. Its depth is ${round(p.depth)} mm, so B lies on a horizontal locus ${round(p.depth)} mm below XY.`,
      style: "construction",
      primitives: [
        line(a, [ax + L * Math.cos(ph), -p.depth]),
        text([ax + L * Math.cos(ph) + 2, -p.depth - 6], "b₂"),
        line([ax, -p.depth], [right, -p.depth]),
        text([right - 10, -p.depth - 6], "locus of b"),
      ],
    },
    {
      title: "Find b' with a compass",
      explanation: `The front view a'b' has length L·cos φ = ${round(p.frontLength)} mm. With centre a' and that radius, swing an arc up to the height locus. It meets it at b'.`,
      style: "construction",
      primitives: [
        { t: "arc", c: a, r: p.frontLength, from: 0, to: deg(Math.atan2(p.height, p.dx)) },
        text([bFront[0] + 2, bFront[1] + 2], "b'"),
      ],
    },
    {
      title: "Project down to find b",
      explanation: "Drop a vertical projector from b' until it meets the depth locus in the top view. That point is b.",
      style: "construction",
      primitives: [line(bFront, bTop), text([bTop[0] + 2, bTop[1] - 6], "b")],
    },
    {
      title: "Join the final views",
      explanation: `Join a'b' (front view, ${round(p.frontLength)} mm) and ab (top view, ${round(p.topLength)} mm) with thick outline lines. The true length ${L} mm is inclined ${theta}° to HP and ${phi}° to VP.`,
      style: "outline",
      primitives: [line(a, bFront), line(a, bTop)],
    },
  ];
  return {
    ok: true,
    solution: {
      title: "Projections of a line",
      problem: `A line AB, ${L} mm long, is inclined at ${theta}° to the HP and ${phi}° to the VP. Draw its projections.`,
      givens: [
        { name: "True length", value: `${L} mm` },
        { name: "Inclination to HP (θ)", value: `${theta}°` },
        { name: "Inclination to VP (φ)", value: `${phi}°` },
      ],
      steps,
    },
  };
}

export function solvePentagon(s: number): Solution {
  const { A, B, C, D, E, diag } = pentagonOnBase(s);
  const M: Point = [s / 2, 0];
  const P: Point = [s, s];
  const mc = Math.hypot(P[0] - M[0], P[1] - M[1]);
  const F: Point = [M[0] + mc, 0];
  return {
    title: "Regular pentagon on a given side",
    problem: `Construct a regular pentagon of side ${s} mm.`,
    givens: [{ name: "Side", value: `${s} mm` }],
    steps: [
      { title: "Draw the base", explanation: `Draw AB = ${s} mm.`, style: "outline", primitives: [line(A, B), text([-4, -4], "A"), text([s + 1, -4], "B")] },
      {
        title: "Bisect AB and erect a perpendicular",
        explanation: "Mark the midpoint M of AB. At B draw a perpendicular BP equal to AB.",
        style: "construction",
        primitives: [line([s, 0], P), text([s + 1, s], "P"), text([M[0] - 1, -4], "M")],
      },
      {
        title: "Find the diagonal length",
        explanation: `Join M to P. With centre M and radius MP swing an arc to meet AB extended at F. Then AF = ${round(diag)} mm is the diagonal of the pentagon.`,
        style: "construction",
        primitives: [line(M, P), { t: "arc", c: M, r: mc, from: 0, to: deg(Math.atan2(P[1], P[0] - M[0])) }, line(B, F), text([F[0] + 1, -4], "F")],
      },
      {
        title: "Mark the apex D",
        explanation: `With radius AF = ${round(diag)} mm, draw arcs from A and from B. They cross at D, the top vertex.`,
        style: "construction",
        primitives: [arcThrough(A, diag, D), arcThrough(B, diag, D), text([D[0] + 1, D[1] + 1], "D")],
      },
      {
        title: "Mark the side vertices E and C",
        explanation: `With radius ${s} mm from A and radius ${round(diag)} mm from B the arcs cross at E. Mirror it: radius ${s} mm from B and ${round(diag)} mm from A give C.`,
        style: "construction",
        primitives: [arcThrough(A, s, E), arcThrough(B, diag, E), arcThrough(B, s, C), arcThrough(A, diag, C), text([E[0] - 5, E[1]], "E"), text([C[0] + 1, C[1]], "C")],
      },
      { title: "Join the vertices", explanation: "Join A-B-C-D-E-A with thick lines. The pentagon is complete.", style: "outline", primitives: polygon([A, B, C, D, E]) },
    ],
  };
}

export function solveCylinder(d: number, h: number): Solution {
  const r = d / 2;
  const topCentre: Point = [r, -(r + 15)];
  const circ = Math.PI * d;
  const x0 = d + 30;
  return {
    title: "Development of a cylinder",
    problem: `Draw the projections and the development of a cylinder of diameter ${d} mm and height ${h} mm, axis vertical.`,
    givens: [
      { name: "Diameter", value: `${d} mm` },
      { name: "Height", value: `${h} mm` },
    ],
    steps: [
      { title: "Reference line and front view", explanation: `Draw XY. The front view of a vertical cylinder is a rectangle ${d} mm wide and ${h} mm high.`, style: "outline", primitives: [...xyLine(-10, x0 + circ + 10), ...polygon([[0, 0], [d, 0], [d, h], [0, h]])] },
      {
        title: "Top view",
        explanation: `Directly below, the top view is a circle of diameter ${d} mm. Add centre lines.`,
        style: "outline",
        primitives: [{ t: "circle", c: topCentre, r }, { ...line([topCentre[0] - r - 4, topCentre[1]], [topCentre[0] + r + 4, topCentre[1]]), style: "centre" }, { ...line([topCentre[0], topCentre[1] - r - 4], [topCentre[0], topCentre[1] + r + 4]), style: "centre" }],
      },
      {
        title: "Length of the development",
        explanation: `When the curved surface is unrolled, its length equals the circumference: πd = π × ${d} = ${round(circ)} mm. Draw a horizontal line of that length.`,
        style: "construction",
        primitives: [line([x0, 0], [x0 + circ, 0]), text([x0 + circ / 2 - 12, -6], `πd = ${round(circ)}`)],
      },
      { title: "Complete the rectangle", explanation: `Erect two verticals ${h} mm high at the ends and join them. The curved surface of the cylinder is this ${round(circ)} × ${h} mm rectangle.`, style: "outline", primitives: polygon([[x0, 0], [x0 + circ, 0], [x0 + circ, h], [x0, h]]) },
    ],
    solid: { kind: "revolve", profile: [[0, 0], [r, 0], [r, h], [0, h]] },
  };
}

export function solvePrism(a: number, h: number): Solution {
  const gap = 15;
  const sq: Point[] = [[0, -gap], [a, -gap], [a, -gap - a], [0, -gap - a]];
  return {
    title: "Views of a square prism",
    problem: `A square prism of base side ${a} mm and height ${h} mm rests on its base on the HP. Draw its front and top views.`,
    givens: [
      { name: "Base side", value: `${a} mm` },
      { name: "Height", value: `${h} mm` },
    ],
    steps: [
      { title: "Reference line", explanation: "Draw XY. Front view above, top view below.", style: "outline", primitives: xyLine(-10, a + 15) },
      { title: "Top view first", explanation: `The prism stands on its base, so the top view shows the true shape: a ${a} mm square placed ${gap} mm below XY (the prism is ${gap} mm in front of the VP).`, style: "outline", primitives: polygon(sq) },
      { title: "Project upward", explanation: "Draw vertical projectors up from the corners of the top view, and mark the height.", style: "construction", primitives: [line([0, -gap], [0, h]), line([a, -gap], [a, h]), text([a + 2, h], `${h} mm`)] },
      { title: "Front view", explanation: `The base lies on XY (it is on the HP). Cut the projectors at height ${h} mm and draw the rectangle ${a} × ${h} mm.`, style: "outline", primitives: polygon([[0, 0], [a, 0], [a, h], [0, h]]) },
    ],
    solid: { kind: "extrude", profile: [[0, 0], [a, 0], [a, a], [0, a]], height: h },
  };
}

// re-exported for tests
export { circleIntersections };
