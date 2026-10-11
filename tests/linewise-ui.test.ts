import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFields, readTags } from "@/lib/readback";
import { miniMesh } from "@/lib/solid/mini";
import { TOPICS, lessonCount, topicOf } from "@/lib/topics";
import { SAMPLES } from "@/lib/samples";
import { StaticDrawing } from "@/components/StaticDrawing";

describe("topics", () => {
  it("put every sample lesson under exactly one landing-page topic", () => {
    for (const slug of Object.keys(SAMPLES)) expect(topicOf(slug), slug).not.toBeNull();
    expect(TOPICS.reduce((n, t) => n + lessonCount(t.id), 0)).toBe(Object.keys(SAMPLES).length);
  });
});

describe("read-back of a classified problem", () => {
  it("offers the numbers as editable fields with units, and the choices as tags", () => {
    const t = { template: "solid_inclined", solid: "cone", base: "square", size: 30, height: 50, angle: 40, phi: 30, rest: "edge", first: "HP" };
    const f = readFields(t);
    expect(f.map((x) => x.key)).toEqual(["size", "height", "angle", "phi"]);
    expect(f.find((x) => x.key === "angle")!.unit).toBe("°");
    expect(f.find((x) => x.key === "height")!.unit).toBe("mm");
    expect(readTags(t)).toContain("solid: cone");
    expect(readTags(t).some((x) => x.includes("template"))).toBe(false);
  });
  it("gives eccentricity no unit", () => {
    expect(readFields({ template: "conic", distance: 50, eccentricity: 0.66 })[1]).toMatchObject({ key: "eccentricity", unit: "" });
  });
});

describe("canvas solid mesh", () => {
  it("is centred and fits a size-2 box for every sample solid", () => {
    for (const [slug, s] of Object.entries(SAMPLES)) {
      if (!s.solid) continue;
      const m = miniMesh(s.solid);
      for (let i = 0; i < 3; i++) {
        const vs = m.verts.map((v) => v[i]);
        const lo = Math.min(...vs), hi = Math.max(...vs);
        expect(hi - lo, slug).toBeLessThanOrEqual(2 + 1e-9);
        expect(Math.abs(lo + hi), slug).toBeLessThan(1e-9);
      }
      for (const f of m.faces) for (const j of f) expect(j).toBeLessThan(m.verts.length);
    }
  });
});

describe("lesson thumbnails", () => {
  it("render every sample as SVG without text labels", () => {
    for (const s of Object.values(SAMPLES)) {
      const html = renderToStaticMarkup(createElement(StaticDrawing, { solution: s }));
      expect(html.startsWith("<svg")).toBe(true);
      expect(html).not.toContain("<text");
      expect(html).not.toContain("NaN");
    }
  });
});

describe("Sarthak's lines", () => {
  it("deal every line once before any repeats, never starting with the last one said", async () => {
    const { SARTHAK_LINES, shuffledOrder } = await import("@/components/Sarthak");
    expect(new Set(SARTHAK_LINES).size).toBe(SARTHAK_LINES.length);
    for (let last = -1; last < SARTHAK_LINES.length; last++) {
      const order = shuffledOrder(SARTHAK_LINES.length, last);
      expect([...order].sort((a, b) => a - b)).toEqual(SARTHAK_LINES.map((_, i) => i));
      expect(order[0]).not.toBe(last);
    }
  });
});
