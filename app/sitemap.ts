import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// the site is one page (public/site.html, served at /) with hash routes
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteUrl() + "/" }];
}
