import { it } from "vitest";
import { SAMPLES } from "@/lib/samples";
import { renderIfAsked } from "./helpers/svg";

// RENDER_DIR=/some/dir npx vitest run tests/render.test.ts   then   node scripts/svg2png.mjs /some/dir
it("renders every sample when RENDER_DIR is set", () => {
  for (const [k, s] of Object.entries(SAMPLES)) renderIfAsked(k, s);
});
