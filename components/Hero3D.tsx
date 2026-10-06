"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const CYAN = "#5fe3ff";
const AMBER = "#ffb347";
const S = 1.5; // cube side

const ease = (x: number) => x * x * (3 - 2 * x);

/** A square outline lying on one of the three principal planes: the 2D view of the cube. */
function ViewPlane({ axis, group }: { axis: "x" | "y" | "z"; group: React.RefObject<THREE.Group | null> }) {
  const geo = useMemo(() => {
    const e = new THREE.EdgesGeometry(new THREE.PlaneGeometry(S, S));
    return e;
  }, []);
  const rot: [number, number, number] = axis === "z" ? [0, 0, 0] : axis === "y" ? [-Math.PI / 2, 0, 0] : [0, Math.PI / 2, 0];
  return (
    <group ref={group}>
      <group rotation={rot}>
        <lineSegments geometry={geo}>
          <lineBasicMaterial color={AMBER} toneMapped={false} />
        </lineSegments>
        <mesh>
          <planeGeometry args={[S, S]} />
          <meshBasicMaterial color={AMBER} transparent opacity={0.07} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

function Scene() {
  const root = useRef<THREE.Group>(null);
  const cube = useRef<THREE.Group>(null);
  const front = useRef<THREE.Group>(null);
  const top = useRef<THREE.Group>(null);
  const side = useRef<THREE.Group>(null);
  const embers = useRef<THREE.Points>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const size = useThree((s) => s.size);
  // wide screens: solid sits right of the headline; phones: it floats behind and above the text
  const wide = size.width / size.height > 1.1;
  const place: [number, number, number] = wide ? [2.2, 0, -1] : [0, 0.9, -4.5];

  const cubeEdges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(S, S, S)), []);
  const emberData = useMemo(() => {
    const n = 90;
    const pos = new Float32Array(n * 3);
    const spd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([(Math.random() - 0.5) * 7, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 4], i * 3);
      spd[i] = 0.1 + Math.random() * 0.25;
    }
    return { pos, spd };
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    // 10 s loop: views drift in to the solid, hold, then drift back out
    const k = (t % 10) / 10;
    const inward = k < 0.35 ? ease(k / 0.35) : k < 0.65 ? 1 : k < 0.9 ? 1 - ease((k - 0.65) / 0.25) : 0;
    const d = S / 2 + 0.02 + (1 - inward) * 1.7;
    front.current?.position.set(0, 0, d);
    top.current?.position.set(0, d, 0);
    side.current?.position.set(d, 0, 0);

    if (cube.current) cube.current.rotation.y = t * 0.15;
    if (root.current) {
      root.current.rotation.y += (pointer.current.x * 0.35 - root.current.rotation.y) * Math.min(1, dt * 2);
      root.current.rotation.x += (pointer.current.y * 0.2 - root.current.rotation.x) * Math.min(1, dt * 2);
    }
    const arr = embers.current?.geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (arr) {
      for (let i = 0; i < arr.count; i++) {
        let y = arr.getY(i) + emberData.spd[i] * dt;
        if (y > 2.6) y = -2.6;
        arr.setY(i, y);
      }
      arr.needsUpdate = true;
    }
  });

  return (
    <group ref={root} position={place}>
      <group ref={cube}>
        <lineSegments geometry={cubeEdges}>
          <lineBasicMaterial color={CYAN} toneMapped={false} />
        </lineSegments>
        <mesh>
          <boxGeometry args={[S, S, S]} />
          <meshBasicMaterial color={CYAN} transparent opacity={0.06} depthWrite={false} />
        </mesh>
        <ViewPlane axis="z" group={front} />
        <ViewPlane axis="y" group={top} />
        <ViewPlane axis="x" group={side} />
      </group>
      <gridHelper args={[14, 28, "#1c4a6e", "#0f2740"]} position={[0, -1.3, 0]} />
      <points ref={embers}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[emberData.pos, 3]} />
        </bufferGeometry>
        <pointsMaterial color={AMBER} size={0.035} transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
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

export default function Hero3D() {
  const [ok, setOk] = useState<boolean | null>(null);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setOk(hasWebGL());
  }, []);
  if (!ok) return <div className="hero-fallback" aria-hidden="true" />;
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.6, 5], fov: 45 }} frameloop={reduced.current ? "demand" : "always"} aria-hidden="true">
      <Scene />
    </Canvas>
  );
}
