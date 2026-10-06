import * as THREE from "three";
import type { SolidSpec } from "../schema";

/** Builds a centred, unit-scaled (largest side = 2) geometry from a SolidSpec. Y is up. */
export function buildGeometry(spec: SolidSpec): THREE.BufferGeometry {
  let g: THREE.BufferGeometry;
  if (spec.kind === "extrude") {
    const shape = new THREE.Shape(spec.profile.map(([x, z]) => new THREE.Vector2(x, z)));
    g = new THREE.ExtrudeGeometry(shape, { depth: spec.height, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); // extrusion axis (z) becomes up (y)
  } else if (spec.kind === "pyramid") {
    const n = spec.profile.length;
    const apex = [0, spec.height, 0];
    const base = spec.profile.map(([x, z]) => [x, 0, z]);
    const tri: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = base[i], b = base[(i + 1) % n];
      tri.push(...a, ...b, ...apex);        // side face
      tri.push(0, 0, 0, ...b, ...a);        // base fan (centre assumed inside the polygon)
    }
    g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(tri, 3));
    g.computeVertexNormals();
  } else {
    g = new THREE.LatheGeometry(spec.profile.map(([r, y]) => new THREE.Vector2(r, y)), 64);
  }
  g.computeBoundingBox();
  const box = g.boundingBox!;
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z);
  g.scale(...(Array(3).fill(2 / Math.max(size.x, size.y, size.z)) as [number, number, number]));
  return g;
}
