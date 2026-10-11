import { LessonsBrowser, type LessonItem } from "@/components/LessonsBrowser";
import { StaticDrawing } from "@/components/StaticDrawing";
import { pageTitle } from "@/lib/brand";
import { SAMPLES, SAMPLE_CATEGORIES } from "@/lib/samples";
import { topicOf } from "@/lib/topics";

export const metadata = { title: pageTitle("Lessons"), description: "Every sample EGD lesson, drawn line by line: projections, solids, isometric views, sections, developments and interpenetration." };

export default function LessonsPage() {
  const items: LessonItem[] = Object.entries(SAMPLES).map(([slug, s]) => ({
    slug, title: s.title, category: SAMPLE_CATEGORIES[slug], topic: topicOf(slug), steps: s.steps.length, has3d: !!s.solid,
  }));
  const thumbs = Object.fromEntries(Object.entries(SAMPLES).map(([slug, s]) => [slug, <StaticDrawing key={slug} solution={s} />]));
  return (
    <main className="page shell">
      <div className="eyebrow">Lessons</div>
      <h1>Pick a problem.<br />Watch it drawn.</h1>
      <p className="lede">{items.length} guided lessons. Each one plays out line by line, with a reason for every step.</p>
      <LessonsBrowser items={items} thumbs={thumbs} />
    </main>
  );
}
