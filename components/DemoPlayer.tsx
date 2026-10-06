"use client";

import Link from "next/link";
import { useState } from "react";
import { SAMPLES, SAMPLE_CATEGORIES } from "@/lib/samples";
import { StepPlayer } from "./StepPlayer";

export function DemoPlayer() {
  const keys = Object.keys(SAMPLES);
  const [key, setKey] = useState(keys[0]);
  return (
    <div>
      <div className="chips" role="tablist" aria-label="Example lessons">
        {keys.map((k) => (
          <button key={k} role="tab" aria-selected={k === key} className={`chip ${k === key ? "on" : ""}`} onClick={() => setKey(k)}>
            {SAMPLES[k].title}
            <span className="sr-only"> ({SAMPLE_CATEGORIES[k]})</span>
          </button>
        ))}
      </div>
      <StepPlayer solution={SAMPLES[key]} compact />
      <p className="muted mt-4 text-sm">
        {SAMPLES[key].problem}{" "}
        <Link href={`/solve/${key}`} className="underline decoration-[var(--amber)] underline-offset-4">Open the full lesson{SAMPLES[key].solid ? " with 3D" : ""} →</Link>
      </p>
    </div>
  );
}
