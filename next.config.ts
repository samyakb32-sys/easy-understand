import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // lesson pages moved from /solve/<slug> to /lessons/<slug> (/solve is now the upload page)
  async redirects() {
    return [{ source: "/solve/:slug", destination: "/lessons/:slug", permanent: true }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV !== "production") }];
  },
};

export default nextConfig;
