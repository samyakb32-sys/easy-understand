import type { Point, Primitive, Solution, Step } from "../schema";
import { ellipsePoint, round } from "./basic";
import { edgeNormal, regularPolygon, SIDES, type RegularBase } from "./solids";

export const ISO_SCALE = Math.sqrt(2 / 3); // 0.8165: isometric scale (true length -> isometric length)
const C30 = Math.cos(Math.PI / 6), S30 = 0.5;

/**
 * Isometric projection of a 3D point. x runs up-right, y up-left, z straight up.
 * Viewer is in front of and above the (0,0,0) corner, so larger x+y is further away.
 */
export function isoPoint(x: number, y: number, z: number, k: number): Point {
  return [(x - y) * C30 * k, (x + y) * S30 * k + z * k];
}

const line = (a: Point, b: Point, style?: Extract<Primitive, { t: "line" }>["style"]): Primitive => ({ t: "line", a, b, style });
const text = (at: Point, s: string, size?: number): Primitive => ({ t: "text", at, text: s, size });
const scaleName = (k: number) => (k === 1 ? "true lengths (isometric drawing)" : "the isometric scale, 0.816 × true length (isometric projection)");

export type IsoPrismInput = { base: "rectangle" | RegularBase; side: number; width?: number; height: number; scale: "isometric" | "true" };

/** Base polygon in plan, counter-clockwise, shifted so its front corner box starts at (0,0). */
function basePolygon(i: IsoPrismInput): Point[] | string {
  let pts: Point[];
  if (i.base === "rectangle") {
    if (!i.width) return "A rectangular base needs both a length and a width.";
    pts = [[0, 0], [i.side, 0], [i.side, i.width], [0, i.width]];
  } else pts = regularPolygon(SIDES[i.base], i.side);
  const x0 = Math.min(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1]));
  return pts.map(([x, y]) => [x - x0, y - y0] as Point);
}

export function solveIsometricPrism(i: IsoPrismInput): { ok: true; solution: Solution } | { ok: false; reason: string } {
  const base = basePolygon(i);
  if (typeof base === "string") return { ok: false, reason: base };
  const k = i.scale === "true" ? 1 : ISO_SCALE;
  const h = i.height, n = base.length;
  const P = (b: Point, z: number) => isoPoint(b[0], b[1], z, k);

  // a side face is visible when its outward normal points toward the viewer (towards -x and -y)
  const faceVisible = base.map((_, e) => { const nn = edgeNormal(base, e); return -nn[0] - nn[1] > 1e-9; });
  const bottomVisible = (e: number) => faceVisible[e];
  const vertVisible = (v: number) => faceVisible[(v + n - 1) % n] || faceVisible[v];

  const W = Math.max(...base.map((p) => p[0])), D = Math.max(...base.map((p) => p[1]));
  const axisLen = Math.max(W, D, h) + 10;
  const topRing: Primitive = { t: "poly", pts: base.map((b) => P(b, h)), closed: true };
  const baseOutline = (): Primitive[] => base.flatMap((b, e) => (bottomVisible(e) ? [line(P(b, 0), P(base[(e + 1) % n], 0))] : []));
  const verticals = (): Primitive[] => base.map((b, v) => line(P(b, 0), P(b, h), vertVisible(v) ? "outline" : "construction"));

  const steps: Step[] = [
    {
      title: "Isometric axes",
      explanation: `From a point O draw the vertical axis and two axes at 30° to the horizontal, one to the right and one to the left. All three axes are 120° apart. This drawing uses ${scaleName(k)}.`,
      style: "construction",
      primitives: [line([0, 0], [0, axisLen * k]), line([0, 0], isoPoint(axisLen, 0, 0, k)), line([0, 0], isoPoint(0, axisLen, 0, k)), text([1, axisLen * k], "vertical"), text(isoPoint(axisLen, 0, 0, k), "30°"), text(isoPoint(0, axisLen + 4, 0, k), "30°")],
    },
  ];
  if (i.base !== "rectangle") {
    steps.push({
      title: "Enclose the base in a box",
      explanation: `The base is not made of lines along the axes, so enclose it in a rectangle ${round(W)} × ${round(D)} mm and draw that rectangle on the isometric axes. Only lines parallel to an axis can be measured directly.`,
      style: "construction",
      primitives: [{ t: "poly", pts: [P([0, 0], 0), P([W, 0], 0), P([W, D], 0), P([0, D], 0)], closed: true }],
    });
  }
  steps.push({
    title: "Draw the base",
    explanation:
      i.base === "rectangle"
        ? `Mark ${i.side} mm along one axis and ${i.width} mm along the other (${round(i.side * k)} and ${round((i.width ?? 0) * k)} mm on the paper). Complete the parallelogram: this is the isometric view of the base.`
        : `Locate each corner of the base by its distances from the box sides, measured along the axes, and join the corners in order.`,
    style: "construction",
    primitives: [{ t: "poly", pts: base.map((b) => P(b, 0)), closed: true }, ...base.map((b, v) => text(P(b, 0), String.fromCharCode(97 + v)))],
  });
  steps.push({
    title: "Raise the edges",
    explanation: `From every corner draw a vertical line ${h} mm high (${round(h * k)} mm on the paper). The edges you can see are drawn firm; the ones hidden behind the solid stay as thin lines, because an isometric view does not show hidden edges.`,
    style: "outline",
    primitives: verticals(),
  });
  steps.push({
    title: "Draw the top face",
    explanation: "Join the tops of the vertical lines with lines parallel to the base edges. The top face is completely visible.",
    style: "outline",
    primitives: [topRing],
  });
  steps.push({
    title: "Final outline",
    explanation: "Darken the visible bottom edges to finish the outline. On a finished sheet the thin construction and hidden lines are rubbed out, leaving only the firm outline.",
    style: "outline",
    primitives: [text([-6, -6], "O"), ...baseOutline()],
  });

  const profile: Point[] = base;
  return {
    ok: true,
    solution: {
      title: `Isometric view of a ${i.base === "rectangle" ? "rectangular" : i.base} prism`,
      problem: `Draw the isometric ${i.scale === "true" ? "view" : "projection"} of a ${i.base === "rectangle" ? `rectangular prism ${i.side} × ${i.width} × ${h} mm` : `${i.base} prism, base side ${i.side} mm, height ${h} mm`}, standing on its base.`,
      givens: [
        { name: i.base === "rectangle" ? "Length" : "Base side", value: `${i.side} mm` },
        ...(i.base === "rectangle" ? [{ name: "Width", value: `${i.width} mm` }] : []),
        { name: "Height", value: `${h} mm` },
        { name: "Scale", value: i.scale === "true" ? "True (1:1)" : "Isometric (0.816)" },
      ],
      steps,
      solid: { kind: "extrude", profile, height: h },
    },
  };
}

