"use client";

import Link from "next/link";
import { useEntitlements } from "./useEntitlements";

export function NavAuth() {
  const { me, loading } = useEntitlements();
  // hold the slot while /api/me answers so the header does not jump when "Sign in" appears
  if (loading) return <span className="nav-auth-slot" aria-hidden="true" />;
  if (!me?.configured.auth) return null;
  return me.signedIn ? (
    <Link href="/account" className="navlink">
      Account{me.isPro && <span className="pro-badge">PRO</span>}
    </Link>
  ) : (
    <Link href="/login" className="navlink">Sign in</Link>
  );
}
