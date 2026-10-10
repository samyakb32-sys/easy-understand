import type { Metadata, Viewport } from "next";
import "./globals.css";
import { siteUrl } from "@/lib/site";

const TITLE = "EasyUnderstand 製図 — watch your EGD problem draw itself";
const DESCRIPTION =
  "Upload an Engineering Graphics & Design problem, get it solved, and watch it drawn line by line like a professor teaching, then turn it into 3D.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "EasyUnderstand 製図", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#05080f", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
