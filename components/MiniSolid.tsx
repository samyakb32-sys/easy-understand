"use client";

import { useEffect, useMemo, useRef } from "react";
import type { SolidSpec } from "@/lib/schema";
import { miniMesh, rotate } from "@/lib/solid/mini";

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Drag-to-orbit solid on a 2D canvas: the landing page's light alternative to the three.js viewer. */
export function MiniSolid({ spec, label }: { spec: SolidSpec; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mesh = useMemo(() => miniMesh(spec), [spec]);
  const view = useRef({ yaw: -0.72, pitch: 0.42 });

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const render = () => {
      const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
      if (!r.width) return;
      canvas.width = r.width * d; canvas.height = r.height * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const w = r.width, h = r.height;
      ctx.clearRect(0, 0, w, h);
      const ink = css("--ink") || "#151b27", violet = css("--violet") || "#684bff", acid = css("--acid") || "#d5fa54", hot = css("--hot") || "#fa4b2a";
      const { yaw, pitch } = view.current;
      const rot = mesh.verts.map((v) => rotate(v, yaw, pitch));
      const sc = Math.min(w * 0.3, h * 0.36);
      const p = rot.map(([x, y, z]) => [w * 0.5 + (x * sc) / (1 + z * 0.12), h * 0.52 - (y * sc) / (1 + z * 0.12)] as const);
      // ground and axis, like the draft's reference lines
      ctx.setLineDash([4, 5]); ctx.strokeStyle = ink + "55"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(12, h * 0.86); ctx.lineTo(w - 12, h * 0.86); ctx.moveTo(w * 0.5, 14); ctx.lineTo(w * 0.5, h * 0.9); ctx.stroke(); ctx.setLineDash([]);
      const light = rotate([0.4, 0.8, -0.45], 0, 0);
      const order = mesh.faces.map((f, i) => ({ f, i, z: f.reduce((a, j) => a + rot[j][2], 0) / f.length })).sort((a, b) => b.z - a.z);
      for (const { f } of order) {
        // face normal in view space for simple shading
        const [a, b, c] = [rot[f[0]], rot[f[1]], rot[f[2]]];
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const len = Math.hypot(...n) || 1;
        const lum = Math.abs((n[0] * light[0] + n[1] * light[1] + n[2] * light[2]) / len);
        ctx.beginPath();
        f.forEach((j, k) => (k ? ctx.lineTo(p[j][0], p[j][1]) : ctx.moveTo(p[j][0], p[j][1])));
        ctx.closePath();
        ctx.fillStyle = violet;
        ctx.globalAlpha = 0.45 + 0.5 * lum;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = mesh.smooth ? violet : ink;
        ctx.lineWidth = mesh.smooth ? 0.6 : 2;
        ctx.stroke();
      }
      // one highlighted edge with its corners: the "current line" of the lesson
      const top = mesh.faces[1] ?? mesh.faces[0];
      if (!mesh.smooth && top.length >= 3) {
        ctx.strokeStyle = acid; ctx.lineWidth = 4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(p[top[0]][0], p[top[0]][1]); ctx.lineTo(p[top[1]][0], p[top[1]][1]); ctx.lineTo(p[top[2]][0], p[top[2]][1]); ctx.stroke();
        ctx.fillStyle = hot;
        for (const j of top.slice(0, 3)) { ctx.beginPath(); ctx.arc(p[j][0], p[j][1], 4, 0, 7); ctx.fill(); }
      }
    };
    const ro = new ResizeObserver(render);
    ro.observe(canvas);
    render();
    let drag: [number, number] | null = null;
    const down = (e: PointerEvent) => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      view.current.yaw += (e.clientX - drag[0]) * 0.009;
      view.current.pitch = Math.max(-0.65, Math.min(0.9, view.current.pitch + (e.clientY - drag[1]) * 0.008));
      drag = [e.clientX, e.clientY];
      render();
    };
    const up = () => { drag = null; };
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { view.current.yaw += e.key === "ArrowLeft" ? -0.15 : 0.15; e.preventDefault(); render(); }
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("keydown", key);
    // repaint with the other palette when the theme flips
    const mo = new MutationObserver(render);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => { ro.disconnect(); mo.disconnect(); canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move); canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up); canvas.removeEventListener("keydown", key); };
  }, [mesh]);

  return <canvas ref={ref} tabIndex={0} aria-label={`${label}: drag, or use the arrow keys, to turn the 3D model`} />;
}
