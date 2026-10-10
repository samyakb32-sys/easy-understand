import Link from "next/link";
import { BurnIntro, HeroScene } from "@/components/HeroScene";
import { DemoPlayer } from "@/components/DemoPlayer";
import { NavAuth } from "@/components/NavAuth";
import { PricingCards } from "@/components/PricingCards";
import { UploadSolver } from "@/components/UploadSolver";
import { FREE_DAILY_SOLVES, PRO_DAILY_SOLVES } from "@/lib/pricing";

export default function Home() {
  return (
    <main>
      <BurnIntro />
      <header className="nav">
        <div className="wrap nav-in">
          <Link href="/" className="brand">EasyUnderstand<i lang="ja">製図</i></Link>
          <nav className="nav-links" aria-label="Sections">
            <a href="#how" className="hide-sm">How it works</a>
            <a href="#demo" className="hide-sm">Live lesson</a>
            <a href="#upload" className="hide-sm">Upload</a>
            <a href="#pricing" className="hide-sm">Pricing</a>
            <NavAuth />
          </nav>
        </div>
      </header>

      <section className="hero" id="top">
        <HeroScene />
        <div className="wrap">
          <div className="hero-copy">
            <div className="eyebrow">Engineering Graphics &amp; Design</div>
            <h1>Watch your EGD problem <em>draw itself.</em></h1>
            <p className="lede">
              Upload the problem. See it solved line by line, the way a professor draws it on the board, then turn the views into a 3D model you can rotate.
            </p>
            <div className="cta-row">
              <a href="#demo" className="btn btn-primary">Watch a live lesson</a>
              <a href="#upload" className="btn">Upload my problem</a>
            </div>
          </div>
        </div>
        <div className="jp-seal" lang="ja" aria-hidden="true">製図 · 投影</div>
        <div className="scroll-cue">Scroll</div>
      </section>

      <section className="block" id="how">
        <div className="wrap">
          <div className="eyebrow">How it works</div>
          <h2>From a photo to a lesson in three steps</h2>
          <div className="cards">
            <div className="card"><span className="n">01</span><h3>Upload</h3><p>Snap your question paper or type the problem. We read the numbers and the type of problem.</p></div>
            <div className="card"><span className="n">02</span><h3>Learn it step by step</h3><p>Construction lines first, then the final outline, with a short explanation for every step. Pause, go back, change the speed.</p></div>
            <div className="card"><span className="n">03</span><h3>See it in 3D</h3><p>Rotate the solid and snap to the front, top and side views to see how the 2D drawing connects to the real object.</p></div>
          </div>
        </div>
      </section>

      <section className="block" id="demo">
        <div className="wrap">
          <div className="eyebrow">Live lesson</div>
          <h2>Try it now. No sign-up.</h2>
          <p className="sec-lede">Pick a problem type and watch the drawing build. Use the arrow keys to move between steps.</p>
          <DemoPlayer />
        </div>
      </section>

      <section className="block" id="upload">
        <div className="wrap">
          <div className="eyebrow">Your problem</div>
          <h2>Bring your own question</h2>
          <p className="sec-lede">The AI reads which kind of problem it is and the given values. The drawing itself is calculated by exact geometry code, not guessed.</p>
          <UploadSolver />
        </div>
      </section>

      <section className="block" id="pricing">
        <div className="wrap">
          <div className="eyebrow">Pricing</div>
          <h2>Start free</h2>
          <p className="sec-lede">Free: every example lesson in 2D and {FREE_DAILY_SOLVES} AI solves a day. Pro adds the 3D model, saved lessons and up to {PRO_DAILY_SOLVES} AI solves a day.</p>
          <PricingCards />
        </div>
      </section>

      <footer className="site">
        <div className="wrap flex flex-wrap justify-between gap-3">
          <span>EasyUnderstand 製図 · Learn engineering graphics by watching it drawn.</span>
          <span className="flex gap-4">
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/privacy">Privacy</Link>
            <Link href="/legal/refunds">Refunds</Link>
            <Link href="/legal/contact">Contact</Link>
          </span>
        </div>
      </footer>
    </main>
  );
}
