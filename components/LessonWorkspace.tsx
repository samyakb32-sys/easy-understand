"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Solution } from "@/lib/schema";
import { DrawingCanvas } from "./DrawingCanvas";
import { usePlayer, SPEEDS } from "./usePlayer";
import { useEntitlements } from "./useEntitlements";

// three.js is a large download: fetch it only when the 3D view is opened
const Solid3DViewer = dynamic(() => import("./Solid3DViewer").then((m) => m.Solid3DViewer), {
  ssr: false,
  loading: () => <div className="lesson-canvas board" style={{ display: "grid", placeItems: "center" }}><span className="micro">Loading the 3D model…</span></div>,
});

type View = "draft" | "solid" | "why";
const ZOOMS = [1, 2, 3];

/** The lesson page: step list, the drawing taught step by step (or the 3D solid), and the question with its givens. */
export function LessonWorkspace({ initial, slug, topic }: { initial: Solution | null; slug: string; topic?: string }) {
  const [sol, setSol] = useState<Solution | null>(initial);
  const [loaded, setLoaded] = useState(!!initial);
  const [unsaved, setUnsaved] = useState(false);

  // a lesson made from an upload is passed through sessionStorage
  useEffect(() => {
    if (initial) return;
    try {
      const raw = sessionStorage.getItem("eu:custom");
      const parsed = raw ? Solution.safeParse(JSON.parse(raw)) : null;
      if (parsed?.success) setSol(parsed.data);
      setUnsaved(sessionStorage.getItem("eu:custom-unsaved") === "1");
    } catch {}
    setLoaded(true);
  }, [initial]);

  if (!sol) {
    return (
      <div className="app-shell">
        <main className="page">
          <section className="history-empty">
            <div className="empty-icon" aria-hidden="true">⌁</div>
            <h2>{loaded ? "No lesson here yet" : "Loading…"}</h2>
            {loaded && <p>We couldn’t find that lesson. Upload your question, or open one of the sample lessons.</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <Link className="primary" href="/solve">Solve a question ↗</Link>
              <Link className="ghost" href="/lessons">Browse lessons</Link>
            </div>
          </section>
        </main>
      </div>
    );
  }
  return <Workspace key={slug} sol={sol} topic={topic ?? (initial ? "Lesson" : "Your question")} unsaved={!initial && unsaved} />;
}

function Workspace({ sol, topic, unsaved }: { sol: Solution; topic: string; unsaved: boolean }) {
  const [view, setView] = useState<View>("draft");
  const [zoom, setZoom] = useState(1);
  const p = usePlayer(sol, { perStep: true, zoomed: zoom > 1 });
  const pathname = usePathname();
  const { me, loading, failed, retry } = useEntitlements();
  const unlocked = !loading && !!me?.canUse3D;
  const cur = sol.steps[p.step];
  const stepTitle = (i: number) => sol.steps[i].title;

  const steps = (
    <>
      {sol.steps.map((s, i) => (
        <button key={i} className={`lesson-item ${i === p.step ? "active" : i < p.step || p.finished ? "done" : ""}`} onClick={() => { p.goStep(i); if (view === "solid") setView("draft"); }} aria-current={i === p.step}>
          <i>{String(i + 1).padStart(2, "0")}</i>{s.title}
        </button>
      ))}
    </>
  );
  const givens = sol.givens.length > 0 && (
    <div className="given-list">{sol.givens.map((g) => <div key={g.name}><span>{g.name}</span><b>{g.value}</b></div>)}</div>
  );

  const drawing = (
    <div className="lesson-canvas board" data-board {...(zoom > 1 ? { tabIndex: 0, role: "group", "aria-label": "Drawing, zoomed: scroll to pan" } : {})} style={{ overflow: zoom > 1 ? "auto" : "hidden" }}>
      <div style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
        <DrawingCanvas solution={sol} timeline={p.timeline} t={p.t} activeStep={p.step} highlightStep={p.finished ? -1 : p.step} />
      </div>
      <div className="canvas-tools">
        <button onClick={() => setZoom((z) => ZOOMS[(ZOOMS.indexOf(z) + 1) % ZOOMS.length])} aria-label={`Zoom the drawing, now ${zoom}×`}>⊕ {zoom}×</button>
      </div>
      {view === "why" && <div className="why-card" aria-live="polite"><b>Why this line?</b>{cur.explanation}</div>}
    </div>
  );

  const solid = sol.solid && (unlocked ? (
    <Solid3DViewer spec={sol.solid} />
  ) : (
    // a blurred, still-turning preview: they can see what Pro gives them, but cannot use it
    <div style={{ position: "relative" }}>
      <div inert aria-hidden="true" style={{ filter: "blur(7px)", pointerEvents: "none" }}><Solid3DViewer spec={sol.solid} /></div>
      <div className="lock" role="region" aria-label="3D is a Pro feature">
        <div className="panel">
          <div className="eyebrow">PRO FEATURE</div>
          <h3>{loading ? "Checking your plan…" : failed ? "Couldn’t check your plan" : "Unlock the 3D model"}</h3>
          {failed && <button type="button" className="primary" onClick={() => void retry()}>Try again</button>}
          {!loading && !failed && (
            <>
              <p className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>Rotate the solid and snap to its front, top and side views to see how the drawing connects to the real object.</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
                <Link href="/pricing" className="primary">See Pro plans</Link>
                {!me?.signedIn && me?.configured.auth && <Link href={`/login?next=${encodeURIComponent(pathname ?? "/lessons")}`} className="ghost">Sign in</Link>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  ));

  return (
    <div className="app-shell">
      <main className="lesson-workspace" data-player>
        <aside className="lesson-side">
          <Link className="back" href="/lessons">← ALL LESSONS</Link>
          <div className="lesson-list-title">{topic}</div>
          {steps}
        </aside>
        <section className="workspace-main">
          <div className="workspace-top">
            <div>
              <div className="eyebrow">{topic} · {p.n} steps</div>
              <h1>{sol.title}</h1>
              <p>{sol.problem}</p>
            </div>
            <div className="view-tabs" role="tablist" aria-label="View">
              <button role="tab" aria-selected={view === "draft"} className={view === "draft" ? "active" : ""} onClick={() => setView("draft")}>Drafting</button>
              <button role="tab" aria-selected={view === "solid"} className={view === "solid" ? "active" : ""} onClick={() => setView("solid")} disabled={!sol.solid} title={sol.solid ? "" : "No 3D model for this problem"}>3D solid</button>
              <button role="tab" aria-selected={view === "why"} className={view === "why" ? "active" : ""} onClick={() => setView("why")}>Why this line?</button>
            </div>
          </div>
          {unsaved && <p role="status" className="callout" style={{ marginTop: 14 }}>Solved, but we couldn’t save this lesson to your history. Take a screenshot if you want to keep it.</p>}
          <div style={{ marginTop: 21 }}>{view === "solid" && solid ? solid : drawing}</div>
          {view !== "solid" && (
            <div className="lesson-scrub">
              <input type="range" min={0} max={p.end} step={0.01} value={Math.min(p.t, p.end)} onChange={(e) => p.scrub(Number(e.target.value))} aria-label="Scrub through the lesson" />
              <span>step {p.step + 1} / {p.n}</span>
              <select className="tool" value={p.speed} onChange={(e) => p.setSpeed(Number(e.target.value))} aria-label="Speed">
                {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
              </select>
            </div>
          )}
          <div className="step-control" aria-live="polite">
            <span className="step-badge">{String(p.step + 1).padStart(2, "0")}</span>
            <div><h3>{cur.title}</h3><p>{cur.explanation}</p></div>
            <div className="control-actions">
              <button className="icon-button" onClick={() => p.goStep(p.step - 1)} disabled={p.step === 0} aria-label={p.step > 0 ? `Previous step: ${stepTitle(p.step - 1)}` : "Previous step"}>◀</button>
              <button className="icon-button" onClick={p.toggle} aria-label={p.playing ? "Pause" : p.finished ? "Replay the lesson" : "Play to the end"}>{p.playing ? "❚❚" : p.finished ? "↺" : "▶"}</button>
              <button className="next-step" onClick={() => p.goStep(p.step + 1)} disabled={p.step >= p.n - 1}>Next step →</button>
            </div>
          </div>
          <details className="mobile-extra">
            <summary>All steps and the givens</summary>
            {givens}
            <div style={{ marginTop: 10 }}>{steps}</div>
          </details>
        </section>
        <aside className="lesson-right">
          <h3>Question</h3>
          <div className="problem-copy">{sol.problem}</div>
          {givens}
          <div className="line-legend">
            <h3 style={{ marginTop: 4 }}>Line language</h3>
            <span className="line-key"><i /> visible outline</span>
            <span className="line-key"><i className="dashed" /> hidden detail / construction</span>
            <span className="line-key"><i className="current" /> current step</span>
          </div>
          <div className="tip"><strong>Why it works</strong><br />Every point is projected from one view to the next, so the relation between views stays exact. Use ← → to move between steps and Space to play.</div>
        </aside>
      </main>
    </div>
  );
}
