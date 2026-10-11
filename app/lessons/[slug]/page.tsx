import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonWorkspace } from "@/components/LessonWorkspace";
import { pageTitle } from "@/lib/brand";
import { SAMPLES, getSample } from "@/lib/samples";
import { TOPICS, topicOf } from "@/lib/topics";

export function generateStaticParams() {
  return Object.keys(SAMPLES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = getSample(slug);
  if (!s) return { title: pageTitle("Your lesson"), robots: { index: false } };
  return { title: pageTitle(s.title), description: s.problem, openGraph: { title: s.title, description: s.problem } };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // "custom" is a lesson made from an upload, held in the browser; any other unknown slug is a real 404
  const initial = getSample(slug);
  if (slug !== "custom" && !initial) notFound();
  const topic = TOPICS.find((t) => t.id === topicOf(slug))?.label;
  return <LessonWorkspace initial={initial} slug={slug} topic={topic} />;
}
