import { pageTitle } from "@/lib/brand";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { supabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/http";

export const metadata = { title: pageTitle("Sign in"), robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="page shell">
      <Link href="/" className="back">← back home</Link>
      <h1>Sign in</h1>
      <p className="lede">Sign in to solve your own problems, unlock Pro, and keep your lessons. No password needed.</p>
      <LoginForm next={safeNext(sp.next)} configured={supabaseConfigured()} initialError={!!sp.error} />
    </main>
  );
}