export type IsoCylinderInput = { diameter: number; height: number; scale: "isometric" | "true" };

export function solveIsometricCylinder(i: IsoCylinderInput): { ok: true; solution: Solution } {
  const k = i.scale === "true" ? 1 : ISO_SCALE;
  const r = i.diameter / 2, h = i.height;
  const rx = r * Math.sqrt(1.5) * k, ry = r * Math.sqrt(0.5) * k;
  const side = i.diameter * k; // side of the isometric square that encloses the circle
  const rhombus = (cy: number): Extract<Primitive, { t: "poly" }> => ({ t: "poly", closed: true, pts: [[0, cy - side * S30], [side * C30, cy], [0, cy + side * S30], [-side * C30, cy]] });
  const hk = h * k;
  const steps: Step[] = [
    {
      title: "Axis of the cylinder",
      explanation: `Draw the vertical axis ${h} mm long (${round(hk)} mm on the paper) and mark its two ends, the centres of the base and the top. Everything else is drawn about this line.`,
      style: "construction",
      primitives: [line([0, 0], [0, hk]), { t: "line", a: [0, 0], b: [0, hk], style: "centre" }],
    },
    {
      title: "Isometric square round the base",
      explanation: `A circle in an isometric plane becomes an ellipse. Enclose it in an isometric square of side ${i.diameter} mm (${round(side)} mm on the paper), centred on the base centre: a rhombus.`,
      style: "construction",
      primitives: [rhombus(0)],
    },
    {
      title: "Ellipse of the base",
      explanation: `Draw an ellipse inside the rhombus, touching the midpoint of each side (four-centre method). Its major axis is ${round(2 * rx)} mm and minor axis ${round(2 * ry)} mm. Only the front half of the base ellipse is visible.`,
      style: "outline",
      primitives: [{ t: "ellipse", c: [0, 0], rx, ry, from: 180, to: 360 }],
    },
    {
      title: "Ellipse of the top",
      explanation: "Repeat the same rhombus and ellipse at the top end of the axis. The whole top ellipse is visible.",
      style: "outline",
      primitives: [{ ...rhombus(hk), style: "construction" }, { t: "ellipse", c: [0, hk], rx, ry }],
    },
    {
      title: "Join with tangents",
      explanation: "Draw two vertical lines touching both ellipses at their widest points. The cylinder is complete.",
      style: "outline",
      primitives: [line([-rx, 0], [-rx, hk]), line([rx, 0], [rx, hk])],
    },
  ];
  return {
    solution: {
      title: "Isometric view of a cylinder",
      problem: `Draw the isometric ${i.scale === "true" ? "view" : "projection"} of a cylinder of diameter ${i.diameter} mm and height ${h} mm, axis vertical.`,
      givens: [
        { name: "Diameter", value: `${i.diameter} mm` },
        { name: "Height", value: `${h} mm` },
        { name: "Scale", value: i.scale === "true" ? "True (1:1)" : "Isometric (0.816)" },
      ],
      steps,
      solid: { kind: "revolve", profile: [[0, 0], [r, 0], [r, h], [0, h]] },
    },
    ok: true,
  };
}

