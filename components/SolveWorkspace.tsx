"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Solution } from "@/lib/schema";
import { Solid3DViewer } from "./Solid3DViewer";
import { StepPlayer } from "./StepPlayer";

export function SolveWorkspace({ initial, slug }: { initial: Solution | null; slug: string }) {
  const [sol, setSol] = useState<Solution | null>(initial);
  const [loaded, setLoaded] = useState(!!initial);
  const [tab, setTab] = useState<"2d" | "3d">("2d");

  // a lesson made from an upload is passed through sessionStorage
  useEffect(() => {
    if (initial) return;
    try {
      const raw = sessionStorage.getItem("eu:custom");
      const parsed = raw ? Solution.safeParse(JSON.parse(raw)) : null;
      if (parsed?.success) setSol(parsed.data);
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
      {tab === "2d" || !sol.solid ? <StepPlayer solution={sol} /> : <Solid3DViewer spec={sol.solid} />}
    </div>
  );
}
