"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Solution } from "@/lib/schema";
import { StepPlayer } from "./StepPlayer";
import { useEntitlements } from "./useEntitlements";

// three.js is a large download: fetch it only when the 3D tab is opened
const Solid3DViewer = dynamic(() => import("./Solid3DViewer").then((m) => m.Solid3DViewer), { ssr: false, loading: () => <div className="muted p-6">Loading the 3D model…</div> });

export function SolveWorkspace({ initial, slug }: { initial: Solution | null; slug: string }) {
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
      <div className="lesson wrap">
        <p className="muted">{loaded ? "We couldn't find that lesson." : "Loading…"}</p>
        <Link href="/#upload" className="btn mt-4">Upload a problem</Link>
      </div>
    );
  }
  return (
    <div className="lesson wrap" key={slug}>
      <Link href="/" className="muted text-sm no-underline">← Back</Link>
      <h1>{sol.title}</h1>
      <p className="muted max-w-3xl">{sol.problem}</p>
      {!initial && unsaved && <p role="status" className="callout">Solved, but we couldn't save this lesson to your history. Take a screenshot if you want to keep it.</p>}
      <div className="givens">
        {sol.givens.map((g) => (
          <span key={g.name} className="given">{g.name}<b>{g.value}</b></span>
        ))}
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "2d"} className={`tab ${tab === "2d" ? "on" : ""}`} onClick={() => setTab("2d")}>Steps (2D)</button>
        <button role="tab" aria-selected={tab === "3d"} className={`tab ${tab === "3d" ? "on" : ""}`} onClick={() => setTab("3d")} disabled={!sol.solid} title={sol.solid ? "" : "No 3D model for this problem"}>
          3D model{sol.solid ? "" : " (n/a)"}
        </button>
      </div>
      {tab === "2d" || !sol.solid ? (
        <StepPlayer solution={sol} />
      ) : unlocked ? (
        <Solid3DViewer spec={sol.solid} />
      ) : (
        // a blurred, still-turning preview: they can see what Pro gives them, but cannot use it
        <div className="relative">
          <div inert aria-hidden="true" style={{ filter: "blur(7px)", pointerEvents: "none" }}><Solid3DViewer spec={sol.solid} /></div>
          <div className="lock-overlay" role="region" aria-label="3D is a Pro feature">
            <div className="lock-card">
              <div className="eyebrow">Pro feature</div>
              <h3 className="prof-title">{loading ? "Checking your plan…" : failed ? "Couldn't check your plan" : "Unlock the 3D model"}</h3>
              {failed && (
                <div className="mt-3 flex justify-center"><button type="button" className="btn btn-primary" onClick={() => void retry()}>Try again</button></div>
              )}
              {!loading && !failed && (
                <>
                  <p className="muted">Rotate the solid and snap to its front, top and side views to see how the drawing connects to the real object.</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Link href="/#pricing" className="btn btn-primary">See Pro plans</Link>
                    {!me?.signedIn && me?.configured.auth && <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn">Sign in</Link>}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
