import type { Solution } from "../schema";
import { solveCylinder, solveLineProjection, solvePentagon, solvePrism } from "../geometry/solvers";

function mustSolve(r: ReturnType<typeof solveLineProjection>): Solution {
  if (!r.ok) throw new Error(r.reason);
  return r.solution;
}

/** Ready-made lessons; they need no API key. */
export const SAMPLES: Record<string, Solution> = {
  "line-projection": mustSolve(solveLineProjection(60, 30, 45)),
  pentagon: solvePentagon(30),
  "cylinder-development": solveCylinder(40, 60),
  "prism-views": solvePrism(30, 50),
};

export const SAMPLE_CATEGORIES: Record<string, string> = {
  "line-projection": "Orthographic projection",
  pentagon: "Geometric construction",
  "cylinder-development": "Development of surfaces",
  "prism-views": "Views & 3D from 2D",
};
