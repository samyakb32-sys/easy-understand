import Link from "next/link";
import { Brand } from "./Brand";

export function SiteFooter() {
  return (
    <div className="shell">
      <footer className="footer">
        <Brand />
        <span>Made for last-minute legends.</span>
        <nav className="footlinks" aria-label="Footer">
          <Link href="/lessons">Lessons</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/refunds">Refunds</Link>
          <Link href="/legal/contact">Say hi</Link>
        </nav>
      </footer>
    </div>
  );
}
