// Re-exports of the small solid helpers so tests and callers have one import path.
export { cutPolyhedron, edgeNormal, polygonArea, polygonCentroid, prismPoly, pyramidPoly, regularPolygon, SIDES } from "./solids";
export type { Poly, RegularBase, SectionPoint, Vec3 } from "./solids";