export type IsoConeInput = { diameter: number; height: number; scale: "isometric" | "true" };

export function solveIsometricCone(i: IsoConeInput): { ok: true; solution: Solution } | { ok: false; reason: string } {
  const k = i.scale === "true" ? 1 : ISO_SCALE;
  const r = i.diameter / 2, h = i.height;
  const rx = r * Math.sqrt(1.5) * k, ry = r * Math.sqrt(0.5) * k;
  const H = h * k;
  if (H <= ry + 1e-6) return { ok: false, reason: "This cone is too flat: its apex would fall inside the base ellipse in the isometric view." };
  const side = i.diameter * k;
  const rhombus: Extract<Primitive, { t: "poly" }> = { t: "poly", closed: true, pts: [[0, -side * S30], [side * C30, 0], [0, side * S30], [-side * C30, 0]] };
  // tangents from the apex (0, H) touch the base ellipse at parametric angle t0 (and 180 - t0)
  const t0 = (Math.asin(ry / H) * 180) / Math.PI;
  const tp = (t: number): Point => ellipsePoint([0, 0], rx, ry, 0, t);
  const apex: Point = [0, H];
  const steps: Step[] = [
    {
      title: "Axis of the cone",
      explanation: `Draw the vertical axis ${h} mm long (${round(H)} mm on the paper). The bottom end is the centre of the base and the top end is the apex. This drawing uses ${scaleName(k)}.`,
      style: "construction",
      primitives: [line([0, 0], apex, "centre"), text([2, H], "apex")],
    },
    {
      title: "Isometric square round the base",
      explanation: `A circle in an isometric plane becomes an ellipse. Enclose the base in an isometric square of side ${i.diameter} mm (${round(side)} mm on the paper): a rhombus centred on the base centre.`,
      style: "construction",
      primitives: [rhombus],
    },
    {
      title: "Ellipse of the base",
      explanation: `Draw the ellipse touching the midpoint of each side of the rhombus (four-centre method). Major axis ${round(2 * rx)} mm, minor axis ${round(2 * ry)} mm. Only the front half is firm for now.`,
      style: "outline",
      primitives: [{ t: "ellipse", c: [0, 0], rx, ry, from: 180, to: 360 }],
    },
    {
      title: "Tangents from the apex",
      explanation: "From the apex draw two lines tangent to the base ellipse. They touch it a little behind its widest points, so extend the firm arc to the points of contact. The cone is complete.",
      style: "outline",
      primitives: [line(apex, tp(t0)), line(apex, tp(180 - t0)), { t: "ellipse", c: [0, 0], rx, ry, from: 180 - t0, to: 180 }, { t: "ellipse", c: [0, 0], rx, ry, from: 360, to: 360 + t0 }],
    },
  ];
  return {
    ok: true,
    solution: {
      title: "Isometric view of a cone",
      problem: `Draw the isometric ${i.scale === "true" ? "view" : "projection"} of a cone of base diameter ${i.diameter} mm and height ${h} mm, standing on its base.`,
      givens: [
        { name: "Base diameter", value: `${i.diameter} mm` },
        { name: "Height", value: `${h} mm` },
        { name: "Scale", value: i.scale === "true" ? "True (1:1)" : "Isometric (0.816)" },
      ],
      steps,
      solid: { kind: "revolve", profile: [[0, 0], [r, 0], [0, h]] },
    },
  };
}

