import Link from "next/link";

export const metadata = { title: "Page not found · EasyUnderstand 製図" };

export default function NotFound() {
  return (
    <main className="lesson wrap">
      <h1>We couldn&apos;t find that page</h1>
      <p className="muted mt-2">The link may be old or mistyped.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/" className="btn btn-primary">Back to home</Link>
        <Link href="/#upload" className="btn">Upload a problem</Link>
      </div>
    </main>
  );
}
