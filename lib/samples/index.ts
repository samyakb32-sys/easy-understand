import type { Solution } from "../schema";
import { solveIsometricCylinder, solveIsometricPrism } from "../geometry/isometric";
import { solveSectionPolyhedron, solveSectionRound } from "../geometry/sections";
import { solveConeDevelopment, solveConic, solvePrismDevelopment, solvePyramidDevelopment } from "../geometry/extra";
import { solveTilted } from "../geometry/tilt";
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
  "ellipse-eccentricity": mustSolve(solveConic(50, 2 / 3)),
  "parabola-eccentricity": mustSolve(solveConic(40, 1)),
  "hyperbola-eccentricity": mustSolve(solveConic(40, 3 / 2)),
  "development-cone": mustSolve(solveConeDevelopment(40, 60)),
  "development-pyramid": mustSolve(solvePyramidDevelopment("square", 30, 50)),
  "development-prism": mustSolve(solvePrismDevelopment("hexagon", 20, 50)),
  "cone-inclined": mustSolve(solveTilted({ solid: "cone", diameter: 40, height: 60, angle: 40 })),
  "pyramid-inclined": mustSolve(solveTilted({ solid: "pyramid", base: "pentagon", side: 25, height: 50, angle: 45, rest: "corner" })),
  "prism-inclined": mustSolve(solveTilted({ solid: "prism", base: "hexagon", side: 25, height: 50, angle: 30, rest: "edge" })),
  "cone-hp-vp": mustSolve(solveTilted({ solid: "cone", diameter: 40, height: 60, angle: 40, phi: 30 })),
  "pyramid-hp-vp": mustSolve(solveTilted({ solid: "pyramid", base: "square", side: 30, height: 60, angle: 45, rest: "corner", phi: 35 })),
  "prism-hp-vp": mustSolve(solveTilted({ solid: "prism", base: "hexagon", side: 25, height: 50, angle: 30, rest: "edge", phi: 50 })),
  "plane-inclined": mustSolve(solveTilted({ shape: "pentagon", size: 30, angle: 45, rest: "edge" })),
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
  "ellipse-eccentricity": "Engineering curves",
  "parabola-eccentricity": "Engineering curves",
  "hyperbola-eccentricity": "Engineering curves",
  "development-cone": "Development of surfaces",
  "development-pyramid": "Development of surfaces",
  "development-prism": "Development of surfaces",
  "cone-inclined": "Projection of solids",
  "pyramid-inclined": "Projection of solids",
  "prism-inclined": "Projection of solids",
  "cone-hp-vp": "Projection of solids",
  "pyramid-hp-vp": "Projection of solids",
  "prism-hp-vp": "Projection of solids",
  "plane-inclined": "Projection of planes",
};
