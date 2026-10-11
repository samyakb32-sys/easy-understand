"use client";

import { useEffect, useState } from "react";

export const THEME_KEY = "lw-theme";

/** Runs before paint (inlined in <head>) so a dark-mode visitor never sees a light flash. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="night"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("night")}catch(e){}`;

export function ThemeToggle() {
  const [night, setNight] = useState(false);
  useEffect(() => setNight(document.documentElement.classList.contains("night")), []);
  const flip = () => {
    const next = !night;
    document.documentElement.classList.toggle("night", next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next ? "#10111b" : "#fbf6ee");
    try { localStorage.setItem(THEME_KEY, next ? "night" : "day"); } catch {}
    setNight(next);
  };
  return (
    <button className="mood" onClick={flip} aria-label={night ? "Switch to light theme" : "Switch to dark theme"} aria-pressed={night}>
      {night ? "☀" : "☾"}
    </button>
  );
}
