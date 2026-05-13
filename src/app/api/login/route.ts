/**
 * Token-based login Route Handler.
 *
 * Customer's welcome email links here:
 *   /api/login?token=XYZ
 *
 * Hashes the token, finds the workspace, sets the session cookie, redirects
 * to /app (or `?next=`). Route Handlers (unlike RSC pages) can set cookies.
 */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
} from "@/lib/auth";
import { findWorkspaceByToken } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * Compute the public base URL.
 *
 * Tailscale Funnel forwards into Next.js on localhost:3000, so `req.url`
 * reports localhost. Prefer PUBLIC_URL env, then X-Forwarded-Host/X-Forwarded-Proto,
 * then the request's host header, then req.url as last resort.
 */
function publicOrigin(req: NextRequest): string {
  const envUrl = (process.env.PUBLIC_URL ?? "").trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  const proto =
    req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(/:$/, "");
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const next = req.nextUrl.searchParams.get("next") || "/app";
  const base = publicOrigin(req);

  if (!token) {
    return NextResponse.redirect(`${base}/login`);
  }

  const ws = await findWorkspaceByToken(token);
  if (!ws) {
    const params = new URLSearchParams({ error: "Invalid or expired token" });
    return NextResponse.redirect(`${base}/login?${params.toString()}`);
  }

  const sessionToken = await signSession(`workspace:${ws.slug}`, ws.id);
  const c = await cookies();
  c.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  // `next` is meant to be a path (e.g. /app) — make it absolute against base.
  const target = next.startsWith("http") ? next : `${base}${next.startsWith("/") ? "" : "/"}${next}`;
  return NextResponse.redirect(target);
}
