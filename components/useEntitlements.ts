"use client";

import { useCallback, useEffect, useState } from "react";
import type { Entitlements } from "@/lib/entitlements";

export type Me = Entitlements & { email?: string | null; configured: { auth: boolean; payments: boolean } };

/** What the signed-in student may do. `loading` is true until the first answer, so locked UI never flashes open. */
export function useEntitlements() {
  const [me, setMe] = useState<Me | null>(null);
  const refresh = useCallback(async (): Promise<Me | null> => {
    try {
      const r = await fetch("/api/me", { cache: "no-store" });
      const data = (await r.json()) as Me;
      setMe(data);
      return data;
    } catch {
      return null;
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { me, loading: me === null, refresh };
}
