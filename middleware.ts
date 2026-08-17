import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/supabase-mock";

/**
 * Session gate for the paid path (fase 4 stap 4). Runs before any page or
 * route handler under the matcher below - the point of doing this in
 * middleware rather than a per-page check is that an unauthenticated
 * visitor never even reaches the wizard's client code, not just that the
 * page later notices and bounces them.
 *
 * Only checks the cookie's presence, not the mock user registry behind
 * it: the registry is client-only in-memory state (supabase-mock.ts's own
 * docstring explains why), unreachable from here regardless, and a
 * present, well-formed session cookie is exactly what a real Supabase SSR
 * session check would also rest on at this layer - the swap to the real
 * SDK later replaces the cookie's *origin*, not this file's shape.
 *
 * /rapport/resultaat/print and /rapport/resultaat/print/[token]
 * (fase 3) are deliberately excluded from the /rapport protection below,
 * not an oversight: Playwright's own headless Chromium navigates there
 * from inside the PDF routes with no session cookie at all (a fresh,
 * unauthenticated browser instance) - protecting them would silently
 * break both PDF routes, since the internal render step would get
 * redirected to /auth/signin instead of the report. GET
 * /rapport/resultaat/pdf and POST /rapport/resultaat/pdf/genereer - the
 * actual customer-facing PDF endpoints, as opposed to the internal print
 * pages they drive - stay protected like the rest of /rapport: a real
 * download click already happens from an authenticated page, so the
 * browser's own fetch() already carries the cookie automatically.
 *
 * /zoeken (pijler 2, SOURCING_SPEC.md §3) is protected the same way and
 * for an explicitly stated reason, not by extension of the wizard's own
 * logic: the alerts pijler 2 adds later need an account regardless
 * (saved criteria per user), so one access model for the whole pillar is
 * simpler than anonymous search plus account-only alerts. Search itself
 * stays free - the paid value is still the per-property report.
 */

const INTERNAL_PRINT_PREFIX = "/rapport/resultaat/print";
const AUTH_PAGES = new Set(["/auth/signin", "/auth/signup"]);
const SIGNED_IN_LANDING = "/rapport/nieuw";
const SIGNED_OUT_LANDING = "/auth/signin";

function hasSession(request: NextRequest): boolean {
  const value = request.cookies.get(SESSION_COOKIE)?.value;
  return value !== undefined && value !== "";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = hasSession(request);

  const isProtected =
    (pathname.startsWith("/rapport") && !pathname.startsWith(INTERNAL_PRINT_PREFIX)) ||
    pathname.startsWith("/zoeken");

  if (isProtected && !signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = SIGNED_OUT_LANDING;
    return NextResponse.redirect(url);
  }

  if (AUTH_PAGES.has(pathname) && signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = SIGNED_IN_LANDING;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/rapport/:path*", "/zoeken/:path*", "/auth/signin", "/auth/signup"],
};
