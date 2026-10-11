"use client";

import { useEffect, useRef, useState } from "react";
import { RobotHead } from "robot-heads";

// Sarthak, the linewise mascot. The head is RobotHead from robot-heads (MIT, © Fayaz Ahmed): https://github.com/fayazara/robot-heads
export const SARTHAK_LINES = [
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

const BAG_KEY = "lw-sarthak-bag";

/** A fresh shuffled order of all lines, never starting with the one just said. */
export function shuffledOrder(n: number, avoidFirst: number, rand = Math.random): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if (n > 1 && a[0] === avoidFirst) [a[0], a[n - 1]] = [a[n - 1], a[0]];
  return a;
}

/** Deals every line once, in a shuffled order, before any repeats; remembers its place across page loads. */
function nextLine(): string {
  let bag: number[] = [];
  let last = -1;
  try {
    const saved = JSON.parse(localStorage.getItem(BAG_KEY) || "null");
    if (saved && Array.isArray(saved.bag)) {
      bag = saved.bag.filter((i: unknown) => typeof i === "number" && i >= 0 && i < SARTHAK_LINES.length);
      last = typeof saved.last === "number" ? saved.last : -1;
    }
  } catch {}
  if (!bag.length) bag = shuffledOrder(SARTHAK_LINES.length, last);
  const i = bag.shift()!;
  try { localStorage.setItem(BAG_KEY, JSON.stringify({ bag, last: i })); } catch {}
  return SARTHAK_LINES[i];
}

export function Sarthak() {
  const [state, setState] = useState<"idle" | "happy" | "speaking">("idle");
  const [line, setLine] = useState<string | null>(null);
  const [small, setSmall] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const mq = matchMedia("(max-width: 680px)");
    const set = () => setSmall(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => { mq.removeEventListener("change", set); window.clearTimeout(timer.current); };
  }, []);

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

  return (
    <div id="sarthak-root">
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
    </div>
  );
}
