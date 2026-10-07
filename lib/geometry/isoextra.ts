import type { Point, Primitive, Solution, Step } from "../schema";
import { round } from "./basic";
import { ISO_SCALE, isoPoint } from "./isometric";
import { buildPartAt, clipPolylines, footprint, insideSpan, outsideSpan, partOk, rejoin, rhombusAt, segments, type Built, type Part } from "./composite";
import { SIDES, type RegularBase } from "./solids";

type Result = { ok: true; solution: Solution } | { ok: false; reason: string };
type Scale = "isometric" | "true";
type Seg = [Point, Point];
type V3 = [number, number, number];

const fail = (reason: string): Result => ({ ok: false, reason });
const kOf = (s: Scale) => (s === "true" ? 1 : ISO_SCALE);
const scaleNote = (k: number) => (k === 1 ? "true lengths (isometric drawing)" : "the isometric scale, 0.816 × true length (isometric projection)");
const scaleGiven = (s: Scale) => ({ name: "Scale", value: s === "true" ? "True (1:1)" : "Isometric (0.816)" });
const line = (a: Point, b: Point, style?: "construction" | "outline" | "centre"): Primitive => ({ t: "line", a, b, ...(style ? { style } : {}) });
const poly = (pts: Point[], closed = false): Primitive => ({ t: "poly", pts, ...(closed ? { closed } : {}) });
const text = (at: Point, s: string): Primitive => ({ t: "text", at, text: s });
const mm = (v: number, k: number) => `${v} mm (${round(v * k)} mm on the paper)`;
const lineLen = (segs: Seg[]) => segs.reduce((s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);

// ---------------------------------------------------------------- (1) solids side by side

export type RowInput = { parts: Part[]; gap: number; along: "x" | "y"; scale: Scale };

const short = (p: Part) => (p.kind === "prism" ? (p.base === "rectangle" ? "rectangular prism" : `${p.base} prism`) : p.kind);
const HOW: Record<Part["kind"], string> = {
  prism: "Raise the vertical edges you can see and draw the top face.",
  cylinder: "Draw the front half of the base ellipse, the whole top ellipse and the two vertical tangents.",
  cone: "Draw the front half of the base ellipse and the two tangents from the apex.",
  sphere: "Draw a circle whose radius is half the major axis of the equator ellipse.",
  hemisphere: "Draw the front half of the flat-face ellipse and the dome as half a circle.",
};

/** What is left of segment a-b once the stretches already covered by the collinear segments in `drawn` are removed. */
function undrawn(a: Point, b: Point, drawn: Seg[]): Seg[] {
  let rest: Seg[] = [[a, b]];
  for (const [c, d] of drawn) {
    rest = rest.flatMap(([p, q]): Seg[] => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (len < 1e-9) return [];
      const u = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
      const off = (r: Point) => (r[0] - p[0]) * u[1] - (r[1] - p[1]) * u[0];
      if (Math.abs(off(c)) > 1e-6 || Math.abs(off(d)) > 1e-6) return [[p, q]];
      const along = (r: Point) => ((r[0] - p[0]) * u[0] + (r[1] - p[1]) * u[1]) / len;
      const [s0, s1] = [along(c), along(d)].sort((m, n) => m - n);
      const lo = Math.max(0, s0), hi = Math.min(1, s1);
      return lo < hi - 1e-9 ? outsideSpan(p, q, [lo, hi]) : [[p, q]];
    });
  }
  return rest;
}

/** The visible pieces of some lines: those not behind a nearer solid's silhouette, and not drawn already. */
function newLines(lines: Point[][], nearer: Point[][], drawn: Seg[]): Point[][] {
  const segs = segments(clipPolylines(lines, nearer));
  const out = rejoin(segs.flatMap(([a, b]) => undrawn(a, b, drawn)));
  drawn.push(...segs);
  return out;
}

/**
 * 2 or 3 solids standing on the ground side by side along one isometric axis. The solid with the smaller x + y is nearer the viewer and
 * hides parts of the farther ones: the solids are separated by a plane across the row, so a nearer one is always wholly in front.
 */
