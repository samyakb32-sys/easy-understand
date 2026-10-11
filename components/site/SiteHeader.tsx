import Link from "next/link";
import { NavAuth } from "../NavAuth";
import { Brand } from "./Brand";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <div className="shell">
      <header className="top">
        <Brand />
        <nav className="nav" aria-label="Main">
          <Link href="/#topics">Topics</Link>
          <Link href="/#how">How it works</Link>
          <Link href="/lessons">Lessons</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>
        <div className="right">
          <ThemeToggle />
          <NavAuth />
          <Link className="navbtn" href="/#solve">solve a problem ↗</Link>
        </div>
      </header>
    </div>
  );
}
