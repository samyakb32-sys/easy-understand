import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Template } from "@/lib/geometry/solvers";

// The AI only ever sees the SYSTEM prompt in app/api/solve/route.ts; if it drifts from the zod Template union,
// the model emits shapes the solver rejects. This keeps the two in step.
const src = readFileSync("app/api/solve/route.ts", "utf8");
const prompt = src.slice(src.indexOf("const SYSTEM = `"), src.indexOf("`;", src.indexOf("If a number is unreadable")));
const names = Template.options.map((o) => o.shape.template.value as string);

describe("AI prompt matches the Template schema", () => {
  it.each(names)("documents template %s", (name) => {
    expect(prompt).toContain(`"template":"${name}"`);
  });
  it("mentions no template the schema does not have", () => {
    const mentioned = [...prompt.matchAll(/"template":"([a-z_]+)"/g)].map((m) => m[1]);
    const known = new Set([...names, "unsupported"]);
    expect(mentioned.filter((m) => !known.has(m))).toEqual([]);
  });
  it("lists every field name of every template", () => {
    for (const o of Template.options) {
      const name = o.shape.template.value as string;
      const line = prompt.split("\n- ").find((l) => l.includes(`"template":"${name}"`) || l.startsWith(name)) ?? "";
      for (const key of Object.keys(o.shape)) expect(line, `${name}.${key}`).toContain(key);
    }
  });
});
