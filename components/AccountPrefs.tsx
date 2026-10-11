"use client";

import { setTheme } from "./site/theme";
import { useDark } from "./site/useDark";

/** Account → Study preferences: the theme switch, saved in this browser. */
export function AccountPrefs() {
  const dark = useDark();
  return (
    <div className="setting">
      <span>Dark study mode</span>
      <button className={`switch ${dark ? "on" : ""}`} role="switch" aria-checked={dark} aria-label="Dark study mode" onClick={() => setTheme(!dark)} />
    </div>
  );
}
