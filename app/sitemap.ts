import type { MetadataRoute } from "next";
import { SAMPLES } from "@/lib/samples";
import { siteUrl } from "@/lib/site";

// keep in step with DOCS in app/legal/[doc]/page.tsx
const LEGAL = ["terms", "privacy", "refunds", "contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    "/",
    ...LEGAL.map((d) => `/legal/${d}`),
    ...Object.keys(SAMPLES).map((s) => `/solve/${s}`),
  ].map((path) => ({ url: base + path }));
}
