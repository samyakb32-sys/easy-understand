import type { Solution } from "../schema";
import { solveIsometricCylinder, solveIsometricPrism } from "../geometry/isometric";
import { solveSectionPolyhedron, solveSectionRound } from "../geometry/sections";
import { solveCylinder, solveLineProjection, solvePentagon, solvePrism } from "../geometry/solvers";

function mustSolve(r: { ok: true; solution: Solution } | { ok: false; reason: string }): Solution {
  if (!r.ok) throw new Error(r.reason);
  return r.solution;
}

/** Ready-made lessons; they need no API key. */
export const SAMPLES: Record<string, Solution> = {
  "line-projection": mustSolve(solveLineProjection(60, 30, 45)),
  pentagon: solvePentagon(30),
  "cylinder-development": solveCylinder(40, 60),
  "prism-views": solvePrism(30, 50),
  "isometric-prism": mustSolve(solveIsometricPrism({ base: "hexagon", side: 25, height: 40, scale: "isometric" })),
  "isometric-cylinder": mustSolve(solveIsometricCylinder({ diameter: 40, height: 50, scale: "isometric" })),
  "section-pyramid": mustSolve(solveSectionPolyhedron({ solid: "pyramid", base: "square", side: 40, height: 60, angle: 30, axisHeight: 20 })),
  "section-prism": mustSolve(solveSectionPolyhedron({ solid: "prism", base: "hexagon", side: 25, height: 70, angle: 30, axisHeight: 35 })),
  "section-cylinder": mustSolve(solveSectionRound({ solid: "cylinder", diameter: 40, height: 70, angle: 30, axisHeight: 35 })),
};

export const SAMPLE_CATEGORIES: Record<string, string> = {
  "line-projection": "Orthographic projection",
  pentagon: "Geometric construction",
  "cylinder-development": "Development of surfaces",
  "prism-views": "Views & 3D from 2D",
  "isometric-prism": "Isometric view",
  "isometric-cylinder": "Isometric view",
  "section-pyramid": "Sections of solids",
  "section-prism": "Sections of solids",
  "section-cylinder": "Sections of solids",
};
