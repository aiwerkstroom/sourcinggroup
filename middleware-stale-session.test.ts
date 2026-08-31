import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/auth-contract";
import { middleware } from "./middleware";

/**
 * Closes the loop this task's fix opened, at the one layer that does not
 * need a live Supabase project or a real browser to prove: once
 * auth-supabase.ts's own tests show an invalid session clears the
 * marker cookie (lib/auth/__tests__/auth-supabase.test.ts, "a session
 * already past its own expires_at is treated as no session"), does
 * middleware.ts - deliberately untouched by this fix, per this task's
 * own instruction - actually let that visitor reach /auth/signin rather
 * than bouncing them back into the wizard?
 *
 * Not a browser walkthrough like middleware.test.ts's own suite,
 * deliberately: this whole task exists because a real Supabase session
 * cannot be exercised from this sandbox at all (auth-supabase.ts's own
 * docstring - the egress policy blocks *.supabase.co outright), so a
 * Playwright test driving a real sign-in flow would only ever run
 * against the in-memory backend, proving nothing about the fix this
 * task made. middleware() itself needs neither a browser nor a backend
 * to call directly - it is a pure function of a NextRequest's cookie
 * header - so this is the deterministic way to prove the second half of
 * the fix: given the cookie state the first half produces, is the
 * visitor actually unblocked.
 */
function requestTo(pathname: string, sessionCookieValue?: string): NextRequest {
  const url = `https://example.com${pathname}`;
  const headers = new Headers();
  if (sessionCookieValue !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE}=${sessionCookieValue}`);
  }
  return new NextRequest(url, { headers });
}

function isRedirect(response: ReturnType<typeof middleware>): boolean {
  // NextResponse.redirect() sets a 307/308 status with a Location header;
  // NextResponse.next() is a plain pass-through with neither.
  return response.headers.get("location") !== null;
}

describe("middleware - /auth/signin once the marker cookie is gone", () => {
  it("stays blocked while the marker cookie is still present - the case this fix removes", () => {
    const response = middleware(requestTo("/auth/signin", "1"));
    expect(isRedirect(response)).toBe(true);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/rapport/nieuw");
  });

  it("is reachable once the marker cookie is absent - the state handleSessionEvent()'s expiry check produces for an invalid session", () => {
    const response = middleware(requestTo("/auth/signin"));
    expect(isRedirect(response)).toBe(false);
  });

  it("an empty cookie value counts as absent, matching clearSessionCookie()'s own max-age=0 clear rather than a blank string", () => {
    const response = middleware(requestTo("/auth/signin", ""));
    expect(isRedirect(response)).toBe(false);
  });
});
