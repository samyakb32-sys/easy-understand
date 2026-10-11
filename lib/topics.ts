import { SAMPLE_CATEGORIES } from "./samples";

/** The six landing-page topics, and which sample categories each one gathers on /lessons. */
export const TOPICS = [
  { id: "basics", label: "Lines & planes", categories: ["Orthographic projection", "Projection of planes", "Geometric construction"] },
  { id: "solids", label: "Solids", categories: ["Projection of solids", "Views & 3D from 2D"] },
  { id: "isometric", label: "Isometric", categories: ["Isometric view"] },
  { id: "sections", label: "Sections & conics", categories: ["Sections of solids", "Engineering curves"] },
  { id: "development", label: "Surface development", categories: ["Development of surfaces"] },
  { id: "interpenetration", label: "Interpenetration", categories: ["Interpenetration of solids"] },
] as const;

export type TopicId = (typeof TOPICS)[number]["id"];

export function topicOf(slug: string): TopicId | null {
  const cat = SAMPLE_CATEGORIES[slug];
  return TOPICS.find((t) => (t.categories as readonly string[]).includes(cat))?.id ?? null;
}

export function lessonCount(id: TopicId): number {
  return Object.keys(SAMPLE_CATEGORIES).filter((s) => topicOf(s) === id).length;
}
