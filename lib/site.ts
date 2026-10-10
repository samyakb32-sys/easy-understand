/** Public origin used for canonical links, previews, robots and the sitemap. Set NEXT_PUBLIC_SITE_URL at build time. */
export const siteUrl = (): string => {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || (vercel ? `https://${vercel}` : "http://localhost:3000");
  return raw.replace(/\/+$/, "");
};

/** Paths that are private or not pages: kept out of search results. */
export const PRIVATE_PATHS = ["/api/", "/account", "/history", "/auth/", "/login"];
