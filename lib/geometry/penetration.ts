import type { Point, Primitive, Solution, Step } from "../schema";
import { round } from "./basic";

type Result = { ok: true; solution: Solution } | { ok: false; reason: string };

const line = (a: Point, b: Point, style?: "construction" | "outline" | "hidden" | "centre"): Primitive => ({ t: "line", a, b, ...(style ? { style } : {}) });
const text = (at: Point, s: string): Primitive => ({ t: "text", at, text: s });
const dot = (c: Point): Primitive => ({ t: "circle", c, r: 0.8 });
const GAP = 18;
const rect = (x0: number, z0: number, x1: number, z1: number, style?: "construction" | "outline" | "hidden"): Primitive[] =>
  [line([x0, z0], [x1, z0], style), line([x1, z0], [x1, z1], style), line([x1, z1], [x0, z1], style), line([x0, z1], [x0, z0], style)];

export type CylinderPenetration = {
  mainDiameter: number;
  mainHeight: number;
  branchDiameter: number;
  /** height of the branch axis above the base of the main cylinder; defaults to half the height */
  axisHeight?: number;
};

/**
 * A vertical cylinder pierced by a smaller horizontal cylinder whose axis meets the main axis at right angles
 * and is parallel to the VP. The curve of intersection is found by dividing the branch's end circle (seen in the
 * left side view) into 12 equal parts.
 */
