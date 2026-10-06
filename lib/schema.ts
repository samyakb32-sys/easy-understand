import { z } from "zod";

/** Point in drawing space: millimetres, x right, y UP (the renderer flips y for SVG). */
export const Point = z.tuple([z.number(), z.number()]);
export type Point = z.infer<typeof Point>;

export const LineStyle = z.enum(["construction", "outline", "hidden", "centre", "dimension"]);
export type LineStyle = z.infer<typeof LineStyle>;

const base = { style: LineStyle.optional() };

export const Primitive = z.discriminatedUnion("t", [
  z.object({ t: z.literal("line"), a: Point, b: Point, ...base }),
  z.object({ t: z.literal("circle"), c: Point, r: z.number().positive(), ...base }),
  /** Arc from angle `from` to `to` in degrees, counter-clockwise, y up. */
  z.object({ t: z.literal("arc"), c: Point, r: z.number().positive(), from: z.number(), to: z.number(), ...base }),
  z.object({ t: z.literal("text"), at: Point, text: z.string(), size: z.number().positive().optional() }),
]);
export type Primitive = z.infer<typeof Primitive>;

export const Step = z.object({
  title: z.string(),
  /** What the professor says and shows in the caption. */
  explanation: z.string(),
  /** Default style for primitives in this step. */
  style: LineStyle.default("outline"),
  primitives: z.array(Primitive),
});
export type Step = z.infer<typeof Step>;

export const SolidSpec = z.discriminatedUnion("kind", [
  /** Polygon profile (x,z in mm) extruded up by `height`. */
  z.object({ kind: z.literal("extrude"), profile: z.array(Point).min(3), height: z.number().positive() }),
  /** Profile of (radius, height) pairs revolved around the vertical axis. */
  z.object({ kind: z.literal("revolve"), profile: z.array(Point).min(2) }),
]);
export type SolidSpec = z.infer<typeof SolidSpec>;

export const Solution = z.object({
  title: z.string(),
  problem: z.string(),
  givens: z.array(z.object({ name: z.string(), value: z.string() })).default([]),
  steps: z.array(Step).min(1),
  solid: SolidSpec.optional(),
});
export type Solution = z.infer<typeof Solution>;
