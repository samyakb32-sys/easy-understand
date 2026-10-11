"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { TOPICS, type TopicId } from "@/lib/topics";

export type LessonItem = { slug: string; title: string; category: string; topic: TopicId | null; steps: number; has3d: boolean };

/** Search and topic filters over the sample lessons; the thumbnails arrive already rendered on the server. */
export function LessonsBrowser({ items, thumbs }: { items: LessonItem[]; thumbs: Record<string, ReactNode> }) {
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [q, setQ] = useState("");
  // landing-page topic cards link here with ?topic=
  useEffect(() => {
    const want = new URLSearchParams(location.search).get("topic");
    if (want && TOPICS.some((t) => t.id === want)) setTopic(want as TopicId);
  }, []);
  const pickTopic = (t: TopicId | "all") => {
    setTopic(t);
    history.replaceState(null, "", t === "all" ? "/lessons" : `/lessons?topic=${t}`);
  };
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = items.filter((l) => (topic === "all" || l.topic === topic) && words.every((w) => `${l.title} ${l.category}`.toLowerCase().includes(w)));

  return (
    <>
      <div style={{ display: "grid", gap: 14 }}>
        <input className="input search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder='Search: "cone section", "isometric"…' aria-label="Search lessons" />
        <div className="chips" role="tablist" aria-label="Topics">
          <button role="tab" aria-selected={topic === "all"} className={`chip ${topic === "all" ? "on" : ""}`} onClick={() => pickTopic("all")}>All</button>
          {TOPICS.map((t) => (
            <button key={t.id} role="tab" aria-selected={topic === t.id} className={`chip ${topic === t.id ? "on" : ""}`} onClick={() => pickTopic(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>
      <p className="muted mono" style={{ fontSize: 11, margin: "16px 0 0" }} role="status">{shown.length} lesson{shown.length === 1 ? "" : "s"}</p>
      {shown.length ? (
        <div className="lessons-grid">
          {shown.map((l) => (
            <Link key={l.slug} href={`/solve/${l.slug}`} className="lesson-tile">
              <div className="thumb">{thumbs[l.slug]}</div>
              <div className="meta">
                <span className="count">{l.category.toUpperCase()}</span>
                <h3>{l.title}</h3>
                <span className="count mono">{l.steps} steps{l.has3d ? " · 3D" : ""}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="callout info" style={{ marginTop: 18 }}>No lesson matches that yet. <Link href="/#solve" className="underline">Upload your question</Link> and we&apos;ll solve it for you.</p>
      )}
    </>
  );
}
