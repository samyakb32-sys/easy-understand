import type { Point, Primitive, Solution, Step } from "../schema";
import { round } from "./basic";
import { SIDES, type RegularBase } from "./solids";

type Result = { ok: true; solution: Solution } | { ok: false; reason: string };

const deg = (r: number) => (r * 180) / Math.PI;
const line = (a: Point, b: Point, style?: "construction" | "outline" | "hidden" | "centre"): Primitive => ({ t: "line", a, b, ...(style ? { style } : {}) });
const text = (at: Point, s: string): Primitive => ({ t: "text", at, text: s });
const poly = (pts: Point[], style: "construction" | "outline" | "hidden" | "centre" = "outline"): Primitive[] => pts.map((p, i) => line(p, pts[(i + 1) % pts.length], style));

// ---------------------------------------------------------------- engineering curves

/**
 * Conic by the eccentricity (focus-directrix) method: PF = e x PD.
 * Directrix is the line x = 0 and the focus F is on the axis at x = d.
 */
export function solveConic(d: number, e: number): Result {
  if (!(e > 0) || e > 6) return { ok: false, reason: "The eccentricity must be between 0 and 6." };
  if (e > 0.95 && e < 1) return { ok: false, reason: "An eccentricity this close to 1 gives an ellipse far too long to draw. Use e between 0 and 0.95." };
  const kind = Math.abs(e - 1) < 1e-9 ? "parabola" : e < 1 ? "ellipse" : "hyperbola";
  const xv = d / (1 + e);
  const xEnd = kind === "ellipse" ? d / (1 - e) : xv + 2.5 * d;
  const yAt = (x: number) => Math.sqrt(Math.max(0, e * e * x * x - (x - d) ** 2));
  // `smooth` packs the curve points towards V (x grows with the square of i, so y is about even), otherwise the first chords from the vertex of a parabola or hyperbola are nearly vertical and V draws as a kink
  const spaced = (i: number, n: number, smooth = false) =>
    kind === "ellipse" ? xv + ((xEnd - xv) * (1 - Math.cos((Math.PI * i) / n))) / 2 : xv + (xEnd - xv) * (smooth ? (i / n) ** 2 : i / n);

  const M = 8;
  const marks = Array.from({ length: M }, (_, k) => spaced(k + 1, M + 1));
  const N = 80;
  const upper: Point[] = Array.from({ length: N + 1 }, (_, k) => {
    const x = spaced(k, N, true);
    return [x, yAt(x)] as Point;
  });
  const lower: Point[] = upper.map(([x, y]) => [x, -y] as Point).reverse();
  const curve: Point[] = kind === "ellipse" ? [...upper, ...lower.slice(1, -1)] : [...lower, ...upper.slice(1)];
  const yMax = Math.max(...upper.map((p) => p[1])) + 8;

  const steps: Step[] = [
    {
      title: "Directrix, axis and focus",
      explanation: `Draw the directrix and, perpendicular to it, the axis. Mark the focus F on the axis ${d} mm from the directrix (point D).`,
      style: "outline",
      primitives: [line([0, -yMax], [0, yMax]), line([-8, 0], [xEnd + 10, 0], "centre"), text([-5, -4], "D"), { t: "circle", c: [d, 0], r: 0.9 }, text([d + 1, 2], "F"), text([2, yMax - 4], "directrix")],
    },
    {
      title: "Find the vertex V",
      explanation: `The vertex divides DF so that VF : VD = e = ${round(e, 3)}. Hence VD = d/(1 + e) = ${round(xv)} mm and VF = ${round(d - xv)} mm (measured ${d - xv >= 0 ? "towards" : "beyond"} F). Mark V.`,
      style: "construction",
      primitives: [{ t: "circle", c: [xv, 0], r: 0.9 }, text([xv - 1, -5], "V")],
    },
    {
      title: "Mark points on the axis",
      explanation: `Mark points 1, 2, 3 … on the axis beyond V, at any convenient spacing. Draw a perpendicular through each. Each point P on the curve satisfies PF = ${round(e, 3)} × (distance of that perpendicular from the directrix).`,
      style: "construction",
      primitives: marks.flatMap((x, i) => {
        const h = yAt(x) + 4;
        return [line([x, -h], [x, h]), text([x - 1, -h - 5], String(i + 1))];
      }),
    },
    {
      title: "Swing arcs from the focus",
      explanation: `For each point, set the compass to e × (its distance from the directrix) and, with centre F, cut the perpendicular above and below the axis. Each cut is a point on the ${kind}.`,
      style: "construction",
      primitives: marks.flatMap((x) => {
        const y = yAt(x);
        const rho = e * x;
        const ang = deg(Math.atan2(y, x - d));
        return rho > 0 ? [{ t: "arc" as const, c: [d, 0] as Point, r: rho, from: ang - 6, to: ang + 6 }, { t: "arc" as const, c: [d, 0] as Point, r: rho, from: -ang - 6, to: -ang + 6 }] : [];
      }),
    },
    {
      title: `Draw the ${kind}`,
      explanation: kind === "ellipse"
        ? "Join the points with a smooth curve through V and the second vertex. This closed curve is the ellipse (e < 1)."
        : kind === "parabola"
          ? "Join the points with a smooth curve through V. For e = 1 this is the parabola, open on the side away from the directrix."
          : "Join the points with a smooth curve through V. For e > 1 this is one branch of the hyperbola.",
      style: "outline",
      primitives: [{ t: "poly", pts: curve, closed: kind === "ellipse" }],
    },
  ];
  return {
    ok: true,
    solution: {
      title: `${kind[0].toUpperCase()}${kind.slice(1)} by the eccentricity method`,
      problem: `Draw a ${kind} when the distance of the focus from the directrix is ${d} mm and the eccentricity is ${round(e, 3)}.`,
      givens: [{ name: "Focus to directrix", value: `${d} mm` }, { name: "Eccentricity", value: String(round(e, 3)) }],
      steps,
    },
  };
}

