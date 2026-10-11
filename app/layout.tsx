import type { Metadata, Viewport } from "next";
import { DM_Mono, Space_Grotesk, Syne } from "next/font/google";
import "./globals.css";
import { BRAND_FULL } from "@/lib/brand";
import { siteUrl } from "@/lib/site";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { THEME_SCRIPT } from "@/components/site/ThemeToggle";

const syne = Syne({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--f-syne", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--f-grotesk", display: "swap" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-mono", display: "swap" });

const TITLE = `${BRAND_FULL} EGD, but make it click`;
const DESCRIPTION =
  "Upload an Engineering Graphics & Design question. Get an exact construction, a reason for every line, and a solid you can turn in 3D.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: BRAND_FULL, title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#fbf6ee" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // the theme script adds "night" before React hydrates
    <html lang="en" className={`${syne.variable} ${grotesk.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
