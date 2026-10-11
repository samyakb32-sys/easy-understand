"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// links shared from the earlier one-page site used hash routes (/#/library, /#/pricing…): send them to the real pages
const MAP: Record<string, string> = {
  "/library": "/lessons", "/lesson": "/lessons", "/solve": "/solve", "/pricing": "/pricing", "/login": "/login",
  "/history": "/history", "/account": "/account", "/legal": "/legal/privacy",
};

export function HashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const h = location.hash;
    if (!h.startsWith("#/")) return;
    const to = MAP[h.slice(1).split("?")[0]];
    if (to) router.replace(to);
  }, [router]);
  return null;
}
