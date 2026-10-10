import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DrawingCanvas, tip } from "@/components/DrawingCanvas";
import { frameDt, MAX_FRAME_DT } from "@/components/StepPlayer";
import type { Primitive } from "@/lib/schema";
import { buildTimeline } from "@/lib/timeline";
import { SAMPLES, getSample } from "@/lib/samples";

describe("getSample", () => {
  it("returns own samples and null for inherited Object.prototype names", () => {
    expect(getSample("line-projection")).toBe(SAMPLES["line-projection"]);
    for (const s of ["constructor", "toString", "hasOwnProperty", "__proto__", "valueOf", "custom", "nope"]) expect(getSample(s)).toBeNull();
  });
});

describe("frameDt", () => {
  it("is 0 on the first frame, real time on normal frames, and capped after a hidden tab", () => {
    expect(frameDt(null, 5000)).toBe(0);
    expect(frameDt(1000, 1016)).toBeCloseTo(0.016);
    expect(frameDt(1000, 31000)).toBe(MAX_FRAME_DT);
    expect(frameDt(2000, 1000)).toBe(0);
  });
});

describe("pen dot on circles", () => {
  const circle: Primitive = { t: "circle", c: [0, 0], r: 10 };
  const near = (a: number[] | null, x: number, y: number) => {
    expect(a![0]).toBeCloseTo(x);
    expect(a![1]).toBeCloseTo(y);
  };
  it("follows the clockwise stroke of an SVG circle (screen y is down)", () => {
    near(tip(circle, 0), 10, 0); // 3 o'clock
    near(tip(circle, 0.25), 0, 10); // 6 o'clock
    near(tip(circle, 0.5), -10, 0); // 9 o'clock
    near(tip(circle, 0.75), 0, -10); // 12 o'clock
  });
});

describe("glow filter", () => {
  it("covers the whole viewBox in user space and is unique per canvas", () => {
    const sol = SAMPLES["line-projection"];
    const html = (t: number) => renderToStaticMarkup(createElement(DrawingCanvas, { solution: sol, timeline: buildTimeline(sol), t, activeStep: 0 }));
    const a = html(0.6);
    expect(a).toMatch(/<filter[^>]*filterUnits="userSpaceOnUse"/);
    const id = a.match(/<filter id="([^"]+)"/)![1];
    expect(a).toContain(`filter="url(#${id})"`);
    expect(id).not.toMatch(/[:\s]/);
  });
});