// ---------------------------------------------------------------- developments

/** Right circular cone. */
export function solveConeDevelopment(d: number, h: number): Result {
  const r = d / 2;
  const L = Math.hypot(r, h);
  const phi = (360 * r) / L;
  const x0 = d + 30;
  const O: Point = [x0 + L, L];
  const a0 = -90 - phi / 2, a1 = -90 + phi / 2;
  const pt = (a: number): Point => [O[0] + L * Math.cos((a * Math.PI) / 180), O[1] + L * Math.sin((a * Math.PI) / 180)];
  const topC: Point = [r, -(r + 15)];
  const steps: Step[] = [
    { title: "Front view", explanation: `Draw XY. The front view of the cone is an isosceles triangle with base ${d} mm and height ${h} mm.`, style: "outline", primitives: [line([-10, 0], [x0 + 2 * L + 10, 0]), text([-16, 2], "X"), text([x0 + 2 * L + 12, 2], "Y"), ...poly([[0, 0], [d, 0], [r, h]])] },
    { title: "Top view", explanation: `Directly below, the top view is a circle of diameter ${d} mm.`, style: "outline", primitives: [{ t: "circle", c: topC, r }, line([topC[0] - r - 4, topC[1]], [topC[0] + r + 4, topC[1]], "centre"), line([topC[0], topC[1] - r - 4], [topC[0], topC[1] + r + 4], "centre")] },
    { title: "True slant length", explanation: `The slant side of the front view is the true length of a generator: L = √(r² + h²) = √(${round(r)}² + ${h}²) = ${round(L)} mm.`, style: "construction", primitives: [line([r, h], [d, 0]), text([d + 1, h / 2], `L = ${round(L)}`)] },
    { title: "Swing the arc", explanation: `Mark a centre O. With radius L = ${round(L)} mm swing a large arc. The arc will carry the whole curved surface.`, style: "construction", primitives: [{ t: "arc", c: O, r: L, from: a0, to: a1 }, text([O[0] - 2, O[1] + 3], "O")] },
    { title: "Find the sector angle", explanation: `The arc length must equal the base circumference, so the sector angle is φ = 360° × r / L = 360° × ${round(r)} / ${round(L)} = ${round(phi)}°. Draw the two bounding radii.`, style: "outline", primitives: [line(O, pt(a0)), line(O, pt(a1)), text([O[0] - 6, O[1] - L / 2], `φ = ${round(phi)}°`)] },
    { title: "Finish the sector", explanation: `The sector of radius ${round(L)} mm and angle ${round(phi)}° is the development of the curved surface of the cone. Arc length = π × ${d} = ${round(Math.PI * d)} mm.`, style: "outline", primitives: [{ t: "arc", c: O, r: L, from: a0, to: a1 }] },
  ];
  return {
    ok: true,
    solution: {
      title: "Development of a cone",
      problem: `Draw the projections and the development of the curved surface of a cone of base diameter ${d} mm and axis ${h} mm.`,
      givens: [{ name: "Base diameter", value: `${d} mm` }, { name: "Axis", value: `${h} mm` }],
      steps,
      solid: { kind: "revolve", profile: [[0, 0], [r, 0], [0, h]] },
    },
  };
}

