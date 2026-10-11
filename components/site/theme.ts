export const THEME_KEY = "lw-theme";

/** Runs before paint (inlined in <head>) so a dark-mode visitor never sees a light flash. Same storage as the original page. */
export const THEME_SCRIPT = `try{var t=JSON.parse(localStorage.getItem("${THEME_KEY}"));if(t==="dark"||(t==null&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export function setTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0e1019" : "#f7f6f1");
  try { localStorage.setItem(THEME_KEY, JSON.stringify(dark ? "dark" : "light")); } catch {}
  window.dispatchEvent(new Event("lw-theme"));
}
