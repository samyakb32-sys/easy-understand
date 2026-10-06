import { SolveWorkspace } from "@/components/SolveWorkspace";
import { SAMPLES } from "@/lib/samples";

export function generateStaticParams() {
  return Object.keys(SAMPLES).map((slug) => ({ slug }));
}

export default async function SolvePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <SolveWorkspace initial={SAMPLES[slug] ?? null} slug={slug} />;
}
