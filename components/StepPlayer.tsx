"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Solution } from "@/lib/schema";
import { buildTimeline, stepAt } from "@/lib/timeline";
import { DrawingCanvas } from "./DrawingCanvas";

const SPEEDS = [0.5, 1, 2];

export function StepPlayer({ solution, compact = false }: { solution: Solution; compact?: boolean }) {
  const timeline = useMemo(() => buildTimeline(solution), [solution]);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const last = useRef<number | null>(null);
  const end = timeline.total - 0.8;

  // restart whenever a different lesson is loaded; skip the animation for reduced-motion users
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setT(reduced ? end : 0);
    setPlaying(!reduced);
  }, [solution, end]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = (now: number) => {
      const dt = last.current == null ? 0 : (now - last.current) / 1000;
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
  }, [playing, speed, end]);

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
      const el = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (e.key === "ArrowRight") goStep(step + 1);
      if (e.key === "ArrowLeft") goStep(step - 1);
      if (e.key === " " && el.closest("[data-player]")) { e.preventDefault(); toggle(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const cur = solution.steps[step];
  return (
    <div data-player className="player grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="board-frame">
        <div className={compact ? "aspect-[16/10]" : "aspect-[4/3] lg:aspect-[16/11]"}>
          <DrawingCanvas solution={solution} timeline={timeline} t={t} activeStep={step} />
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
