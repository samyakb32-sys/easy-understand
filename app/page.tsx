import Link from "next/link";
import { HashRedirect } from "@/components/home/HashRedirect";
import { HomeDemo } from "@/components/home/HomeDemo";
import { SAMPLES } from "@/lib/samples";
import { lessonCount } from "@/lib/topics";

const DEMO = "square-prism-inclined";
const TOTAL = Object.keys(SAMPLES).length;

const cube = <svg viewBox="0 0 160 160" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m20 69 59-35 60 35-59 35-60-35Z" /><path d="M20 69v56l60 35 59-35V69M80 104v56" /><path d="m20 69 60 35 59-35" strokeDasharray="4 5" /></svg>;
const line = <svg viewBox="0 0 160 160" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M23 128 133 26M23 128h112" /><path d="M44 108 94 97" strokeDasharray="4 4" /><path d="M49 128a30 30 0 0 1 9-21" /></svg>;
const cylinder = <svg viewBox="0 0 160 160" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><ellipse cx="82" cy="39" rx="42" ry="16" /><path d="M40 39v67c0 22 84 22 84 0V39" /><ellipse cx="82" cy="106" rx="42" ry="16" /><path d="M40 39h84" strokeDasharray="4 5" /></svg>;
const cone = <svg viewBox="0 0 160 160" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m27 128 53-99 53 99H27Z" /><path d="M42 100h76" stroke="var(--coral)" strokeWidth="5" /><path d="M80 29v99" strokeDasharray="4 5" /></svg>;

const PROCESS = [
  ["⌁", "Snap the question", "Upload a photo, screenshot or handwritten problem."],
  ["◎", "We read the details", "Problem type, measurements and inclinations are identified, and you confirm them."],
  ["⌗", "Exact geometry builds it", "Coordinates are computed point by point."],
  ["✦", "You draw it with us", "Follow the construction and rotate the result in 3D."],
];

export default function Home() {
  return (
    <div className="app-shell">
      <HashRedirect />
      <main>
        <section className="hero">
          <div>
            <div className="eyebrow">ENGINEERING GRAPHICS, EXPLAINED</div>
            <h1>See every line.<br /><span className="pop">Then draw it.</span></h1>
            <p>Linewise turns an EGD question into a precise, step-by-step lesson. Learn the construction, turn the solid, and head into your exam calm.</p>
            <div className="hero-ctas">
              <Link className="primary" href="/solve">Solve a question <span>↗</span></Link>
              <Link className="ghost" href="/lessons">Explore free lessons</Link>
            </div>
            <div className="hero-note"><span className="check">✓</span> {TOTAL} guided lessons available without an account</div>
          </div>
          <div className="demo-wrap">
            <div className="demo-circle" />
            <HomeDemo solution={SAMPLES[DEMO]} slug={DEMO} label="LESSON_04 / SOLIDS" />
            <div className="sticker" aria-hidden="true">STEP BY STEP<br />NOT MAGIC</div>
          </div>
        </section>

        <section className="proof-strip">
          <div className="proof-item"><b>{TOTAL}</b>free sample lessons</div>
          <div className="proof-item"><b>3D</b>models you can rotate</div>
          <div className="proof-item"><b>100%</b>computed geometry</div>
          <div className="proof-item"><b>∞</b>why each line exists</div>
        </section>

        <section className="section">
          <div className="section-top">
            <div><div className="eyebrow">START WHERE YOU ARE</div><h2>Every tough topic,<br />made drawable.</h2></div>
            <p>Learn the method, not a screenshot of the answer. The same drafting conventions you need in class, made less intimidating.</p>
          </div>
          <div className="lesson-grid">
            <Link className="lesson-card featured" href="/lessons?topic=solids"><span className="card-meta">01 / SOLIDS · {lessonCount("solids")} LESSONS</span><h3>Prisms from every angle</h3><p className="muted">Tilt it, project it, rotate it. Every line has a purpose.</p><span className="topic-link">Open lessons ↗</span>{cube}</Link>
            <Link className="lesson-card tall" href="/lessons?topic=basics"><span className="card-meta">02 / LINES · {lessonCount("basics")}</span><h3>True length</h3><p>Find the actual angle.</p>{line}</Link>
            <Link className="lesson-card" href="/lessons?topic=isometric"><span className="card-meta">03 / ISOMETRIC · {lessonCount("isometric")}</span><h3>Look 3D on paper</h3><p>Circles, cylinders and more.</p>{cylinder}</Link>
            <Link className="lesson-card" href="/lessons?topic=sections"><span className="card-meta">04 / SECTIONS · {lessonCount("sections")}</span><h3>Slice the solid</h3><p>See the conic inside.</p>{cone}</Link>
          </div>
        </section>

        <section className="section how-grid">
          <div className="explain">
            <div className="eyebrow" style={{ color: "var(--lime)" }}>A RELIABLE WAY TO LEARN</div>
            <h2>AI reads it.<br />Geometry solves it.</h2>
            <p>Vision only identifies the question and dimensions. Exact coordinates come from deterministic geometry, so every line has a reason and a place.</p>
          </div>
          <div className="process">
            {PROCESS.map(([icon, title, body], i) => (
              <div className="process-row" key={title}><span className="process-icon" aria-hidden="true">{icon}</span><div><h4>{title}</h4><p>{body}</p></div><b>{String(i + 1).padStart(2, "0")}</b></div>
            ))}
          </div>
        </section>

        <section className="cta-box">
          <div><h2>Your next “ohhh” moment is one upload away.</h2><p>Try a free solve now, or open any sample lesson without an account.</p></div>
          <Link className="secondary" href="/solve">Scan a question ↗</Link>
        </section>
      </main>
    </div>
  );
}
