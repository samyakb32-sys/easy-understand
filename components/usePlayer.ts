"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Solution } from "@/lib/schema";
import { buildTimeline, stepAt } from "@/lib/timeline";

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

export const SPEEDS = [0.5, 1, 2];

/**
 * The lesson clock: draws the solution's steps over time, with play/pause, step jumps, scrubbing and speed.
 * `active` false holds the clock (for example while scrolled out of view) without losing the position.
 * `perStep` stops at the end of each step, for a "next step →" style of teaching.
 */
export function usePlayer(solution: Solution, { active = true, perStep = false, keys = true, zoomed = false } = {}) {
  const timeline = useMemo(() => buildTimeline(solution), [solution]);
  const end = timeline.total - 0.8;
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [stopAt, setStopAt] = useState<number | null>(null);
  const last = useRef<number | null>(null);
  const n = solution.steps.length;
  const stepEnd = useCallback((i: number) => (i + 1 < n ? timeline.stepStarts[i + 1] : end), [n, timeline.stepStarts, end]);

  // restart whenever a different lesson is loaded; skip the animation for reduced-motion users
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setT(perStep ? stepEnd(0) : end); setPlaying(false); setStopAt(null); return; }
    setT(0);
    setPlaying(true);
    setStopAt(perStep ? stepEnd(0) : null);
  }, [solution, end, perStep, stepEnd]);

  useEffect(() => {
    if (!playing || !active) return;
    let raf = 0;
    const limit = stopAt ?? end;
    const tick = (now: number) => {
      const dt = frameDt(last.current, now);
      last.current = now;
      setT((prev) => {
        const next = prev + dt * speed;
        if (next >= limit) { setPlaying(false); return limit; }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); last.current = null; };
  }, [playing, active, speed, end, stopAt]);

  const step = stepAt(timeline, t);
  const finished = t >= end - 0.01;

  const goStep = useCallback((i: number) => {
    const k = Math.max(0, Math.min(n - 1, i));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setT(stepEnd(k)); setPlaying(false); return; }
    setT(timeline.stepStarts[k]);
    setStopAt(perStep ? stepEnd(k) : null);
    setPlaying(true);
  }, [n, timeline.stepStarts, perStep, stepEnd]);

  const toggle = useCallback(() => {
    if (playing) { setPlaying(false); return; }
    if (finished) { setT(0); setStopAt(perStep ? stepEnd(0) : null); setPlaying(true); return; }
    // resuming after a per-step stop carries on to the end of the lesson
    setStopAt(null);
    setPlaying(true);
  }, [playing, finished, perStep, stepEnd]);

  const scrub = useCallback((v: number) => { setPlaying(false); setStopAt(null); setT(v); }, []);

  useEffect(() => {
    if (!keys) return;
    const onKey = (e: KeyboardEvent) => {
      const action = playerKeyAction(e, e.target as Element | null, zoomed);
      if (action === "next") goStep(step + 1);
      if (action === "prev") goStep(step - 1);
      if (action === "toggle") { e.preventDefault(); toggle(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys, zoomed, goStep, toggle, step]);

  return { timeline, t, end, step, n, playing, finished, speed, setSpeed, goStep, toggle, scrub };
}