export function solveIsometricRow(i: RowInput): Result {
  const { parts, along, gap } = i;
  if (parts.length < 2 || parts.length > 3) return fail("A row needs 2 or 3 solids side by side.");
  if (!parts.every(partOk) || !(gap >= 0) || !Number.isFinite(gap)) return fail("Every size must be a positive number and the gap cannot be negative.");
  const k = kOf(i.scale);
  const feet = parts.map(footprint);
  const bad = feet.find((f) => typeof f === "string");
  if (typeof bad === "string") return fail(bad);
  const box = feet as [number, number, number, number][];
  const [a0, c0] = along === "x" ? [0, 2] : [2, 0]; // index of the footprint's lower end along the row, and across it
  const ext = box.map((f) => f[a0 + 1] - f[a0]);
  const wide = Math.max(...box.map((f) => f[c0 + 1] - f[c0]));
  const starts = ext.map((_, j) => ext.slice(0, j).reduce((s, e) => s + e, 0) + gap * j);
  const span = starts[starts.length - 1] + ext[ext.length - 1];

  const built: Built[] = [];
  for (const [j, p] of parts.entries()) {
    const a = starts[j] - box[j][a0], c = wide / 2 - (box[j][c0] + box[j][c0 + 1]) / 2;
    const b = buildPartAt(p, along === "x" ? [a, c] : [c, a], 0, k);
    if (typeof b === "string") return fail(b);
    built.push(b);
  }
  const hulls = built.map((b) => b.silhouette);
  const top = Math.max(...built.map((b) => b.top));
  const onAxis = (len: number) => (along === "x" ? isoPoint(len, 0, 0, k) : isoPoint(0, len, 0, k));
  const across = (len: number) => (along === "x" ? isoPoint(0, len, 0, k) : isoPoint(len, 0, 0, k));
  // the axes are guides in front of the row: the parts that would cross a solid are left out
  const axes = segments([[[0, 0], onAxis(span + 10)], [[0, 0], across(wide + 10)], [[0, 0], [0, (top + 10) * k]]].flatMap((l) => clipPolylines([l as Point[]], hulls)));

  const steps: Step[] = [
    {
      title: "Isometric axes and the row direction",
      explanation: `The ${parts.length} solids stand on the same ground plane in a row along the ${along} axis, the one that runs ${along === "x" ? "up and to the right" : "up and to the left"}. From O draw the vertical axis and the two 30° axes (only the parts that no solid will cross are kept). Along the row the solids take ${ext.map((e) => round(e)).join(" + ")}${gap > 0 ? ` + ${parts.length - 1} gap${parts.length > 2 ? "s" : ""} of ${gap}` : ""} = ${round(span)} mm (${round(span * k)} mm on the paper). This drawing uses ${scaleNote(k)}.`,
      style: "construction",
      primitives: [...axes.map(([a, b]) => line(a, b)), text(onAxis(span + 10), `${along} axis`), text([-6, -6], "O")],
    },
  ];
  const seen: Seg[] = [];
  steps.push({
    title: "Bases on the ground",
    explanation: `Draw the base of each solid on the ground, in order along the row: ${built.map((b) => b.name).join(", then ")}. ${gap > 0 ? `Leave ${gap} mm (${round(gap * k)} mm on the paper) between neighbours.` : "The solids touch, so neighbouring bases share a side."} A prism base is a parallelogram on the axes (only the sides you will see are drawn); a round base sits in an isometric square (a rhombus). ${parts.some((p) => p.kind === "prism" && p.base === "rectangle") ? "The length of a rectangular prism runs along the x axis and its width along the y axis. " : ""}Every middle is on the same line across the row. The nearest solid is drawn first, and a base line that a nearer solid hides is not drawn.`,
    style: "construction",
    primitives: built.flatMap((b, j) => newLines(b.construction.map((c) => [...c.pts, c.pts[0]]), hulls.slice(0, parts[j].kind === "prism" ? j + 1 : j), seen).map((pts) => poly(pts))),
  });
  const drawn: Seg[] = [];
  built.forEach((b, j) => {
    steps.push({
      title: `${j === 0 ? "Nearest solid" : j === 1 ? "Next solid" : "Farthest solid"}: the ${short(parts[j])}`,
      explanation: `${HOW[parts[j].kind]} Its height is ${round(b.top)} mm (${round(b.top * k)} mm on the paper). ${j === 0 ? "Nothing is in front of it, so all its visible edges are drawn." : `Leave out every line that ${j === 1 ? "the nearer solid hides" : "the nearer solids hide"}. ${gap > 0 ? `The ${gap} mm gap lets part of it show beside the nearer solid.` : "Where the solids touch, the faces pressed together are not drawn, so no line is left between them except the edges you can see."}`}${j === parts.length - 1 ? " This completes the row." : ""}`,
      style: "outline",
      primitives: newLines(b.edges, hulls.slice(0, j), drawn).map((pts) => poly(pts)),
    });
  });

  const names = parts.map((p) => `a ${short(p)}`);
  return {
    ok: true,
    solution: {
      title: `Isometric view of ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} side by side`,
      problem: `Draw the isometric ${i.scale === "true" ? "view" : "projection"} of ${parts.length} solids standing on the ground side by side along the ${along} axis${gap > 0 ? `, ${gap} mm apart` : ", touching one another"}: ${built.map((b) => `a ${b.name}`).join(", then ")}, starting with the one nearest the viewer. Their middles are in line across the row.`,
      givens: [...built.map((b, j) => ({ name: `Solid ${j + 1}`, value: b.name })), { name: "Gap", value: `${gap} mm` }, { name: "Row direction", value: `along the ${along} axis` }, scaleGiven(i.scale)],
      steps,
    },
  };
}

