import type { SolidSpec } from "../schema";

export type V3 = [number, number, number];
export type Mesh = { verts: V3[]; faces: number[][]; smooth: boolean };

/**
 * A small polygon mesh of a SolidSpec for the lightweight canvas viewer (no three.js), centred and scaled so the
 * largest side is 2. Y is up, like lib/solid/buildMesh.ts.
 */
export function miniMesh(spec: SolidSpec, segments = 28): Mesh {
  const verts: V3[] = [];
  const faces: number[][] = [];
  let smooth = false;
  if (spec.kind === "extrude" || spec.kind === "pyramid") {
    const n = spec.profile.length;
    spec.profile.forEach(([x, z]) => verts.push([x, 0, z]));
    faces.push([...Array(n).keys()].reverse());
    if (spec.kind === "extrude") {
      spec.profile.forEach(([x, z]) => verts.push([x, spec.height, z]));
      faces.push([...Array(n).keys()].map((i) => n + i));
      for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + ((i + 1) % n), n + i]);
    } else {
      const cx = spec.profile.reduce((a, p) => a + p[0], 0) / n, cz = spec.profile.reduce((a, p) => a + p[1], 0) / n;
      verts.push([cx, spec.height, cz]);
      for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n]);
    }
  } else {
    smooth = true;
    const prof = spec.profile;
    for (const [r, y] of prof) for (let k = 0; k < segments; k++) {
      const a = (2 * Math.PI * k) / segments;
      verts.push([r * Math.cos(a), y, r * Math.sin(a)]);
    }
    for (let j = 0; j + 1 < prof.length; j++) for (let k = 0; k < segments; k++) {
      const k2 = (k + 1) % segments;
      faces.push([j * segments + k, j * segments + k2, (j + 1) * segments + k2, (j + 1) * segments + k]);
    }
    // close the ends that sit off the axis (a cylinder's top and bottom)
    for (const j of [0, prof.length - 1]) if (prof[j][0] > 1e-6) faces.push([...Array(segments).keys()].map((k) => j * segments + k));
  }
  let lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const v of verts) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], v[i]); hi[i] = Math.max(hi[i], v[i]); }
  const c = lo.map((l, i) => (l + hi[i]) / 2);
  const k = 2 / Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  return { verts: verts.map((v) => v.map((x, i) => (x - c[i]) * k) as V3), faces, smooth };
}

/** Rotates by yaw (about Y) then pitch (about X). */
export function rotate([x, y, z]: V3, yaw: number, pitch: number): V3 {
  const X = x * Math.cos(yaw) - z * Math.sin(yaw);
  let Z = x * Math.sin(yaw) + z * Math.cos(yaw);
  const Y = y * Math.cos(pitch) - Z * Math.sin(pitch);
  Z = y * Math.sin(pitch) + Z * Math.cos(pitch);
  return [X, Y, Z];
}
