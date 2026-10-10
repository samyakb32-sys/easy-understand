import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseConfigured, supabaseUrl } from "./lib/env";
import { AUTH_TIMEOUT_MS, withTimeout } from "./lib/supabase/timeout";

/** Keeps the student's login fresh: refreshes the session cookie before pages and API routes read it. */
export async function proxy(request: NextRequest) {
  if (!supabaseConfigured()) return NextResponse.next();
  try {
    let response = NextResponse.next({ request });
    const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    // an expired cookie makes the SDK retry a slow or unreachable Supabase for ~25 s: give up quickly and let the page load
    await withTimeout(supabase.auth.getClaims(), AUTH_TIMEOUT_MS, null);
    return response;
  } catch (e) {
    // a Supabase problem must not take the whole site down, including the keyless example lessons
    console.error("proxy: could not refresh the session", e);
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/razorpay/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