// ---------------------------------------------------------------- (2) a vertical hole through the top face

export type HoledInput = {
  solid: "prism" | "cylinder";
  base?: "rectangle" | RegularBase;
  side?: number;
  width?: number;
  diameter?: number;
  height: number;
  holeDiameter: number;
  holeDepth?: number;
  scale: Scale;
};

export function solveIsometricHoled(i: HoledInput): Result {
  const k = kOf(i.scale);
  const { height: h, holeDiameter: hd } = i;
  const part: Part | null = i.solid === "cylinder" ? (i.diameter ? { kind: "cylinder", diameter: i.diameter, height: h } : null) : i.base && i.side ? { kind: "prism", base: i.base, side: i.side, width: i.width, height: h } : null;
  if (!part) return fail(i.solid === "cylinder" ? "A cylinder needs a diameter." : "A prism needs a base shape and a base side.");
  if (!partOk(part) || !(hd > 0) || !Number.isFinite(hd) || (i.holeDepth !== undefined && !(i.holeDepth > 0))) return fail("Every size must be a positive number.");
  const foot = footprint(part);
  if (typeof foot === "string") return fail(foot);
  // the widest circle about the centre that stays inside the top face
  const room = part.kind === "cylinder" ? part.diameter : part.base === "rectangle" ? Math.min(part.side, part.width ?? 0) : part.side / Math.tan(Math.PI / SIDES[part.base]);
  if (hd >= room - 1e-9) return fail(`A hole of diameter ${hd} mm does not fit in the top face: the biggest circle that fits about its centre is ${round(room)} mm across, and the hole must be smaller so that a wall is left all round.`);
  const depth = i.holeDepth ?? h;
  if (depth > h + 1e-9) return fail(`The hole is ${depth} mm deep but the solid is only ${h} mm high.`);
  const through = depth >= h - 1e-9;

  // the solid stands with the front corner of its bounding box at O; (cx, cy) is the centre of its base
  const bx = foot[1] - foot[0], by = foot[3] - foot[2], cx = -foot[0], cy = -foot[2];
  const centre = isoPoint(cx, cy, 0, k);
  const H = h * k, dk = depth * k;
  const top: Point = [centre[0], centre[1] + H];
  const rh = hd / 2, rx = rh * Math.sqrt(1.5) * k, ry = rh * Math.sqrt(0.5) * k;
  const s = dk / (2 * ry); // sine of the parametric angle where the lowered ellipse meets the top one
  const seen = s < 1 - 1e-9; // the floor shows only if the line of sight over the near rim reaches it
  const from = (Math.asin(Math.min(s, 1)) * 180) / Math.PI;
  const D = part.kind === "cylinder" ? part.diameter : 0;
  const rxo = (D / 2) * Math.sqrt(1.5) * k, ryo = (D / 2) * Math.sqrt(0.5) * k;
  const shown = (p: Point): Point => [p[0] + centre[0], p[1] + centre[1]]; // a point of a drawing about the axis, on the paper
  const b = part.kind === "prism" ? buildPartAt(part, [cx, cy], 0, k) : null;
  if (typeof b === "string") return fail(b);
  const name = part.kind === "cylinder" ? `cylinder (Ø${D} mm, height ${h} mm)` : b!.name;

  const steps: Step[] = [];
  if (part.kind === "prism") {
    steps.push({
      title: "Isometric axes",
      explanation: `From a point O draw the vertical axis and the two axes at 30° to the horizontal. They run along three edges of the box that encloses the solid: ${round(bx)} mm along the axis that runs up and to the right, ${round(by)} mm along the one that runs up and to the left, and ${mm(h, k)} upwards. This drawing uses ${scaleNote(k)}.`,
      style: "construction",
      primitives: [line([0, 0], isoPoint(bx, 0, 0, k)), line([0, 0], isoPoint(0, by, 0, k)), line([0, 0], [0, H])],
    });
    const rect = part.base === "rectangle";
    steps.push({
      title: rect ? "Base of the prism" : "Enclose the base in a box",
      explanation: rect ? `Mark ${part.side} mm along one axis and ${part.width} mm along the other and complete the parallelogram: the isometric view of the base.` : `The base has sloping sides, so enclose it in a rectangle ${round(bx)} × ${round(by)} mm drawn on the axes, then join the corners of the base, located by their distances from the box sides.`,
      style: "construction",
      primitives: [...(rect ? [] : [poly([[0, 0], isoPoint(bx, 0, 0, k), isoPoint(bx, by, 0, k), isoPoint(0, by, 0, k)], true)]), ...b!.construction],
    });
    steps.push({
      title: "Raise the edges and draw the top face",
      explanation: `From the corners draw vertical lines ${mm(h, k)} high, the ones you can see, and join their tops to make the top face. The hole is cut into this face next.`,
      style: "outline",
      primitives: b!.edges.map((e) => poly(e)),
    });
  } else {
    steps.push({
      title: "Axis of the cylinder",
      explanation: `Draw the vertical axis ${mm(h, k)} high. Everything is drawn about this line. This drawing uses ${scaleNote(k)}.`,
      style: "construction",
      primitives: [line(centre, top, "centre")],
    });
    steps.push({
      title: "Isometric squares round the base and the top",
      explanation: `A circle in an isometric plane becomes an ellipse. Enclose the base and the top in isometric squares (rhombuses) of side ${D} mm (${round(D * k)} mm on the paper), centred on the axis.`,
      style: "construction",
      primitives: [rhombusAt(D, k, 0), rhombusAt(D, k, H)].map((r) => ({ ...r, pts: r.pts.map(shown) })),
    });
    steps.push({
      title: "Outline of the cylinder",
      explanation: `Draw the front half of the base ellipse and the whole top ellipse (major axis ${round(2 * rxo)} mm, minor axis ${round(2 * ryo)} mm), and join them with two vertical tangents.`,
      style: "outline",
      primitives: [{ t: "ellipse", c: centre, rx: rxo, ry: ryo, from: 180, to: 360 }, { t: "ellipse", c: top, rx: rxo, ry: ryo }, line([centre[0] - rxo, centre[1]], [top[0] - rxo, top[1]]), line([centre[0] + rxo, centre[1]], [top[0] + rxo, top[1]])],
    });
  }
  steps.push({
    title: "Centre of the hole and its isometric square",
    explanation: `The hole is in the middle of the top face, ${round(cx)} mm along the up-right axis and ${round(cy)} mm along the up-left axis from the front corner of ${part.kind === "cylinder" ? "the isometric square round the cylinder" : "its box"}${part.kind === "prism" && part.base === "rectangle" ? " (where the diagonals cross)" : ""}. Mark it with two short centre lines parallel to the axes. About it draw an isometric square of side ${hd} mm (${round(hd * k)} mm on the paper): the hole is a circle in the top face, so it appears as an ellipse inside this rhombus.`,
    style: "construction",
    primitives: [{ ...rhombusAt(hd, k, 0), pts: rhombusAt(hd, k, 0).pts.map((p): Point => [p[0] + top[0], p[1] + top[1]]) }, line(isoPoint(cx - rh - 3, cy, h, k), isoPoint(cx + rh + 3, cy, h, k), "centre"), line(isoPoint(cx, cy - rh - 3, h, k), isoPoint(cx, cy + rh + 3, h, k), "centre")],
  });
  steps.push({
    title: "Ellipse of the hole",
    explanation: `Draw the ellipse inside the rhombus, touching the middle of each side. Its major axis is ${round(2 * rx)} mm and its minor axis ${round(2 * ry)} mm. This whole ellipse is the edge of the hole in the top face.${seen ? "" : ` The hole is ${round(depth)} mm deep, more than ${round((2 * ry) / k)} mm, so from this side the near rim hides its ${through ? "open bottom" : "floor"}. Nothing more is drawn inside.`}`,
    style: "outline",
    primitives: [{ t: "ellipse", c: top, rx, ry }],
  });
  if (seen) {
    steps.push({
      title: through ? "Bottom edge of the hole" : "Floor of the hole",
      explanation: `${through ? "The hole comes out at the bottom face, where its edge is the same ellipse." : `The floor of the hole is ${round(depth)} mm lower.`} Move the ellipse ${round(depth)} mm (${round(dk)} mm on the paper) down. You look down into the hole from the front, so only the back part of it can be seen, through the opening. Draw just the arc that lies inside the top ellipse; the rest is hidden by the near wall.`,
      style: "outline",
      primitives: [{ t: "ellipse", c: [top[0], top[1] - dk], rx, ry, from, to: 180 - from }],
    });
  }

  const profile: Point[] = through ? [[rh, 0], [D / 2, 0], [D / 2, h], [rh, h], [rh, 0]] : [[0, 0], [D / 2, 0], [D / 2, h], [rh, h], [rh, h - depth], [0, h - depth]];
  return {
    ok: true,
    solution: {
      title: `Isometric view of a ${part.kind === "cylinder" ? "cylinder" : short(part)} with a hole`,
      problem: `Draw the isometric ${i.scale === "true" ? "view" : "projection"} of a ${name}, standing on its base, with a ${through ? "through" : `${round(depth)} mm deep`} hole of diameter ${hd} mm drilled vertically in the centre of its top face.`,
      givens: [
        ...(part.kind === "cylinder" ? [{ name: "Diameter", value: `${D} mm` }] : [{ name: part.base === "rectangle" ? "Length" : "Base side", value: `${part.side} mm` }, ...(part.base === "rectangle" ? [{ name: "Width", value: `${part.width} mm` }] : [])]),
        { name: "Height", value: `${h} mm` },
        { name: "Hole diameter", value: `${hd} mm` },
        { name: "Hole depth", value: through ? "through" : `${round(depth)} mm` },
        scaleGiven(i.scale),
      ],
      steps,
      ...(part.kind === "cylinder" ? { solid: { kind: "revolve" as const, profile } } : {}),
    },
  };
}

