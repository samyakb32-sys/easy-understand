import { notFound, redirect } from "next/navigation";
import { SolveWorkspace } from "@/components/SolveWorkspace";
import { supabaseConfigured } from "@/lib/env";
import { Solution } from "@/lib/schema";
import { currentUser, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SavedLesson({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!supabaseConfigured()) notFound();
  const user = await currentUser();
  if (!user) redirect("/login?next=" + encodeURIComponent(`/history/${id}`));
  // row level security means this only ever returns the student's own lesson
  const { data } = await (await supabaseServer()).from("lessons").select("solution").eq("id", id).maybeSingle();
  const parsed = Solution.safeParse(data?.solution);
  if (!parsed.success) notFound();
  return <SolveWorkspace initial={parsed.data} slug={`saved-${id}`} />;
}
