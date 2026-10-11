"use client";

import Link from "next/link";
import type { Solution } from "@/lib/schema";
import { DrawingCanvas } from "../DrawingCanvas";
import { MiniSolid } from "../MiniSolid";
import { usePlayer } from "../usePlayer";
import { useState } from "react";

type Mode = "draft" | "solid" | "why";
const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

/** The home page's live lesson card: a real solved sample, taught one step per tap, with its solid and the reason for each step. */
export function HomeDemo({ solution, slug, label }: { solution: Solution; slug: string; label: string }) {
  const [mode, setMode] = useState<Mode>(solution.solid ? "solid" : "draft");
  const p = usePlayer(solution, { perStep: true, keys: false });
  const cur = solution.steps[p.step];
  const next = () => { p.goStep((p.step + 1) % p.n); if (mode === "solid") setMode("draft"); };

  return (
    <div className="demo-card">
      <div className="demo-head"><span className="micro">{label}</span><span className="live">{mode === "solid" ? "LIVE 3D" : "LIVE LESSON"}</span></div>
      <div className="mini-problem"><strong>Question:</strong> {solution.problem}</div>
      <div className="mode-switch" role="tablist" aria-label="Lesson view">
        {(["draft", "solid", "why"] as Mode[]).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "active" : ""} onClick={() => setMode(m)} disabled={m === "solid" && !solution.solid}>
            {m === "draft" ? "Drafting" : m === "solid" ? "3D solid" : "Why this line?"}
          </button>
        ))}
      </div>
      <div className="hero-canvas board">
        {mode === "solid" && solution.solid ? (
          <MiniSolid spec={solution.solid} label={solution.title} />
        ) : (
          <>
            <DrawingCanvas solution={solution} timeline={p.timeline} t={p.t} activeStep={p.step} />
            {mode === "why" && <div className="why-card" aria-live="polite"><b>Why this line?</b>{cur.explanation}</div>}
          </>
        )}
      </div>
      <div className="player-bottom">
        <span className="step-badge">{String(p.step + 1).padStart(2, "0")}</span>
        <div className="player-title" aria-live="polite">{cur.title}<small>{firstSentence(cur.explanation)}</small></div>
        <button className="next-btn" onClick={next} aria-label="Next lesson step">→</button>
      </div>
      <div className="progress" role="img" aria-label={`Step ${p.step + 1} of ${p.n}`}>
        {solution.steps.map((_, i) => <i key={i} className={i <= p.step ? "on" : ""} />)}
      </div>
      <Link href={`/lessons/${slug}`} className="micro" style={{ display: "inline-block", marginTop: 10, textDecoration: "underline", textUnderlineOffset: 3 }}>Open the full lesson ↗</Link>
    </div>
  );
}
