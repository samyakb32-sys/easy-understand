import * as THREE from "three";
import type { SolidSpec } from "../schema";

/** Builds a centred, unit-scaled (largest side = 2) geometry from a SolidSpec. Y is up. */
export function buildGeometry(spec: SolidSpec): THREE.BufferGeometry {
  let g: THREE.BufferGeometry;
  if (spec.kind === "extrude") {
    const shape = new THREE.Shape(spec.profile.map(([x, z]) => new THREE.Vector2(x, z)));
    g = new THREE.ExtrudeGeometry(shape, { depth: spec.height, bevelEnabled: false });
    g.rotateX(-Math.PI / 2); // extrusion axis (z) becomes up (y)
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
