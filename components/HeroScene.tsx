"use client";

import dynamic from "next/dynamic";

// three.js is only loaded in the browser, after the page's text has painted
const Hero3D = dynamic(() => import("./Hero3D"), { ssr: false, loading: () => <div className="hero-fallback" aria-hidden="true" /> });

export function HeroScene() {
  return (
    <div className="hero-canvas">
      <Hero3D />
    </div>
  );
}

export function BurnIntro() {
  return (
    <>
      <div className="burn" aria-hidden="true" />
      <div className="burn-label" aria-hidden="true">Kindling</div>
    </>
  );
}
