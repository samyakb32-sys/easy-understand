import { LessonLibrary, type LessonItem } from "@/components/LessonLibrary";
import { StaticDrawing } from "@/components/StaticDrawing";
import { pageTitle } from "@/lib/brand";
import { SAMPLES } from "@/lib/samples";
import { topicOf } from "@/lib/topics";

export const metadata = { title: pageTitle("Lessons"), description: "Every sample EGD lesson, drawn line by line: projections, solids, isometric views, sections, developments and interpenetration." };

export default function LessonsPage() {
  const items: LessonItem[] = Object.entries(SAMPLES).map(([slug, s]) => ({ slug, title: s.title, problem: s.problem, topic: topicOf(slug), steps: s.steps.length, has3d: !!s.solid }));
  const thumbs = Object.fromEntries(Object.entries(SAMPLES).map(([slug, s]) => [slug, <StaticDrawing key={slug} solution={s} />]));
  return (
    <div className="app-shell">
      <main className="page">
        <div className="screen-heading">
          <div className="eyebrow">THE PRACTICE LIBRARY</div>
          <h1>Pick a problem.<br />Get unstuck.</h1>
          <p>{items.length} free sample lessons. Each one shows the construction step by step, explains the choices, and includes a rotatable solid where it helps.</p>
        </div>
        <LessonLibrary items={items} thumbs={thumbs} />
      </main>
    </div>
  );
}
