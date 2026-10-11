/** Turns a classified template into the editable "is this right?" fields shown before the lesson opens. */
export type ReadField = { key: string; label: string; value: number; unit: string };

const LABELS: Record<string, string> = {
  size: "Size (side or diameter)", thetaHP: "Angle to HP", phiVP: "Angle to VP", angle: "Angle", phi: "Second angle", axisHeight: "Axis height",
  axisOffset: "Axis offset", holeDiameter: "Hole diameter", holeDepth: "Hole depth", notchLength: "Notch length",
  notchWidth: "Notch width", notchDepth: "Notch depth", mainDiameter: "Main diameter", mainHeight: "Main height",
  branchDiameter: "Branch diameter", coneDiameter: "Cone diameter", coneHeight: "Cone height",
};
const words = (k: string) => LABELS[k] ?? k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
const unitOf = (k: string) => (/angle|theta|phi/i.test(k) ? "°" : k === "eccentricity" ? "" : "mm");

export function readFields(template: Record<string, unknown>): ReadField[] {
  return Object.entries(template)
    .filter(([, v]) => typeof v === "number")
    .map(([key, v]) => ({ key, label: words(key), value: v as number, unit: unitOf(key) }));
}

/** The word-valued choices (solid, base, rest…), shown as tags. */
export function readTags(template: Record<string, unknown>): string[] {
  return Object.entries(template)
    .filter(([k, v]) => k !== "template" && (typeof v === "string" || typeof v === "boolean"))
    .map(([k, v]) => (typeof v === "boolean" ? (v ? words(k).toLowerCase() : "") : `${words(k).toLowerCase()}: ${v}`))
    .filter(Boolean);
}
