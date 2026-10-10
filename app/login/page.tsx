import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { supabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/http";

export const metadata = { title: "Sign in · EasyUnderstand 製図", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="lesson wrap">
      <Link href="/" className="muted text-sm no-underline">← Back</Link>
      <h1>Sign in</h1>
      <p className="muted mb-6 max-w-xl">Sign in to solve your own problems, unlock Pro, and keep your lessons. No password needed.</p>
      <LoginForm next={safeNext(sp.next)} configured={supabaseConfigured()} initialError={!!sp.error} />
    </main>
  );
}
