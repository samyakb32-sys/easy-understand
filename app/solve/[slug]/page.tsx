import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SolveWorkspace } from "@/components/SolveWorkspace";
import { SAMPLES } from "@/lib/samples";

export function generateStaticParams() {
  return Object.keys(SAMPLES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const title = SAMPLES[slug]?.title;
  return { title: title ? `${title} · EasyUnderstand 製図` : "Your lesson · EasyUnderstand 製図" };
}

export default async function SolvePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // "custom" is a lesson made from an upload, held in the browser; any other unknown slug is a real 404
  if (slug !== "custom" && !SAMPLES[slug]) notFound();
  return <SolveWorkspace initial={SAMPLES[slug] ?? null} slug={slug} />;
}
