import { NextResponse } from "next/server";
import { safeNext } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

/** The sign-in link (or Google) lands here with a one-time code that we swap for a session cookie. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=1", url.origin));
}
