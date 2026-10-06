import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "../env";

/** Supabase client acting as the signed-in student (row level security applies). */
export async function supabaseServer() {
  const jar = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // called from a Server Component, which cannot set cookies: proxy.ts refreshes the session instead
        }
      },
    },
  });
}

/** The verified user, or null. Always asks the auth server rather than trusting the cookie. */
export async function currentUser() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}