// ---------------------------------------------------------------- (3) a block with a corner notch: hidden lines by faces

/** A convex planar face and its outward unit normal. */
export type Face = { pts: V3[]; n: V3 };

const TOWARD_VIEWER: V3 = [-1, -1, 1]; // a point moves along this to come nearer the eye (larger x + y - z is farther)
const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * The parts of 3D segment a-b that no face in front of it covers. Only faces turned towards the viewer can hide anything, because for a closed
 * solid every ray meets a front-turned face first. A face hides the part of the edge that lies inside its outline (boundary included, so the seam between two coplanar halves of one face hides it too) on the paper and behind it.
 */
export function visibleParts(a: V3, b: V3, faces: Face[], k: number): Seg[] {
  const P = (v: V3) => isoPoint(v[0], v[1], v[2], k);
  const a2 = P(a), b2 = P(b);
  const hidden: [number, number][] = [];
  for (const f of faces) {
    const dn = dot(f.n, TOWARD_VIEWER);
    if (dn <= 1e-9) continue;
    const outline = f.pts.map(P);
    const area = outline.reduce((s, p, j) => s + p[0] * outline[(j + 1) % outline.length][1] - outline[(j + 1) % outline.length][0] * p[1], 0);
    const span = insideSpan(a2, b2, area > 0 ? outline : outline.reverse(), -1e-6);
    if (!span) continue;
    const c = dot(f.n, f.pts[0]);
    const gap = (v: V3) => (c - dot(f.n, v)) / dn - 1e-6; // how far in front of the point the face's plane lies
    const [g0, g1] = [gap(a), gap(b)];
    if (g0 <= 0 && g1 <= 0) continue;
    let [t0, t1] = span;
    if (g0 > 0 !== g1 > 0) { const t = g0 / (g0 - g1); if (g0 > 0) t1 = Math.min(t1, t); else t0 = Math.max(t0, t); }
    if (t0 < t1) hidden.push([t0, t1]);
  }
  const tiny = 1e-3 / Math.max(Math.hypot(b2[0] - a2[0], b2[1] - a2[1]), 1e-9); // a sliver under a thousandth of a mm is rounding, not a line
  const out: Seg[] = [];
  let at = 0;
  for (const [t0, t1] of hidden.sort((p, q) => p[0] - q[0])) {
    if (t0 - at > tiny) out.push([lerp(a2, b2, at), lerp(a2, b2, t0)]);
    at = Math.max(at, t1);
  }
  if (1 - at > tiny) out.push([lerp(a2, b2, at), b2]);
  return out;
}

