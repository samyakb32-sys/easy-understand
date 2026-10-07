import type { Solution } from "../schema";
import { solveIsometricCone, solveIsometricCylinder, solveIsometricPrism, solveIsometricSphere } from "../geometry/isometric";
import { solveSectionPolyhedron, solveSectionRound } from "../geometry/sections";
import { solveConeDevelopment, solveConic, solvePrismDevelopment, solvePyramidDevelopment } from "../geometry/extra";
import { solveIsometricComposite } from "../geometry/composite";
import { solveCylinderPenetration } from "../geometry/penetration";
import { solveIsometricHoled, solveIsometricNotched, solveIsometricRow } from "../geometry/isoextra";
import { solveConeCylinder, solveOffsetCylinders, solvePrismCylinder } from "../geometry/penetration2";
import { solveSolidVpFirst, solveTilted, solveTiltedVpFirst } from "../geometry/tilt";
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
  "isometric-cone": mustSolve(solveIsometricCone({ diameter: 40, height: 60, scale: "isometric" })),
  "isometric-sphere": mustSolve(solveIsometricSphere({ diameter: 50, scale: "isometric" })),
  "isometric-hemisphere": mustSolve(solveIsometricSphere({ diameter: 50, scale: "isometric", hemisphere: true })),
  "isometric-cone-on-cylinder": mustSolve(solveIsometricComposite({ scale: "isometric", parts: [{ kind: "cylinder", diameter: 50, height: 30 }, { kind: "cone", diameter: 40, height: 40 }] })),
  "isometric-cylinder-on-square": mustSolve(solveIsometricComposite({ scale: "isometric", parts: [{ kind: "prism", base: "square", side: 50, height: 20 }, { kind: "cylinder", diameter: 30, height: 40 }] })),
  "isometric-hemisphere-on-prism": mustSolve(solveIsometricComposite({ scale: "isometric", parts: [{ kind: "prism", base: "hexagon", side: 25, height: 30 }, { kind: "hemisphere", diameter: 40 }] })),
  "section-pyramid": mustSolve(solveSectionPolyhedron({ solid: "pyramid", base: "square", side: 40, height: 60, angle: 30, axisHeight: 20 })),
  "section-prism": mustSolve(solveSectionPolyhedron({ solid: "prism", base: "hexagon", side: 25, height: 70, angle: 30, axisHeight: 35 })),
  "section-cone-parabola": mustSolve(solveSectionRound({ solid: "cone", diameter: 60, height: 70, angle: 0, axisHeight: 25, parallelToGenerator: true })),
  "section-cone-hyperbola": mustSolve(solveSectionRound({ solid: "cone", diameter: 60, height: 70, angle: 80, axisHeight: 30, axisOffset: 6 })),
  "section-cylinder": mustSolve(solveSectionRound({ solid: "cylinder", diameter: 40, height: 70, angle: 30, axisHeight: 35 })),
  "penetration-cylinders": mustSolve(solveCylinderPenetration({ mainDiameter: 60, mainHeight: 80, branchDiameter: 40 })),
  "penetration-equal": mustSolve(solveCylinderPenetration({ mainDiameter: 40, mainHeight: 70, branchDiameter: 40 })),
  "isometric-row": mustSolve(solveIsometricRow({ parts: [{ kind: "prism", base: "square", side: 40, height: 30 }, { kind: "cylinder", diameter: 30, height: 50 }, { kind: "sphere", diameter: 40 }], gap: 0, along: "x", scale: "isometric" })),
  "isometric-holed": mustSolve(solveIsometricHoled({ solid: "prism", base: "hexagon", side: 30, height: 40, holeDiameter: 30, holeDepth: 15, scale: "isometric" })),
  "isometric-holed-cylinder": mustSolve(solveIsometricHoled({ solid: "cylinder", diameter: 60, height: 20, holeDiameter: 30, scale: "isometric" })),
  "isometric-notched": mustSolve(solveIsometricNotched({ length: 70, width: 50, height: 40, notchLength: 30, notchWidth: 20, notchDepth: 15, at: "front", scale: "isometric" })),
  "penetration-offset": mustSolve(solveOffsetCylinders({ mainDiameter: 70, mainHeight: 90, branchDiameter: 40, offset: 12 })),
  "penetration-cone": mustSolve(solveConeCylinder({ coneDiameter: 80, coneHeight: 90, branchDiameter: 30, axisHeight: 35 })),
  "penetration-prism": mustSolve(solvePrismCylinder({ side: 60, height: 80, branchDiameter: 40, facesInclined: true })),
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
  "plane-hp-vp": mustSolve(solveTilted({ shape: "hexagon", size: 25, angle: 45, rest: "edge", phi: 30 })),
  "circle-hp-vp": mustSolve(solveTilted({ shape: "circle", size: 50, angle: 30, rest: "edge", phi: 40 })),
  "plane-vp-first": mustSolve(solveTiltedVpFirst({ shape: "pentagon", size: 30, surfaceToVP: 45, sideToHP: 30, rest: "edge" })),
  "cone-vp-first": mustSolve(solveSolidVpFirst({ solid: "cone", diameter: 40, height: 60, angle: 40, phi: 30 })),
  "prism-vp-first": mustSolve(solveSolidVpFirst({ solid: "prism", base: "pentagon", side: 25, height: 50, angle: 35, rest: "edge", phi: 45 })),
  "plane-corner-hp-vp": mustSolve(solveTilted({ shape: "square", size: 30, angle: 40, rest: "corner", phi: 30 })),
  "plane-inclined": mustSolve(solveTilted({ shape: "pentagon", size: 30, angle: 45, rest: "edge" })),
};

export const SAMPLE_CATEGORIES: Record<string, string> = {
  "line-projection": "Orthographic projection",
  pentagon: "Geometric construction",
  "cylinder-development": "Development of surfaces",
  "prism-views": "Views & 3D from 2D",
  "isometric-prism": "Isometric view",
  "isometric-cylinder": "Isometric view",
  "isometric-cone": "Isometric view",
  "isometric-sphere": "Isometric view",
  "isometric-hemisphere": "Isometric view",
  "isometric-cone-on-cylinder": "Isometric view",
  "isometric-cylinder-on-square": "Isometric view",
  "isometric-hemisphere-on-prism": "Isometric view",
  "section-pyramid": "Sections of solids",
  "section-prism": "Sections of solids",
  "section-cone-parabola": "Sections of solids",
  "section-cone-hyperbola": "Sections of solids",
  "section-cylinder": "Sections of solids",
  "penetration-cylinders": "Interpenetration of solids",
  "penetration-equal": "Interpenetration of solids",
  "isometric-row": "Isometric view",
  "isometric-holed": "Isometric view",
  "isometric-holed-cylinder": "Isometric view",
  "isometric-notched": "Isometric view",
  "penetration-offset": "Interpenetration of solids",
  "penetration-cone": "Interpenetration of solids",
  "penetration-prism": "Interpenetration of solids",
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
  "plane-hp-vp": "Projection of planes",
  "circle-hp-vp": "Projection of planes",
  "plane-vp-first": "Projection of planes",
  "cone-vp-first": "Projection of solids",
  "prism-vp-first": "Projection of solids",
  "plane-corner-hp-vp": "Projection of planes",
  "plane-inclined": "Projection of planes",
};
