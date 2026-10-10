"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Solution } from "@/lib/schema";
import { buildTimeline, stepAt } from "@/lib/timeline";
import { DrawingCanvas } from "./DrawingCanvas";

const SPEEDS = [0.5, 1, 2];
const ZOOMS = [1, 2, 3];

/** Longest animation step per frame: after a hidden tab or a stalled frame the first tick must not jump the lesson ahead. */
export const MAX_FRAME_DT = 0.1;
export function frameDt(last: number | null, now: number): number {
  return last == null ? 0 : Math.min(MAX_FRAME_DT, Math.max(0, (now - last) / 1000));
}

/** Whether the player should take a key press for itself, or leave it to the control/browser that has it. */
export function playerKeyAction(e: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">, el: Element | null, zoomed = false): "prev" | "next" | "toggle" | null {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null; // browser shortcuts such as Alt+Left (Back)
  const tag = el?.tagName ?? "";
  if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return null;
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    if (zoomed && el?.closest("[data-board]")) return null; // arrows pan a zoomed drawing
    return e.key === "ArrowRight" ? "next" : "prev";
  }
  // Space belongs to a focused button or link: it activates that control
  if (e.key === " " && el?.closest("[data-player]") && !el.closest("button, a, summary")) return "toggle";
  return null;
}

/** `active` false holds the clock (for example while the player is scrolled out of view) without losing the position. */
export function StepPlayer({ solution, compact = false, active = true }: { solution: Solution; compact?: boolean; active?: boolean }) {
  const timeline = useMemo(() => buildTimeline(solution), [solution]);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const last = useRef<number | null>(null);
  const end = timeline.total - 0.8;

  // restart whenever a different lesson is loaded; skip the animation for reduced-motion users
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setT(reduced ? end : 0);
    setPlaying(!reduced);
  }, [solution, end]);

  useEffect(() => {
    if (!playing || !active) return;
    let raf = 0;
    const tick = (now: number) => {
      const dt = frameDt(last.current, now);
      last.current = now;
      setT((prev) => {
        const next = prev + dt * speed;
        if (next >= end) { setPlaying(false); return end; }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); last.current = null; };
  }, [playing, active, speed, end]);

  const step = stepAt(timeline, t);
  const goStep = useCallback((i: number) => {
    const n = Math.max(0, Math.min(solution.steps.length - 1, i));
    setT(timeline.stepStarts[n]);
    setPlaying(true);
  }, [solution.steps.length, timeline.stepStarts]);

  const toggle = () => {
    if (!playing && t >= end - 0.01) setT(0);
    setPlaying((p) => !p);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = playerKeyAction(e, e.target as Element | null, zoom > 1);
      if (action === "next") goStep(step + 1);
      if (action === "prev") goStep(step - 1);
      if (action === "toggle") { e.preventDefault(); toggle(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const cur = solution.steps[step];
  return (
    <div data-player className="player grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="board-frame">
        {/* zooming makes the drawing larger than the frame, which then scrolls: labels stay readable on a phone */}
        <div
          data-board
          className={`${compact ? "aspect-[16/10]" : "aspect-[4/3] lg:aspect-[16/11]"} ${zoom > 1 ? "overflow-auto" : "overflow-hidden"}`}
          {...(zoom > 1 ? { tabIndex: 0, role: "group", "aria-label": "Drawing, zoomed: scroll to pan" } : {})}
        >
          <div style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
            <DrawingCanvas solution={solution} timeline={timeline} t={t} activeStep={step} />
          </div>
        </div>
        <div className="controls">
          <button onClick={() => goStep(step - 1)} aria-label="Previous step" className="ctl">⏮</button>
          <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="ctl ctl-main">{playing ? "❚❚" : "▶"}</button>
          <button onClick={() => goStep(step + 1)} aria-label="Next step" className="ctl">⏭</button>
          <input
            type="range" min={0} max={end} step={0.01} value={Math.min(t, end)}
            onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }}
            aria-label="Scrub through the lesson" className="scrub"
          />
          <button onClick={() => setZoom((z) => ZOOMS[(ZOOMS.indexOf(z) + 1) % ZOOMS.length])} aria-label={`Zoom the drawing, now ${zoom}×`} className="ctl">🔍 {zoom}×</button>
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Speed" className="ctl speed">
            {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
        </div>
      </div>

      <aside className="professor" aria-live="polite">
        <div className="eyebrow">Step {step + 1} of {solution.steps.length}</div>
        <h3 className="prof-title">{cur.title}</h3>
        <p className="prof-text">{cur.explanation}</p>
        <ol className="step-list">
          {solution.steps.map((s, i) => (
            <li key={i}>
              <button onClick={() => goStep(i)} className={i === step ? "on" : ""} aria-current={i === step}>
                <span>{String(i + 1).padStart(2, "0")}</span>{s.title}
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