/** Right regular pyramid. */
export function solvePyramidDevelopment(base: RegularBase, s: number, h: number): Result {
  const n = SIDES[base];
  const R = s / (2 * Math.sin(Math.PI / n));
  const e = Math.hypot(R, h);
  const step = 2 * Math.asin(s / (2 * e));
  if (n * step >= 2 * Math.PI) return { ok: false, reason: "These sizes do not make a closed pyramid." };
  const gap = 25;
  const Ob: Point = [R, 0]; // centre of the base in the top view
  // one base side parallel to XY (for an even n a corner would point up and the square would stand on its corner)
  const turn = Math.PI / 2 + (n % 2 === 0 ? Math.PI / n : 0);
  const vertex = (k: number): Point => [Ob[0] + R * Math.cos((2 * Math.PI * k) / n + turn), Ob[1] + R * Math.sin((2 * Math.PI * k) / n + turn)];
  const V = Array.from({ length: n }, (_, k) => vertex(k));
  const x0 = 2 * R + gap;
  const O: Point = [x0 + e, e + 5];
  const start = -Math.PI / 2 - (n * step) / 2;
  const P = Array.from({ length: n + 1 }, (_, k) => [O[0] + e * Math.cos(start + k * step), O[1] + e * Math.sin(start + k * step)] as Point);
  const a0 = deg(start), a1 = deg(start + n * step);
  const name = `${base} pyramid`;
  // right triangle for the true length of an edge, below the top view
  const ty = -(R + 15 + h);
  const steps: Step[] = [
    { title: "Top view", explanation: `Draw the regular ${base} of side ${s} mm (the base) and join each corner to the centre. The centre-to-corner distance is ${round(R)} mm.`, style: "outline", primitives: [...poly(V), ...V.map((v) => line(Ob, v, "construction"))] },
    { title: "True length of a slant edge", explanation: `In the top view the edges are shortened. Make a right triangle with one leg = ${round(R)} mm (centre to corner) and the other leg = height ${h} mm. The hypotenuse is the true edge length: ${round(e)} mm.`, style: "construction", primitives: [line([0, ty], [R, ty]), line([R, ty], [R, ty + h]), line([0, ty], [R, ty + h], "outline"), text([R / 2 - 3, ty - 5], `${round(R)}`), text([R + 2, ty + h / 2], `${h}`), text([R / 4 - 14, ty + h / 2 + 8], `${round(e)}`)] },
    { title: "Swing the arc", explanation: `Mark a centre O. With radius ${round(e)} mm (the true edge length) swing a long arc.`, style: "construction", primitives: [{ t: "arc", c: O, r: e, from: a0 - 4, to: a1 + 4 }, text([O[0] - 2, O[1] + 3], "O")] },
    { title: "Step off the base sides", explanation: `From a point on the arc, step off ${n} chords, each equal to the base side ${s} mm. Join the first and last to O.`, style: "construction", primitives: [...P.slice(0, -1).map((p, k) => line(p, P[k + 1], "outline")), line(O, P[0], "outline"), line(O, P[n], "outline")] },
    { title: "Join to the apex", explanation: `Join every chord end to O. These ${n} triangles are the faces of the ${name}: together they are the development of its lateral surface.`, style: "outline", primitives: P.slice(1, -1).map((p) => line(O, p)) },
  ];
  return {
    ok: true,
    solution: {
      title: `Development of a ${name}`,
      problem: `A ${name} has a base side of ${s} mm and an axis of ${h} mm. Draw its top view and the development of its lateral surface.`,
      givens: [{ name: "Base side", value: `${s} mm` }, { name: "Axis", value: `${h} mm` }],
      steps,
      solid: { kind: "pyramid", profile: V.map((v) => [v[0] - R, v[1]] as Point), height: h },
    },
  };
}

