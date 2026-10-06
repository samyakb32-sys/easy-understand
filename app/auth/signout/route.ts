import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response("Bad origin", { status: 403 });
  await (await supabaseServer()).auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
