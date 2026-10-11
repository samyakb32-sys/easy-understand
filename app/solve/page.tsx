import Link from "next/link";
import { UploadSolver } from "@/components/UploadSolver";
import { pageTitle } from "@/lib/brand";
import { SAMPLES } from "@/lib/samples";
import { TOPICS } from "@/lib/topics";

export const metadata = { title: pageTitle("Solve a question"), description: "Upload an EGD question and get an exact, step-by-step lesson with a 3D model." };

export default function SolvePage() {
  return (
    <div className="app-shell">
      <main className="page">
        <div className="screen-heading">
          <div className="eyebrow">YOUR DRAWING DESK</div>
          <h1>Let’s solve this.</h1>
          <p>Drop in the question. We’ll identify the EGD problem, show you what we read so you can fix any misread, turn it into precise geometry, and walk through every construction line.</p>
        </div>
        <section className="app-layout">
          <UploadSolver />
          <aside className="side-stack">
            <div className="panel small-panel">
              <h3>What we can teach</h3>
              <div className="topic-pills">{TOPICS.map((t) => <span key={t.id}>{t.label}</span>)}</div>
            </div>
            <div className="panel small-panel accuracy">
              <div className="eyebrow" style={{ color: "var(--lime)" }}>NO GEOMETRY GUESSING</div>
              <strong>Exact by construction.</strong>
              <p>AI reads the question; deterministic code computes the points and views.</p>
            </div>
            <div className="panel small-panel">
              <h3>Want to see it first?</h3>
              <p>Try any of the {Object.keys(SAMPLES).length} guided sample lessons without signing in.</p>
              <Link className="ghost" style={{ marginTop: 14 }} href="/lessons">Browse samples →</Link>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