type Rng = [number, number];
type Group = "top" | "depth" | "floor" | "rest";
export type NotchInput = { length: number; width: number; height: number; notchLength: number; notchWidth: number; notchDepth: number; at: "front" | "back" | "left" | "right"; scale: Scale };

/**
 * A box with a rectangular notch cut from one top corner, as its exterior faces (split into convex rectangles) and its 21 true edges.
 * x runs along the length, y along the width. "front" is the corner nearest the viewer (x = 0, y = 0), "right" is x = length, "left" is y = width.
 */
export function notchedBlock(i: NotchInput) {
  const { length: L, width: W, height: H } = i;
  const zn = H - i.notchDepth;
  const hiX = i.at === "right" || i.at === "back", hiY = i.at === "left" || i.at === "back";
  const [xo, xi, xe] = hiX ? [L, L - i.notchLength, 0] : [0, i.notchLength, L]; // outer end, inner end of the notch; the far end of the block
  const [yo, yi, ye] = hiY ? [W, W - i.notchWidth, 0] : [0, i.notchWidth, W];
  const sorted = (a: number, b: number): Rng => (a < b ? [a, b] : [b, a]);
  const [X, Y, Z, Nz, none]: Rng[] = [[0, L], [0, W], [0, H], [zn, H], [0, 0]];
  const [Nx, Ny, xr, yr] = [sorted(xo, xi), sorted(yo, yi), sorted(xi, xe), sorted(yi, ye)];
  const sg = (v: number): 1 | -1 => (v > 0 ? 1 : -1);
  /** The rectangle in the plane `axis = c` that spans the ranges R of the other two axes (those of `axis` itself are ignored). */
  const rect = (axis: 0 | 1 | 2, c: number, R: Rng[], dir: 1 | -1): Face => {
    const u = (axis + 1) % 3, v = (axis + 2) % 3;
    const at = (p: number, q: number): V3 => { const r: V3 = [0, 0, 0]; r[axis] = c; r[u] = p; r[v] = q; return r; };
    const n: V3 = [0, 0, 0];
    n[axis] = dir;
    return { pts: [at(R[u][0], R[v][0]), at(R[u][1], R[v][0]), at(R[u][1], R[v][1]), at(R[u][0], R[v][1])], n };
  };
  const faces: Face[] = [
    rect(2, H, [X, yr, none], 1), rect(2, H, [xr, Ny, none], 1), // the top, an L split in two
    rect(2, zn, [Nx, Ny, none], 1), // the floor of the notch
    rect(0, xi, [none, Ny, Nz], sg(xo - xi)), rect(1, yi, [Nx, none, Nz], sg(yo - yi)), // its two walls
    rect(0, xo, [none, Y, [0, zn]], sg(xo - xe)), rect(0, xo, [none, yr, Nz], sg(xo - xe)), rect(0, xe, [none, Y, Z], sg(xe - xo)),
    rect(1, yo, [X, none, [0, zn]], sg(yo - ye)), rect(1, yo, [xr, none, Nz], sg(yo - ye)), rect(1, ye, [X, none, Z], sg(ye - yo)),
  ];
  const ring = (pts: V3[]) => pts.map((p, j) => [p, pts[(j + 1) % pts.length]] as [V3, V3]);
  const at = (x: number, y: number, z: number): V3 => [x, y, z];
  const edges: { a: V3; b: V3; group: Group }[] = [
    ...ring([at(xi, yo, H), at(xe, yo, H), at(xe, ye, H), at(xo, ye, H), at(xo, yi, H), at(xi, yi, H)]).map(([a, b], j) => ({ a, b, group: (j >= 4 ? "top" : "rest") as Group })),
    ...ring([at(xo, yo, zn), at(xi, yo, zn), at(xi, yi, zn), at(xo, yi, zn)]).map(([a, b]) => ({ a, b, group: "floor" as Group })),
    ...[[xi, yo], [xo, yi], [xi, yi]].map(([x, y]) => ({ a: at(x, y, zn), b: at(x, y, H), group: "depth" as Group })),
    ...[[xe, yo, H], [xe, ye, H], [xo, ye, H], [xo, yo, zn]].map(([x, y, z]) => ({ a: at(x, y, 0), b: at(x, y, z), group: "rest" as Group })),
    ...ring([at(xo, yo, 0), at(xe, yo, 0), at(xe, ye, 0), at(xo, ye, 0)]).map(([a, b]) => ({ a, b, group: "rest" as Group })),
  ];
  return { faces, edges, notch: { x: Nx, y: Ny, z: Nz }, corner: { xo, xi, yo, yi } };
}

