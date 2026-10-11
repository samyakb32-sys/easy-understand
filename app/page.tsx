import Link from "next/link";
import { HeroLessonCard } from "@/components/HeroLessonCard";
import { UploadSolver } from "@/components/UploadSolver";
import { SAMPLES } from "@/lib/samples";
import { TOPICS, lessonCount, type TopicId } from "@/lib/topics";

const HERO = "prism-hp-vp";
const TOTAL = Object.keys(SAMPLES).length;
const TICKER = "YOU BRING THE QUESTION ✦ WE MAKE IT MAKE SENSE ✦ LINES · PLANES · SOLIDS · ISOMETRICS · SECTIONS ✦ ";

const SHAPES: Record<TopicId, { cls: string; big?: boolean; svg: React.ReactNode }> = {
  basics: { cls: "", big: true, svg: <><path d="M13 132 110 21l63 111H13Z" /><path d="M110 21v111M13 132h160" /><path d="M44 96h97" strokeDasharray="5 5" /></> },
  solids: { cls: "c-acid", svg: <><path d="m18 37 32-19 32 19-32 19-32-19Z" /><path d="M18 37v34l32 19 32-19V37M50 56v34" /></> },
  isometric: { cls: "c-hot", svg: <><ellipse cx="50" cy="27" rx="29" ry="12" /><path d="M21 27v42c0 16 58 16 58 0V27" /><ellipse cx="50" cy="69" rx="29" ry="12" /></> },
  sections: { cls: "", svg: <><path d="M22 78 48 17l29 61Z" /><path d="m27 61 55-20" stroke="var(--hot)" strokeWidth="5" /></> },
  development: { cls: "c-acid", big: true, svg: <><path d="M21 125 85 26l82 99H21Z" /><path d="M85 26v99M21 125l64-33 82 33" /><path d="M38 99 133 99M55 73h61" strokeDasharray="5 5" /></> },
  interpenetration: { cls: "c-hot", svg: <><ellipse cx="36" cy="50" rx="15" ry="31" /><ellipse cx="64" cy="50" rx="15" ry="31" /><path d="M36 19c15 7 14 55 28 62M36 81c15-7 14-55 28-62" stroke="var(--hot)" strokeWidth="3" /></> },
};
const BLURB: Record<TopicId, [string, string]> = {
  basics: ["01 / THE BASICS", "Find true lengths, true shapes and every inclination without crossing your fingers."],
  solids: ["02 / TURN IT", "Prisms, pyramids and tilted things."],
  isometric: ["03 / LOOKS 3D", "Make flat paper feel like an object you can pick up."],
  sections: ["04 / SLICE IT", "Cut through a solid and reveal the shape hiding inside."],
  development: ["05 / UNFOLD IT", "Turn a 3D object into an exact flat pattern. Very satisfying."],
  interpenetration: ["06 / COLLIDE", "Where two solids meet. Zero guesswork."],
};

const FLOW = [
  ["⌁", "drop the question", "Photograph it, screenshot it, upload it. Whatever’s on your phone."],
  ["◎", "we clock the details", "Topic, dimensions, angles. You check what we read before we draw."],
  ["⌗", "math does its thing", "Deterministic geometry plots the answer point for point."],
  ["✦", "you draw it with us", "One line at a time. With the why, the how and a 3D view."],
];

export default function Home() {
  return (
    <main className="landing">
      <div className="shell">
        <section className="hero">
          <div>
            <div className="kicker"><b />A calmer way to learn EGD</div>
            <h1>See every line.<br /><span className="scribble">Then draw it.</span></h1>
            <p className="intro">Upload an EGD question. Get an exact construction, a reason for every line, and a solid you can turn in 3D.</p>
            <div className="hero-actions">
              <Link className="button" href="#solve">solve my first problem <span>↗</span></Link>
              <Link className="textlink" href="/lessons">peek the lessons</Link>
            </div>
            <div className="proof">{TOTAL} guided lessons · exact geometry · made for your phone</div>
          </div>
          <div className="hero-visual">
            <div className="halo" />
            <HeroLessonCard solution={SAMPLES[HERO]} label="LESSON_04 / SOLIDS" />
            <div className="sticker" aria-hidden="true">STEP BY STEP<br />NOT MAGIC</div>
          </div>
        </section>
      </div>

      <div className="ticker" aria-hidden="true"><div>{TICKER.repeat(4)}</div></div>

      <div className="shell">
        <section className="section" id="topics">
          <div className="sectiontop">
            <div>
              <div className="eyebrow">Pick your boss level</div>
              <h2>All the tricky bits.<br />Finally un-tricky.</h2>
            </div>
            <p>Every lesson plays out line by line, then lets you turn the solid around until your brain gets it.</p>
          </div>
          <div className="topics">
            {TOPICS.map((t) => {
              const s = SHAPES[t.id];
              return (
                <Link key={t.id} href={`/lessons?topic=${t.id}`} className={`topic ${s.cls}`}>
                  <span className="count">{BLURB[t.id][0]} · {lessonCount(t.id)} lessons</span>
                  <h3>{t.label}</h3>
                  <p>{BLURB[t.id][1]}</p>
                  <svg className={s.big ? "bigshape" : "tinyshape"} viewBox={s.big ? "0 0 190 160" : "0 0 100 100"} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{s.svg}</svg>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="section route" id="how">
          <div className="bigcopy">
            <div className="eyebrow" style={{ color: "var(--acid)" }}>The no-panic method</div>
            <h2>Your drawing buddy has a plan.</h2>
            <p>We use AI to read the question, then precise geometry code to make every construction exact. So the answer is reliable, and the explanation actually lands.</p>
          </div>
          <div className="flow">
            {FLOW.map(([icon, title, body], i) => (
              <div className="flowrow" key={title}>
                <span className="flowicon" aria-hidden="true">{icon}</span>
                <div><h4>{title}</h4><p>{body}</p></div>
                <b>{String(i + 1).padStart(2, "0")}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="lab" id="solve">
          <div className="solvebox">
            <div>
              <h2>Bring the question.<br />We’ll make it click.</h2>
              <p className="sub">Get a free guided solve in under a minute. No credit card, no vague answers.</p>
            </div>
            <UploadSolver />
          </div>
        </section>
      </div>

      <nav className="mobilebar" aria-label="Quick actions">
        <a className="scan" href="#solve">scan question ↗</a>
        <Link className="samples" href="/lessons">samples</Link>
      </nav>
    </main>
  );
}
