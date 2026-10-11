"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useEntitlements } from "../useEntitlements";
import { Brand } from "./Brand";
import { setTheme } from "./theme";
import { useDark } from "./useDark";

const NAV = [
  { href: "/lessons", label: "Lessons" },
  { href: "/solve", label: "Solve a problem" },
  { href: "/pricing", label: "Pricing" },
];

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

export function SiteHeader() {
  const path = usePathname() ?? "/";
  const dark = useDark();
  const { me, loading } = useEntitlements();
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [path]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  const account = me?.signedIn ? (
    <Link className="avatar" href="/account" title="Account" aria-label="Your account">{(me.email ?? "?").slice(0, 1).toUpperCase()}</Link>
  ) : me?.configured.auth ? (
    <Link className="ghost" href="/login">Sign in</Link>
  ) : null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => <Link key={n.href} href={n.href} className={isActive(path, n.href) ? "active" : ""} aria-current={isActive(path, n.href) ? "page" : undefined}>{n.label}</Link>)}
        </nav>
        <div className="top-actions">
          <button className="theme-btn" onClick={() => setTheme(!dark)} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>{dark ? "☀" : "☾"}</button>
          {loading ? <span style={{ width: 34 }} aria-hidden="true" /> : account}
          <Link className="primary" href="/solve">Scan question ↗</Link>
          <button className="round-btn menu-toggle" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu}>☰</button>
        </div>
      </header>
      {menu && (
        <div className="menu-sheet" onClick={(e) => e.target === e.currentTarget && setMenu(false)}>
          <nav className="menu-panel" aria-label="Menu">
            <div className="menu-head"><Brand /><button className="round-btn" onClick={() => setMenu(false)} aria-label="Close menu">✕</button></div>
            <Link href="/" className={path === "/" ? "active" : ""}>Home</Link>
            {NAV.map((n) => <Link key={n.href} href={n.href} className={isActive(path, n.href) ? "active" : ""}>{n.label}</Link>)}
            {me?.signedIn && <Link href="/history" className={isActive(path, "/history") ? "active" : ""}>My lessons</Link>}
            {me?.signedIn ? <Link href="/account" className={isActive(path, "/account") ? "active" : ""}>Account</Link> : me?.configured.auth && <Link href="/login">Sign in</Link>}
            <Link href="/legal/contact">Contact</Link>
          </nav>
        </div>
      )}
    </div>
  );
}

export function SiteFooter() {
  const path = usePathname() ?? "/";
  // the lesson workspace is a full-height app view: no marketing footer or quick bar there
  const workspace = path.startsWith("/lessons/") || path.startsWith("/history/");
  return (
    <>
      {!workspace && (
        <div className="app-shell">
          <footer className="footer">
            <Brand />
            <span>Exact geometry. Clear reasoning.</span>
            <nav className="footer-links" aria-label="Footer">
              <Link href="/legal/privacy">Privacy</Link>
              <Link href="/legal/terms">Terms</Link>
              <Link href="/legal/refunds">Refunds</Link>
              <Link href="/legal/contact">Contact</Link>
            </nav>
          </footer>
        </div>
      )}
      {!workspace && path !== "/solve" && (
        <nav className="mobile-action" aria-label="Quick actions">
          <Link className="scan" href="/solve">scan question ↗</Link>
          <Link className="samples" href="/lessons">samples</Link>
        </nav>
      )}
    </>
  );
}