/** Right regular prism: the lateral surface is n rectangles in a row, with both bases attached. */
export function solvePrismDevelopment(base: RegularBase, s: number, h: number): Result {
  const n = SIDES[base];
  const R = s / (2 * Math.sin(Math.PI / n));
  const apothem = R * Math.cos(Math.PI / n);
  const x0 = 2 * R + 25;
  const ngon = (cx: number, cy: number, start: number): Point[] => Array.from({ length: n }, (_, k) => [cx + R * Math.cos(start + (2 * Math.PI * k) / n), cy + R * Math.sin(start + (2 * Math.PI * k) / n)] as Point);
  const baseTV = ngon(R, h / 2, Math.PI / n - Math.PI / 2);
  const cx = x0 + s / 2;
  const bottom = ngon(cx, -apothem, Math.PI / 2 + Math.PI / n);
  const top = ngon(cx, h + apothem, -Math.PI / 2 + Math.PI / n);
  const total = n * s;
  const name = `${base} prism`;
  const steps: Step[] = [
    { title: "Base shape", explanation: `Draw the regular ${base} of side ${s} mm. This is the shape of the top and bottom faces.`, style: "outline", primitives: poly(baseTV) },
    { title: "Stretch out the base", explanation: `The ${n} side faces open out into a row. Draw a horizontal line of length ${n} × ${s} = ${round(total)} mm and mark ${n} equal parts of ${s} mm.`, style: "construction", primitives: [line([x0, 0], [x0 + total, 0]), ...Array.from({ length: n + 1 }, (_, k) => line([x0 + k * s, -1.5], [x0 + k * s, 1.5]))] },
    { title: "Erect the heights", explanation: `Draw a vertical of ${h} mm at every division and join the tops. Each rectangle ${s} × ${h} mm is one side face.`, style: "outline", primitives: [...Array.from({ length: n + 1 }, (_, k) => line([x0 + k * s, 0], [x0 + k * s, h])), line([x0, h], [x0 + total, h]), line([x0, 0], [x0 + total, 0])] },
    { title: "Attach the bases", explanation: "Attach the regular polygon to the bottom of one rectangle and to the top of the same (or another) rectangle. The development of the whole surface of the prism is complete.", style: "outline", primitives: [...poly(bottom), ...poly(top)] },
  ];
  return {
    ok: true,
    solution: {
      title: `Development of a ${name}`,
      problem: `A ${name} has a base side of ${s} mm and an axis of ${h} mm. Draw the development of its surface.`,
      givens: [{ name: "Base side", value: `${s} mm` }, { name: "Axis", value: `${h} mm` }],
      steps,
      solid: { kind: "extrude", profile: ngon(0, 0, 0), height: h },
    },
  };
}
