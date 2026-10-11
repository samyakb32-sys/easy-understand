import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The public site is the single-page app in public/site.html (hash routes). The old page URLs point at its matching screens.
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/site.html" }], afterFiles: [], fallback: [] };
  },
  async redirects() {
    return [
      ["/lessons", "/#/library"], ["/solve/:slug", "/#/library"], ["/pricing", "/#/pricing"], ["/login", "/#/login"],
      ["/account", "/#/account"], ["/history", "/#/history"], ["/history/:id", "/#/history"], ["/legal/:doc", "/#/legal"],
    ].map(([source, destination]) => ({ source, destination, permanent: true }));
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV !== "production") }];
  },
};

export default nextConfig;
