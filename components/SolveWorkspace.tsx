"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Solution } from "@/lib/schema";
import { StepPlayer } from "./StepPlayer";
import { useEntitlements } from "./useEntitlements";

// three.js is a large download: fetch it only when the 3D tab is opened
const Solid3DViewer = dynamic(() => import("./Solid3DViewer").then((m) => m.Solid3DViewer), { ssr: false, loading: () => <div className="board"><p className="muted" style={{ padding: 24 }}>Loading the 3D model…</p></div> });

export function SolveWorkspace({ initial, slug, category }: { initial: Solution | null; slug: string; category?: string }) {
  const [sol, setSol] = useState<Solution | null>(initial);
  const [loaded, setLoaded] = useState(!!initial);
  const [tab, setTab] = useState<"2d" | "3d">("2d");
  const [unsaved, setUnsaved] = useState(false);
  const pathname = usePathname();
  const { me, loading, failed, retry } = useEntitlements();
  const unlocked = !loading && !!me?.canUse3D;

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
      <main className="page shell">
        <h1>{loaded ? "No lesson here yet" : "Loading…"}</h1>
        {loaded && <p className="lede">We couldn&apos;t find that lesson. Upload your question, or pick one of the sample lessons.</p>}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/#solve" className="btn btn-primary">Upload a problem</Link>
          <Link href="/lessons" className="btn">Browse lessons</Link>
        </div>
      </main>
    );
  }

  const board3d = !sol.solid || tab === "2d" ? undefined : unlocked ? (
    <Solid3DViewer spec={sol.solid} />
  ) : (
    // a blurred, still-turning preview: they can see what Pro gives them, but cannot use it
    <div style={{ position: "relative" }}>
      <div inert aria-hidden="true" style={{ filter: "blur(7px)", pointerEvents: "none" }}><Solid3DViewer spec={sol.solid} /></div>
      <div className="lock" role="region" aria-label="3D is a Pro feature">
        <div className="panel">
          <div className="eyebrow">Pro feature</div>
          <h3 className="prof-title" style={{ margin: "8px 0" }}>{loading ? "Checking your plan…" : failed ? "Couldn't check your plan" : "Unlock the 3D model"}</h3>
          {failed && <button type="button" className="btn btn-primary" onClick={() => void retry()}>Try again</button>}
          {!loading && !failed && (
            <>
              <p className="muted" style={{ fontSize: 13 }}>Rotate the solid and snap to its front, top and side views to see how the drawing connects to the real object.</p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
                <Link href="/pricing" className="btn btn-primary">See Pro plans</Link>
                {!me?.signedIn && me?.configured.auth && <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn">Sign in</Link>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <main className="page shell" key={slug}>
      <div className="player-head">
        <div>
          <div className="crumbs"><Link href="/lessons">Lessons</Link> / {category ?? (initial ? "Lesson" : "Your question")} / <span style={{ color: "var(--ink)" }}>{sol.title}</span></div>
          <h1>{sol.title}</h1>
          <p>{sol.problem}</p>
        </div>
        <Link href="/#solve" className="btn btn-acid">upload yours ↗</Link>
      </div>
      {!initial && unsaved && <p role="status" className="callout" style={{ marginBottom: 14 }}>Solved, but we couldn&apos;t save this lesson to your history. Take a screenshot if you want to keep it.</p>}
      <StepPlayer
        solution={sol}
        board={board3d}
        extra={
          <div className="seg" role="tablist" aria-label="View">
            <button role="tab" aria-selected={tab === "2d"} className={tab === "2d" ? "on" : ""} onClick={() => setTab("2d")}>2D</button>
            <button role="tab" aria-selected={tab === "3d"} className={tab === "3d" ? "on" : ""} onClick={() => setTab("3d")} disabled={!sol.solid} title={sol.solid ? "" : "No 3D model for this problem"}>3D</button>
          </div>
        }
      />
    </main>
  );
}
