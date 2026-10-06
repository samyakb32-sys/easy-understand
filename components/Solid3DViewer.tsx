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

function CameraRig({ view }: { view: View }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...CAM[view]);
    camera.lookAt(0, 0, 0);
  }, [view, camera]);
  return null;
}

function Solid({ spec, wire }: { spec: SolidSpec; wire: boolean }) {
  const geo = useMemo(() => buildGeometry(spec), [spec]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo, 25), [geo]);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#1b6fb5" transparent opacity={wire ? 0.05 : 0.5} roughness={0.35} metalness={0.2} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#7fe8ff" toneMapped={false} />
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
  const [wire, setWire] = useState(false);
  const [gl, setGl] = useState<boolean | null>(null);
  useEffect(() => setGl(hasWebGL()), []);

  if (gl === false) return <p className="muted p-6">Your browser can't show 3D (WebGL is off). The 2D steps still work.</p>;
  return (
    <div className="board-frame">
      <div className="aspect-[4/3] lg:aspect-[16/11]">
        {gl && (
          <Canvas dpr={[1, 1.5]} camera={{ position: CAM.iso, fov: 40 }} aria-label="Interactive 3D model">
            <color attach="background" args={["#05080f"]} />
            <ambientLight intensity={0.7} />
            <directionalLight position={[3, 5, 4]} intensity={1.6} />
            <Solid spec={spec} wire={wire} />
            <Grid position={[0, -1.05, 0]} args={[10, 10]} cellColor="#13324f" sectionColor="#1f5f8f" fadeDistance={9} infiniteGrid />
            <CameraRig view={view} />
            <OrbitControls enablePan={false} minDistance={2.5} maxDistance={9} autoRotate={view === "iso"} autoRotateSpeed={1.2} makeDefault />
          </Canvas>
        )}
      </div>
      <div className="controls">
        {(["iso", "front", "top", "side"] as View[]).map((v) => (
          <button key={v} className={`ctl ${view === v ? "ctl-main" : ""}`} onClick={() => setView(v)}>
            {v === "iso" ? "3D" : v[0].toUpperCase() + v.slice(1)}
          </button>
        ))}
        <button className={`ctl ${wire ? "ctl-main" : ""}`} onClick={() => setWire((w) => !w)}>Wireframe</button>
        <span className="muted ml-auto hidden text-xs sm:inline">Drag to rotate · scroll to zoom</span>
      </div>
    </div>
  );
}
