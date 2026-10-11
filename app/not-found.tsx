import { pageTitle } from "@/lib/brand";
import Link from "next/link";

export const metadata = { title: pageTitle("Page not found") };

export default function NotFound() {
  return (
    <main className="page shell">
      <h1>We couldn&apos;t find that page</h1>
      <p className="lede">The link may be old or mistyped.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Link href="/" className="btn btn-primary">Back to home</Link>
        <Link href="/#solve" className="btn">Upload a problem</Link>
      </div>
    </main>
  );
}
