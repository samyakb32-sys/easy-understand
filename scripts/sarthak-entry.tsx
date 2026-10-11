/*!
 * Sarthak, the linewise mascot. The head is RobotHead from robot-heads 0.3.0
 * https://github.com/fayazara/robot-heads
 * MIT License, Copyright (c) 2026 Fayaz Ahmed. Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software, to deal in it without restriction, provided this notice is included. THE SOFTWARE IS PROVIDED "AS IS",
 * WITHOUT WARRANTY OF ANY KIND.
 */
import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
// built from a checkout of https://github.com/fayazara/robot-heads (0.3.0) placed at ../rh relative to this file:
// NODE_PATH=node_modules esbuild sarthak-entry.tsx --bundle --minify --format=iife --jsx=automatic --legal-comments=inline --define:process.env.NODE_ENV=\"production\" --outfile=public/sarthak.js
import { RobotHead } from "../rh/src/RobotHead";

const LINES = [
  "Every expert drew a wonky ellipse once. Keep going!",
  "One line at a time. That's literally the whole trick.",
  "Projections feel hard until they click. You're closer than you think.",
  "Construction lines first, panic never.",
  "Your future self will thank you for this practice.",
  "Small steps, sharp pencil, big results.",
  "Mistakes are just extra construction lines.",
  "You've got this. Even the true length was hidden at first.",
  "Five minutes of practice beats an hour of worrying.",
  "Tilt the solid, not your confidence.",
  "Every view you draw makes the next one easier.",
  "Breathe. Read the question. Draw the XY line. Go.",
  "Hard topics are just easy topics you haven't met yet.",
  "On exam day you'll be glad you did this today.",
  "Keep calm and project the corners.",
  "Don't erase your effort. Erase the extra lines.",
  "Rome wasn't drawn in one view either.",
  "Confused? Good. That's your brain building a new view.",
  "The best engineers check their hidden lines twice.",
  "Progress, not perfection. Then perfection.",
  "You don't need talent for EGD. You need reps.",
  "Every isometric starts with three simple lines.",
  "A clean drawing is just patience made visible.",
  "Stuck? Draw what you know first. The rest follows.",
  "Today's practice is tomorrow's full marks.",
  "Sections are easy: cut, project, connect. You've got it.",
  "Keep your pencil sharp and your doubts blunt.",
  "One more problem. Then a snack. Deal?",
  "You're not behind. You're mid-construction.",
  "Even a cone unrolls into something simple. So will this topic.",
];

/**
 * Says a different line every time: works through all of them in a shuffled order before any repeats, and
 * remembers its place across page loads, so a returning student does not hear the same opener again.
 */
const BAG_KEY = "lw-sarthak-bag";
function shuffled(avoidFirst: number): number[] {
  const a = LINES.map((_, i) => i);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if (a[0] === avoidFirst) [a[0], a[a.length - 1]] = [a[a.length - 1], a[0]];
  return a;
}
function nextLine(): string {
  let bag: number[] = [];
  let last = -1;
  try {
    const saved = JSON.parse(localStorage.getItem(BAG_KEY) || "null");
    if (saved && Array.isArray(saved.bag)) { bag = saved.bag.filter((i: unknown) => typeof i === "number" && i >= 0 && i < LINES.length); last = saved.last ?? -1; }
  } catch {}
  if (!bag.length) bag = shuffled(last);
  const i = bag.shift()!;
  try { localStorage.setItem(BAG_KEY, JSON.stringify({ bag, last: i })); } catch {}
  return LINES[i];
}

function Sarthak() {
  const [state, setState] = useState<"idle" | "happy" | "speaking">("idle");
  const [line, setLine] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const small = typeof matchMedia === "function" && matchMedia("(max-width: 680px)").matches;

  const talk = () => {
    setLine(nextLine());
    setState("speaking");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("happy"), 1800);
  };
  const hush = () => {
    window.clearTimeout(timer.current);
    setState("idle");
    timer.current = window.setTimeout(() => setLine(null), 150);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div
      className="sarthak"
      onMouseEnter={talk}
      onMouseLeave={hush}
      // phones have no hover: a tap says something new, and it hides by itself
      onClick={() => { if (small) { talk(); window.setTimeout(hush, 4000); } }}
    >
      <div className={`sarthak-bubble ${line ? "show" : ""}`} role="status" aria-live="polite">{line ?? ""}</div>
      <RobotHead shape="rectangle" state={state} size={small ? 76 : 104} color="#684bff" trimColor="#d5fa54" screenColor="#e8f2ff" aria-label="Sarthak, the linewise robot" />
      <span className="sarthak-name">Sarthak</span>
    </div>
  );
}

const mount = () => {
  const el = document.createElement("div");
  el.id = "sarthak-root";
  document.body.appendChild(el);
  createRoot(el).render(<Sarthak />);
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
