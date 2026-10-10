import { describe, expect, it } from "vitest";
import { PLANS, PRO_DAILY_SOLVES } from "@/lib/pricing";

describe("pricing copy matches enforced limits", () => {
  it("never promises unlimited solves", () => {
    const text = JSON.stringify(PLANS);
    expect(text).not.toMatch(/unlimited/i);
    expect(PLANS.find((p) => p.id === "pro_monthly")!.features.join(" ")).toContain(String(PRO_DAILY_SOLVES));
  });
  it("tells free users that 3D is Pro", () => {
    expect(PLANS.find((p) => p.id === "free")!.features.join(" ")).toMatch(/3D is Pro/);
  });
});
