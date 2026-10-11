"use client";

import { useEffect, useState } from "react";

/** Whether the page is in dark mode, kept in step with every toggle on the page. */
export function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains("dark"));
    read();
    window.addEventListener("lw-theme", read);
    return () => window.removeEventListener("lw-theme", read);
  }, []);
  return dark;
}