/** The stretch [t0, t1] of segment a-b inside the closed box with ranges r, or null. */
function insideBox(a: V3, b: V3, r: Rng[]): Rng | null {
  let t0 = 0, t1 = 1;
  for (let c = 0; c < 3; c++) {
    const d = b[c] - a[c];
    if (Math.abs(d) < 1e-9) { if (a[c] < r[c][0] - 1e-9 || a[c] > r[c][1] + 1e-9) return null; continue; }
    const u = (r[c][0] - a[c]) / d, v = (r[c][1] - a[c]) / d;
    t0 = Math.max(t0, Math.min(u, v));
    t1 = Math.min(t1, Math.max(u, v));
  }
  return t0 < t1 ? [t0, t1] : null;
}

const CORNER = { front: "front corner (the one nearest you)", back: "back corner (the one farthest from you)", left: "left-hand corner", right: "right-hand corner" };

export function solveIsometricNotched(i: NotchInput): Result {
  const { length: L, width: W, height: H, notchLength: nl, notchWidth: nw, notchDepth: nd } = i;
  if (![L, W, H, nl, nw, nd].every((v) => v > 0 && Number.isFinite(v))) return fail("Every size must be a positive number.");
  const toobig = [nl >= L && `its length ${nl} mm is not less than the block's ${L} mm`, nw >= W && `its width ${nw} mm is not less than the block's ${W} mm`, nd >= H && `its depth ${nd} mm is not less than the block's height ${H} mm`].filter(Boolean);
  if (toobig.length) return fail(`The notch does not fit as a corner notch: ${toobig.join("; ")}. It must be smaller than the block in length, width and depth, or it cuts away a whole side of the block.`);
  const k = kOf(i.scale);
  const P = (v: V3) => isoPoint(v[0], v[1], v[2], k);
  const block = notchedBlock(i);
  const { x: Nx, y: Ny, z: Nz } = block.notch;
  const group = (g: Group) => {
    const es = block.edges.filter((e) => e.group === g);
    const vis = es.flatMap((e) => visibleParts(e.a, e.b, block.faces, k));
    return { prims: vis.map(([a, b]) => line(a, b)), clipped: lineLen(vis) < lineLen(es.map((e): Seg => [P(e.a), P(e.b)])) - 1e-6 };
  };
  const [top, depth, floor, rest] = (["top", "depth", "floor", "rest"] as Group[]).map(group);

  // the axes are three edges of the block, and the box is the block in thin lines; both stop short of the corner that is cut away
  const O: V3 = [0, 0, 0];
  const cutAway = ([a, b]: [V3, V3]): Seg[] => { const cut = insideBox(a, b, [Nx, Ny, Nz]); return cut ? outsideSpan(P(a), P(b), cut) : [[P(a), P(b)]]; };
  const axes = ([[O, [L, 0, 0]], [O, [0, W, 0]], [O, [0, 0, H]]] as [V3, V3][]).flatMap(cutAway);
  const box: [V3, V3][] = [];
  for (const y of [0, W]) for (const z of [0, H]) box.push([[0, y, z], [L, y, z]]);
  for (const x of [0, L]) for (const z of [0, H]) box.push([[x, 0, z], [x, W, z]]);
  for (const x of [0, L]) for (const y of [0, W]) box.push([[x, y, 0], [x, y, H]]);
  const thin = box.filter(([a, b]) => ![a, b].some((p) => (p[0] === L && p[1] === W && p[2] === 0) || p.every((c) => c === 0))).flatMap(cutAway);

  const mmk = (v: number) => mm(v, k);
  const hid = "Lines that run behind the block are not drawn, because an isometric view shows no hidden lines.";
  const steps: Step[] = [
    {
      title: "Isometric axes",
      explanation: `From a point O draw the vertical axis and two axes at 30° to the horizontal. Measure the length ${mmk(L)} along the axis that runs up and to the right, the width ${mmk(W)} along the one that runs up and to the left, and the height ${mmk(H)} upwards. These are three edges of the block${i.at === "front" ? "; the upright one stops where the notch begins" : ""}. This drawing uses ${scaleNote(k)}.`,
      style: "construction",
      primitives: [...axes.map(([a, b]) => line(a, b)), text([-6, -6], "O")],
    },
    {
      title: "The block as a box",
      explanation: `Complete the box ${L} × ${W} × ${H} mm in thin lines: draw the parallelograms on the axes and raise the vertical edges. Stop short of the ${CORNER[i.at]}: that corner is going to be cut away, so its lines are left out.`,
      style: "construction",
      primitives: thin.map(([a, b]) => line(a, b)),
    },
    {
      title: "Mark the notch on the top face",
      explanation: `From the ${CORNER[i.at]} of the top face measure ${mmk(nl)} along the edge that runs up and to the right, and ${mmk(nw)} along the edge that runs up and to the left. Through the two marks draw lines parallel to the edges until they meet. These two lines are the top edges of the walls of the notch.`,
      style: "outline",
      primitives: top.prims,
    },
    ...(depth.prims.length ? [{
      title: "Cut the notch to its depth",
      explanation: `From the corner where those lines meet, and from each of the two marks, draw vertical lines ${mmk(nd)} long. They are the vertical edges of the notch.${depth.clipped ? " Where the block is in front of them they are cut short, because the part behind is hidden." : ""}`,
      style: "outline" as const,
      primitives: depth.prims,
    }] : []),
    ...(floor.prims.length ? [{
      title: "Floor of the notch",
      explanation: `${depth.prims.length ? "Join the lower ends of the vertical lines" : `The vertical edges of the notch are all hidden behind the block, so none is drawn, but they still fix the floor ${mmk(nd)} below the top. Draw the floor edges`} with lines parallel to the axes: the floor of the notch is a rectangle ${nl} × ${nw} mm.${floor.clipped ? ` Only the parts of the floor edges that you can see are drawn. ${hid}` : ""}`,
      style: "outline" as const,
      primitives: floor.prims,
    }] : []),
    {
      title: "Final outline",
      explanation: `Darken the remaining visible edges of the block: the bottom edges at the front, the vertical edges and the outline of the top face. Rub out the thin construction lines on a finished sheet. ${depth.clipped || floor.clipped || rest.clipped ? hid : ""}`.trim(),
      style: "outline",
      primitives: rest.prims,
    },
  ];
  return {
    ok: true,
    solution: {
      title: "Isometric view of a block with a corner notch",
      problem: `Draw the isometric ${i.scale === "true" ? "view" : "projection"} of a rectangular block ${L} × ${W} × ${H} mm (length along the axis that runs up and to the right, width along the one that runs up and to the left) with a rectangular notch ${nl} × ${nw} mm and ${nd} mm deep cut from the ${i.at} corner of its top face.`,
      givens: [{ name: "Length", value: `${L} mm` }, { name: "Width", value: `${W} mm` }, { name: "Height", value: `${H} mm` }, { name: "Notch length × width", value: `${nl} × ${nw} mm` }, { name: "Notch depth", value: `${nd} mm` }, { name: "Notch corner", value: i.at }, scaleGiven(i.scale)],
      steps,
    },
  };
}
