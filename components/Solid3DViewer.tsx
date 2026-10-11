"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { SolidSpec } from "@/lib/schema";
import { buildGeometry } from "@/lib/solid/buildMesh";

type View = "iso" | "front" | "top" | "side";
const CAM: Record<View, [number, number, number]> = {
  iso: [3.2, 2.6, 3.6],
  front: [0, 0, 5],
  top: [0, 5, 0.001],
  side: [5, 0, 0],
};

/** `snap` changes on every view-button click, so choosing the active view again re-centres a camera the student has dragged. */
function CameraRig({ view, snap }: { view: View; snap: number }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...CAM[view]);
    camera.lookAt(0, 0, 0);
  }, [view, snap, camera]);
  return null;
}

/** Reads the site's theme colours, and again whenever the light/dark toggle flips them. */
function usePalette() {
  const read = () => {
    const cs = getComputedStyle(document.documentElement);
    return { violet: cs.getPropertyValue("--violet").trim() || "#684bff", ink: cs.getPropertyValue("--ink").trim() || "#151b27", line: cs.getPropertyValue("--line").trim() || "#d9dce1" };
  };
  const [pal, setPal] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setPal(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return pal;
}

function Solid({ spec, wire, face, edge }: { spec: SolidSpec; wire: boolean; face: string; edge: string }) {
  const geo = useMemo(() => buildGeometry(spec), [spec]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo, 25), [geo]);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color={face} transparent opacity={wire ? 0.05 : 0.7} roughness={0.5} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={edge} toneMapped={false} />
      </lineSegments>
    </group>
  );
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function Solid3DViewer({ spec }: { spec: SolidSpec }) {
  const [view, setView] = useState<View>("iso");
  const [snap, setSnap] = useState(0);
  const [wire, setWire] = useState(false);
  const [gl, setGl] = useState<boolean | null>(null);
  useEffect(() => setGl(hasWebGL()), []);
  const pal = usePalette();

  if (gl === false) return <div className="board"><p className="muted" style={{ padding: 24 }}>Your browser can't show 3D (WebGL is off). The 2D steps still work.</p></div>;
  return (
    <div className="board">
      <span className="board-tag" aria-hidden="true">3D / DRAG ME</span>
      <div className="viewer3d">
        {gl && (
          <Canvas dpr={[1, 1.5]} camera={{ position: CAM.iso, fov: 40 }} aria-label="Interactive 3D model">
            <ambientLight intensity={0.9} />
            <directionalLight position={[3, 5, 4]} intensity={1.4} />
            <Solid spec={spec} wire={wire} face={pal.violet} edge={pal.ink} />
            <Grid position={[0, -1.05, 0]} args={[10, 10]} cellColor={pal.line} sectionColor={pal.violet} fadeDistance={9} infiniteGrid />
            <CameraRig view={view} snap={snap} />
            <OrbitControls enablePan={false} minDistance={2.5} maxDistance={9} autoRotate={view === "iso"} autoRotateSpeed={1.2} makeDefault />
          </Canvas>
        )}
      </div>
      <div className="viewer3d-bar">
        {(["iso", "front", "top", "side"] as View[]).map((v) => (
          <button key={v} className={`tool ${view === v ? "on" : ""}`} onClick={() => { setView(v); setSnap((n) => n + 1); }}>
            {v === "iso" ? "3D" : v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
        <button className={`tool ${wire ? "on" : ""}`} onClick={() => setWire((w) => !w)}>Wireframe</button>
        <span className="muted mono" style={{ marginLeft: "auto", fontSize: 10 }}>drag to rotate · scroll to zoom</span>
      </div>
    </div>
  );
}
