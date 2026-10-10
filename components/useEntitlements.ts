"use client";

import { useCallback, useEffect, useState } from "react";
import type { Entitlements } from "@/lib/entitlements";

export type Me = Entitlements & { email?: string | null; configured: { auth: boolean; payments: boolean } };

/** One attempt at /api/me. Returns null on a network error, a non-2xx answer or a body that is not JSON. */
export async function fetchMe(fetchFn: typeof fetch = fetch): Promise<Me | null> {
  try {
    const r = await fetchFn("/api/me", { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as Me;
  } catch {
    return null;
  }
}

/**
 * What the signed-in student may do. `loading` is true until the first answer, so locked UI never flashes open.
 * If /api/me cannot be reached (after one retry) `failed` becomes true so the UI can say so and offer a retry
 * instead of waiting forever. A failed refresh keeps the last good answer.
 */
export function useEntitlements() {
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);
  const refresh = useCallback(async (): Promise<Me | null> => {
    const data = await fetchMe();
    if (data) { setMe(data); setFailed(false); }
    return data;
  }, []);
  const load = useCallback(async () => {
    setFailed(false);
    let data = await refresh();
    if (!data) {
      await new Promise((r) => setTimeout(r, 1500));
      data = await refresh();
    }
    if (!data) setFailed(true);
  }, [refresh]);
  useEffect(() => { void load(); }, [load]);
  return { me, loading: me === null && !failed, failed: failed && me === null, refresh, retry: load };
}
