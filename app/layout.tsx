import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { BRAND_FULL } from "@/lib/brand";
import { siteUrl } from "@/lib/site";
import { Sarthak } from "@/components/Sarthak";
import { SiteFooter, SiteHeader } from "@/components/site/Shell";
import { THEME_SCRIPT } from "@/components/site/theme";

const TITLE = "linewise — learn EGD clearly";
const DESCRIPTION =
  "Turn an Engineering Graphics & Design question into a precise, step-by-step lesson: exact geometry, a reason for every line, and a solid you can rotate in 3D.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: TITLE, template: `%s · ${BRAND_FULL}` },
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: BRAND_FULL, title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#f7f6f1", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // the theme script adds "dark" before React hydrates
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <Sarthak />
        {/* turn on Web Analytics in the Vercel project, then set NEXT_PUBLIC_ANALYTICS=on (its script 404s until then) */}
        {process.env.NEXT_PUBLIC_ANALYTICS === "on" && <Analytics />}
      </body>
    </html>
  );
}
