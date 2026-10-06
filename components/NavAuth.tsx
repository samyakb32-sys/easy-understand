"use client";

import Link from "next/link";
import { useEntitlements } from "./useEntitlements";

export function NavAuth() {
  const { me, loading } = useEntitlements();
  if (loading || !me?.configured.auth) return null;
  return me.signedIn ? (
    <Link href="/account" className="nav-account">
      Account{me.isPro && <span className="pro-badge">PRO</span>}
    </Link>
  ) : (
    <Link href="/login" className="btn nav-signin">Sign in</Link>
  );
}
