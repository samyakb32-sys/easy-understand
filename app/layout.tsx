import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EasyUnderstand 製図 — watch your EGD problem draw itself",
  description:
    "Upload an Engineering Graphics & Design problem, get it solved, and watch it drawn line by line like a professor teaching, then turn it into 3D.",
};

export const viewport: Viewport = { themeColor: "#05080f", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
