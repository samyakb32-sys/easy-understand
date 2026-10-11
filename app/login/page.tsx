import { LoginForm } from "@/components/LoginForm";
import { pageTitle } from "@/lib/brand";
import { supabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/http";

export const metadata = { title: pageTitle("Sign in"), robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="app-shell">
      <main className="page">
        <section className="auth-card">
          <div className="auth-icon" aria-hidden="true">✦</div>
          <div className="eyebrow">YOUR STUDY SPACE</div>
          <h2>Welcome to linewise.</h2>
          <p>Sign in to solve your own questions, unlock Pro and keep your study history wherever you go. No password needed.</p>
          <LoginForm next={safeNext(sp.next)} configured={supabaseConfigured()} initialError={!!sp.error} />
        </section>
      </main>
    </div>
  );
}
