"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Solution } from "@/lib/schema";
import { buildTimeline } from "@/lib/timeline";
import { DrawingCanvas } from "./DrawingCanvas";
import { MiniSolid } from "./MiniSolid";
import { frameDt } from "./StepPlayer";

type Mode = "draft" | "solid" | "why";
const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

/** The landing page's live lesson: a real sample, drawn step by step, with its solid and the reason for each step. */
export function HeroLessonCard({ solution, label }: { solution: Solution; label: string }) {
  const timeline = useMemo(() => buildTimeline(solution), [solution]);
  const [mode, setMode] = useState<Mode>(solution.solid ? "solid" : "draft");
  const [step, setStep] = useState(0);
  const [t, setT] = useState(0);
  const last = useRef<number | null>(null);
  const n = solution.steps.length;
  const stepEnd = (i: number) => (i + 1 < n ? timeline.stepStarts[i + 1] : timeline.total - 0.8);

  // draw just this step, then hold: the student taps → for the next one
  useEffect(() => {
    if (mode !== "draft") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = stepEnd(step);
    if (reduced) { setT(target); return; }
    setT(timeline.stepStarts[step]);
    let raf = 0;
    const tick = (now: number) => {
      const dt = frameDt(last.current, now);
      last.current = now;
      let done = false;
      setT((prev) => { const next = prev + dt; if (next >= target) { done = true; return target; } return next; });
      if (!done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); last.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, step, timeline]);

  const cur = solution.steps[step];
  const tag = mode === "solid" ? "3D / DRAG ME" : mode === "draft" ? "2D / PROJECT" : "WHY / EXPLAIN";
  const tip = mode === "solid" ? "← drag to orbit →" : mode === "draft" ? "construction first, outline last" : `step ${step + 1} of ${n}`;

  return (
    <div className="lesson-card">
      <div className="lessonbar">
        <span>{label}</span>
        <span className="pill">{mode === "solid" ? "LIVE 3D" : "LIVE LESSON"}</span>
      </div>
      <div className="modebar" role="tablist" aria-label="Lesson view">
        {(["draft", "solid", "why"] as Mode[]).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} className={`mode ${mode === m ? "active" : ""}`} onClick={() => setMode(m)} disabled={m === "solid" && !solution.solid}>
            {m === "draft" ? "Drafting" : m === "solid" ? "3D solid" : "Why this line?"}
          </button>
        ))}
      </div>
      <div className="shapezone">
        {mode === "solid" && solution.solid ? (
          <MiniSolid spec={solution.solid} label={solution.title} />
        ) : mode === "draft" ? (
          <DrawingCanvas solution={solution} timeline={timeline} t={t} activeStep={step} />
        ) : (
          <div className="why" aria-live="polite"><b>{cur.title}</b><span>{cur.explanation}</span></div>
        )}
        <span className="tag3d" aria-hidden="true">{tag}</span>
        {mode !== "why" && <span className="dragtip" aria-hidden="true">{tip}</span>}
      </div>
      <div className="lessonfoot">
        <span className="stepno">{String(step + 1).padStart(2, "0")}</span>
        <div className="stepcopy" aria-live="polite">{cur.title}<small>{firstSentence(cur.explanation)}</small></div>
        <button className="next" aria-label="Next step" onClick={() => { setStep((s) => (s + 1) % n); if (mode === "solid") setMode("draft"); }}>→</button>
      </div>
      <div className="solutionmeta">
        <div className="progressline" role="img" aria-label={`Step ${step + 1} of ${n}`}>
          {solution.steps.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}
        </div>
        <div className="legend" aria-hidden="true"><span>construction</span><span>outline</span><span>current</span></div>
      </div>
    </div>
  );
}