export type IsoSphereInput = { diameter: number; scale: "isometric" | "true"; hemisphere?: boolean };

/** A sphere (or a hemisphere with its flat face down) in isometric. */
export function solveIsometricSphere(i: IsoSphereInput): { ok: true; solution: Solution } {
  const k = i.scale === "true" ? 1 : ISO_SCALE;
  const r = i.diameter / 2;
  const hemi = !!i.hemisphere;
  const rs = (r * k) / ISO_SCALE; // radius of the circle that the sphere projects to
  const rx = r * Math.sqrt(1.5) * k, ry = r * Math.sqrt(0.5) * k; // the equator / flat face
  const cy = hemi ? 0 : rs; // centre height on the paper: a sphere rests on the ground, so it is rs above it... drawn about the centre
  const side = i.diameter * k;
  const rhombus = (y: number): Extract<Primitive, { t: "poly" }> => ({ t: "poly", closed: true, pts: [[0, y - side * S30], [side * C30, y], [0, y + side * S30], [-side * C30, y]] });
  const name = hemi ? "hemisphere" : "sphere";
  const steps: Step[] = [
    {
      title: hemi ? "Centre of the flat face" : "Centre of the sphere",
      explanation: `Mark the centre O${hemi ? " of the flat face, which lies on the ground" : ""} and draw a short vertical axis through it. This drawing uses ${scaleName(k)}.`,
      style: "construction",
      primitives: [line([0, cy - (hemi ? 0 : rs) - 4], [0, cy + rs + 4], "centre"), text([2, cy + 2], "O")],
    },
    {
      title: hemi ? "Isometric square round the flat face" : "Isometric square round the equator",
      explanation: `The ${hemi ? "flat face" : "equator"} is a circle of diameter ${i.diameter} mm lying in a horizontal plane, so it appears as an ellipse. Enclose it in an isometric square of side ${i.diameter} mm (${round(side)} mm on the paper).`,
      style: "construction",
      primitives: [rhombus(cy)],
    },
    {
      title: hemi ? "Ellipse of the flat face" : "Ellipse of the equator",
      explanation: `Draw the ellipse inside the rhombus. Its major axis is ${round(2 * rx)} mm and its minor axis ${round(2 * ry)} mm.${hemi ? " Only the front half is visible." : " It is only a guide, so keep it thin."}`,
      style: hemi ? "outline" : "construction",
      primitives: [hemi ? { t: "ellipse", c: [0, cy], rx, ry, from: 180, to: 360 } : { t: "ellipse", c: [0, cy], rx, ry }],
    },
    {
      title: hemi ? "Draw the dome" : "Draw the outline circle",
      explanation: hemi
        ? `With centre O and radius equal to half the major axis, ${round(rs)} mm, draw the upper half of a circle. It joins the ends of the ellipse. The hemisphere is complete.`
        : `The sphere always looks like a circle. With centre O and radius equal to half the major axis, ${round(rs)} mm, draw it. ${i.scale === "isometric" ? "With the isometric scale this equals the true radius." : "With true lengths it is 1.225 times the true radius."}`,
      style: "outline",
      primitives: [hemi ? { t: "arc", c: [0, cy], r: rs, from: 0, to: 180 } : { t: "circle", c: [0, cy], r: rs }],
    },
  ];
  const prof: Point[] = hemi
    ? [[0, 0], [r, 0], ...Array.from({ length: 23 }, (_, m) => { const a = ((m + 1) * Math.PI) / 2 / 24; return [r * Math.cos(a), r * Math.sin(a)] as Point; }), [0, r]]
    : [[0, 0], ...Array.from({ length: 23 }, (_, m) => { const a = (-Math.PI / 2) + ((m + 1) * Math.PI) / 24; return [r * Math.cos(a), r + r * Math.sin(a)] as Point; }), [0, 2 * r]];
  return {
    ok: true,
    solution: {
      title: `Isometric view of a ${name}`,
      problem: `Draw the isometric ${i.scale === "true" ? "view" : "projection"} of a ${name} of diameter ${i.diameter} mm${hemi ? ", flat face on the ground" : ""}.`,
      givens: [{ name: "Diameter", value: `${i.diameter} mm` }, { name: "Scale", value: i.scale === "true" ? "True (1:1)" : "Isometric (0.816)" }],
      steps,
      solid: { kind: "revolve", profile: prof },
    },
  };
}

export { ellipsePoint };
