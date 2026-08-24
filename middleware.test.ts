import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Browser } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Golden test for middleware.ts (fase 4 stap 4): a real Playwright
 * browser navigating a real `next start` server, following the same
 * route-to-route chain an actual visitor would - not isolated
 * request-level checks. That is what this task asked to verify: that
 * the routing holds up as someone actually moves between pages (sign up,
 * land on a protected route, revisit an auth page while still signed
 * in, get bounced there instead of being asked to log in twice, sign out,
 * get blocked from /rapport again).
 *
 * Lives at the repo root next to middleware.ts itself, not in a
 * __tests__ subfolder like the rest of the suite - tsconfig.json's
 * root-level "*.ts" include entry already covers it without a new glob.
 *
 * Same weight and setup as fase 3's pdf-export.test.ts: spawns `next
 * start` against an already-built .next output (a production build must
 * exist first) and drives a real browser. Runs from `npm test` like
 * everything else, just slower.
 */

const PORT = 3178;
const BASE_URL = `http://localhost:${PORT}`;
const START_TIMEOUT_MS = 20_000;
const TEST_TIMEOUT_MS = 60_000;

async function waitForServer(deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) return;
    } catch {
      // Not up yet - keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Production server did not become ready on ${BASE_URL} in time`);
}

function pathnameOf(url: string): string {
  return new URL(url).pathname;
}

let server: ChildProcessWithoutNullStreams;
let browser: Browser;

beforeAll(async () => {
  const repoRoot = path.resolve(import.meta.dirname);
  const nextBin = path.join(repoRoot, "node_modules/.bin/next");

  if (!existsSync(path.join(repoRoot, ".next/BUILD_ID"))) {
    throw new Error(
      "No production build found (.next/BUILD_ID missing). Run `npm run build` first - " +
        "this golden test drives middleware.ts through a real `next start` server.",
    );
  }

  // TSG_AUTH_STORE=memory: this server has no Supabase project reachable
  // from here, and step 4 below drives a real signUp() through the
  // actual browser - lib/auth/auth-client.ts's resolveAuthBackend() is
  // what makes this env var (read server-side, per request, by
  // app/layout.tsx) actually reach AuthProvider despite this being a
  // production build.
  server = spawn(nextBin, ["start", "-p", String(PORT)], {
    cwd: repoRoot,
    stdio: "pipe",
    env: { ...process.env, TSG_AUTH_STORE: "memory" },
  });
  await waitForServer(Date.now() + START_TIMEOUT_MS);
  browser = await chromium.launch();
}, TEST_TIMEOUT_MS);

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

describe("middleware - route-to-route walkthrough", () => {
  it(
    "redirects unauthenticated /rapport visits to signin, lets sign-up through, bounces /auth/* while signed in, and re-blocks /rapport after signing out",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      // 1. Unauthenticated: a protected wizard page redirects to signin.
      await page.goto(`${BASE_URL}/rapport/nieuw/pand`, { waitUntil: "networkidle" });
      expect(pathnameOf(page.url())).toBe("/auth/signin");

      // 2. Unauthenticated: the paid result page redirects too.
      await page.goto(`${BASE_URL}/rapport/resultaat`, { waitUntil: "networkidle" });
      expect(pathnameOf(page.url())).toBe("/auth/signin");

      // 3. The free path and the homepage stay open - no redirect at all.
      await page.goto(`${BASE_URL}/gratis`, { waitUntil: "networkidle" });
      expect(pathnameOf(page.url())).toBe("/gratis");
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
      expect(pathnameOf(page.url())).toBe("/");

      // 4. Sign up for real, through the actual form - establishes a
      // genuine session cookie, not a hand-built one.
      const email = `middleware-walkthrough-${Date.now()}@example.com`;
      await page.goto(`${BASE_URL}/auth/signup`, { waitUntil: "networkidle" });
      await page.getByLabel("E-mailadres").fill(email);
      await page.getByLabel("Wachtwoord").fill("wachtwoord123");
      await page.getByRole("button", { name: "Account aanmaken" }).click();
      await page.waitForURL(/\/rapport\/nieuw\/pand/, { timeout: 10_000 });
      expect(pathnameOf(page.url())).toBe("/rapport/nieuw/pand");

      // 5. Now signed in: revisiting either auth page bounces straight
      // back into the wizard rather than asking to log in twice.
      await page.goto(`${BASE_URL}/auth/signin`, { waitUntil: "networkidle" });
      expect(pathnameOf(page.url())).toBe("/rapport/nieuw/pand");
      await page.goto(`${BASE_URL}/auth/signup`, { waitUntil: "networkidle" });
      expect(pathnameOf(page.url())).toBe("/rapport/nieuw/pand");

      // 6. Sign out by clearing the cookie directly - the resultaat page
      // has no logout button yet (outside this step's scope), so this
      // exercises exactly what the middleware itself checks (the
      // cookie's presence) without depending on UI that does not exist.
      await context.clearCookies();

      // 7. /rapport is protected again.
      await page.goto(`${BASE_URL}/rapport/nieuw/pand`, { waitUntil: "networkidle" });
      expect(pathnameOf(page.url())).toBe("/auth/signin");

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );

  it("leaves the internal print route reachable without a session, so the PDF pipeline keeps working", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const response = await page.goto(`${BASE_URL}/rapport/resultaat/print`, {
      waitUntil: "networkidle",
    });
    expect(response?.status()).toBe(200);
    expect(pathnameOf(page.url())).toBe("/rapport/resultaat/print");

    await context.close();
  });

  it("blocks the customer-facing PDF route (GET /rapport/resultaat/pdf) without a session", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const response = await page.goto(`${BASE_URL}/rapport/resultaat/pdf`, {
      waitUntil: "networkidle",
    });
    expect(pathnameOf(page.url())).toBe("/auth/signin");
    expect(response?.status()).toBe(200); // 200 for the signin page it landed on, after following the redirect.

    await context.close();
  });
});