export function solveCylinderPenetration(i: CylinderPenetration): Result {
  const R = i.mainDiameter / 2, r = i.branchDiameter / 2, H = i.mainHeight;
  const zc = i.axisHeight ?? H / 2;
  if (r > R + 1e-9) return { ok: false, reason: "The cylinder that passes through must not be larger than the vertical cylinder. Swap them, or reduce its diameter." };
  if (zc - r < -1e-9 || zc + r > H + 1e-9) return { ok: false, reason: `The branch cylinder does not fit inside the height of the main one. Its axis must be between ${round(r)} mm and ${round(H - r)} mm above the base.` };

  const L = R + 15; // half-length of the branch
  const cxSV = L + 25 + R; // centre line of the side view
  const cyTV = -(R + GAP); // centre of the top view
  const ts = Array.from({ length: 12 }, (_, k) => 30 * k);
  const rad = (d: number) => (d * Math.PI) / 180;
  const yOf = (t: number) => r * Math.cos(rad(t)); // depth of the point (positive towards the viewer)
  const zOf = (t: number) => zc + r * Math.sin(rad(t));
  const xOf = (t: number) => Math.sqrt(Math.max(0, R * R - yOf(t) ** 2));
  const svPt = (t: number): Point => [cxSV + yOf(t), zOf(t)];
  const label = (t: number) => String(((t / 30) % 12) + 1);

  // the main cylinder in three views; the part of each silhouette that the branch cuts through is a thin line
  const mainFV: Primitive[] = [
    line([-R, 0], [R, 0]), line([-R, H], [R, H]),
    line([-R, 0], [-R, zc - r]), line([R, 0], [R, zc - r]), line([-R, zc + r], [-R, H]), line([R, zc + r], [R, H]),
    line([-R, zc - r], [-R, zc + r], "construction"), line([R, zc - r], [R, zc + r], "construction"),
  ];
  const mainTV: Primitive[] = [{ t: "circle", c: [0, cyTV], r: R }, line([-R - 4, cyTV], [R + 4, cyTV], "centre"), line([0, cyTV - R - 4], [0, cyTV + R + 4], "centre")];
  const mainSV: Primitive[] = rect(cxSV - R, 0, cxSV + R, H);
  const xyEnd = cxSV + R + 12;

  // front-view curve (right and left branches) and top-view marks
  const curveT = Array.from({ length: 37 }, (_, m) => -90 + 5 * m);
  const right: Point[] = curveT.map((t) => [xOf(t), zOf(t)]);
  const left: Point[] = right.map(([x, z]) => [-x, z] as Point);

  const fvBranch: Primitive[] = [
    line([R, zc + r], [L, zc + r]), line([R, zc - r], [L, zc - r]), line([L, zc - r], [L, zc + r]),
    line([-R, zc + r], [-L, zc + r]), line([-R, zc - r], [-L, zc - r]), line([-L, zc - r], [-L, zc + r]),
  ];
  const xc = Math.sqrt(R * R - r * r);
  const tvBranch: Primitive[] = [
    line([xc, cyTV - r], [L, cyTV - r]), line([xc, cyTV + r], [L, cyTV + r]), line([L, cyTV - r], [L, cyTV + r]),
    line([-xc, cyTV - r], [-L, cyTV - r]), line([-xc, cyTV + r], [-L, cyTV + r]), line([-L, cyTV - r], [-L, cyTV + r]),
    line([-xc, cyTV - r], [xc, cyTV - r], "hidden"), line([-xc, cyTV + r], [xc, cyTV + r], "hidden"),
  ];

  const steps: Step[] = [
    {
      title: "Views of the vertical cylinder",
      explanation: `Draw XY. The vertical cylinder (diameter ${i.mainDiameter} mm, height ${H} mm) is a rectangle in the front view, a circle in the top view, and a rectangle in the left side view placed to the right.`,
      style: "outline",
      primitives: [line([-R - 10, 0], [xyEnd, 0]), text([-R - 16, 2], "X"), text([xyEnd + 2, 2], "Y"), ...mainFV, ...mainTV, ...mainSV],
    },
    {
      title: "The penetrating cylinder",
      explanation: `The horizontal cylinder (diameter ${i.branchDiameter} mm) has its axis ${round(zc)} mm above the base, parallel to the VP and meeting the vertical axis. In the side view you look straight along it, so it is a circle. In the front view it is a rectangle and in the top view a strip ${i.branchDiameter} mm wide.`,
      style: "outline",
      primitives: [{ t: "circle", c: [cxSV, zc], r }, line([cxSV - r - 4, zc], [cxSV + r + 4, zc], "centre"), line([cxSV, zc - r - 4], [cxSV, zc + r + 4], "centre"), ...fvBranch, ...tvBranch],
    },
    {
      title: "Divide the circle into 12 parts",
      explanation: "In the side view, divide the circle of the branch into 12 equal parts and number the points 1 to 12. Each point is a place where the surface of the branch meets the surface of the main cylinder.",
      style: "construction",
      primitives: ts.flatMap((t) => [dot(svPt(t)), text([svPt(t)[0] + 1.5, svPt(t)[1] + 1.5], label(t))]),
    },
    {
      title: "Find the points in the top view",
      explanation: `Each point is ${round(r)}·cos θ from the axis in the side view, which is its depth in the top view. Draw a line across the top-view circle at that depth. The vertical cylinder is end-on in the top view, so the point must lie where this line meets the circle (on both the left and the right).`,
      style: "construction",
      primitives: ts.flatMap((t) => {
        const y = yOf(t), x = xOf(t), v = cyTV - y;
        return [line([-x, v], [x, v]), dot([x, v]), dot([-x, v])];
      }),
    },
    {
      title: "Project up to the front view",
      explanation: "From each point in the top view draw a vertical line up to the front view. From the same numbered point in the side view draw a horizontal line across to the front view. Where they cross is the front view of that point.",
      style: "construction",
      primitives: ts.flatMap((t) => {
        const x = xOf(t), z = zOf(t), v = cyTV - yOf(t);
        return [line([x, v], [x, z]), line([-x, v], [-x, z]), line(svPt(t), [-x, z]), text([x + 1, z + 1], label(t))];
      }),
    },
    {
      title: "Draw the curve of intersection",
      explanation: `Join the points in order with a smooth curve on each side. This is the line of interpenetration. Because the branch is ${r === R ? "the same size as the main cylinder, the curves become straight lines" : "smaller than the main cylinder, the curves bend towards the axis"}. The lines of the branch stop where they meet the curve.`,
      style: "outline",
      primitives: [{ t: "poly", pts: right }, { t: "poly", pts: left }],
    },
  ];
  return {
    ok: true,
    solution: {
      title: "Interpenetration of two cylinders",
      problem: `A vertical cylinder of diameter ${i.mainDiameter} mm and height ${H} mm is pierced by a horizontal cylinder of diameter ${i.branchDiameter} mm. Their axes intersect at right angles, and the axis of the horizontal cylinder is ${round(zc)} mm above the base and parallel to the VP. Draw the curves of intersection.`,
      givens: [
        { name: "Vertical cylinder", value: `Ø${i.mainDiameter} × ${H} mm` },
        { name: "Horizontal cylinder", value: `Ø${i.branchDiameter} mm` },
        { name: "Branch axis height", value: `${round(zc)} mm` },
      ],
      steps,
    },
  };
}
