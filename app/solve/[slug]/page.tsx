import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SolveWorkspace } from "@/components/SolveWorkspace";
import { SAMPLES, getSample } from "@/lib/samples";

export function generateStaticParams() {
  return Object.keys(SAMPLES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const title = getSample(slug)?.title;
  return { title: title ? `${title} · EasyUnderstand 製図` : "Your lesson · EasyUnderstand 製図" };
}

export default async function SolvePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // "custom" is a lesson made from an upload, held in the browser; any other unknown slug is a real 404
  const initial = getSample(slug);
  if (slug !== "custom" && !initial) notFound();
  return <SolveWorkspace initial={initial} slug={slug} />;
}
