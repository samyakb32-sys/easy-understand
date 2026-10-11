"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { TOPICS, type TopicId } from "@/lib/topics";

export type LessonItem = { slug: string; title: string; problem: string; topic: TopicId | null; steps: number; has3d: boolean };

/** Topic filters and search over the sample lessons; thumbnails arrive already rendered on the server. */
export function LessonLibrary({ items, thumbs }: { items: LessonItem[]; thumbs: Record<string, ReactNode> }) {
  const [topic, setTopic] = useState<TopicId | "all">("all");
  const [q, setQ] = useState("");
  // home-page topic cards link here with ?topic=
  useEffect(() => {
    const want = new URLSearchParams(location.search).get("topic");
    if (want && TOPICS.some((t) => t.id === want)) setTopic(want as TopicId);
  }, []);
  const pick = (t: TopicId | "all") => {
    setTopic(t);
    history.replaceState(null, "", t === "all" ? "/lessons" : `/lessons?topic=${t}`);
  };
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = items.filter((l) => (topic === "all" || l.topic === topic) && words.every((w) => `${l.title} ${l.problem}`.toLowerCase().includes(w)));
  const label = (id: TopicId | null) => TOPICS.find((t) => t.id === id)?.label ?? "Lesson";

  return (
    <>
      <div className="library-tools">
        <input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder='Search: "cone section", "isometric"…' aria-label="Search lessons" />
      </div>
      <div className="filters" role="tablist" aria-label="Topics">
        <button role="tab" aria-selected={topic === "all"} className={`filter ${topic === "all" ? "active" : ""}`} onClick={() => pick("all")}>All</button>
        {TOPICS.map((t) => <button key={t.id} role="tab" aria-selected={topic === t.id} className={`filter ${topic === t.id ? "active" : ""}`} onClick={() => pick(t.id)}>{t.label}</button>)}
      </div>
      <p className="count-note" role="status">{shown.length} lesson{shown.length === 1 ? "" : "s"}</p>
      {shown.length ? (
        <section className="library-grid">
          {shown.map((l) => (
            <Link key={l.slug} href={`/lessons/${l.slug}`} className="library-card">
              <span className="card-meta">{label(l.topic).toUpperCase()} · {l.steps} STEPS{l.has3d ? " · 3D" : ""}</span>
              <div className="shape">{thumbs[l.slug]}</div>
              <h3>{l.title}</h3>
              <p>{l.problem.length > 110 ? l.problem.slice(0, 108).trimEnd() + "…" : l.problem}</p>
            </Link>
          ))}
        </section>
      ) : (
        <p className="callout info">No lesson matches that yet. <Link href="/solve">Upload your question</Link> and we’ll solve it for you.</p>
      )}
    </>
  );
}
