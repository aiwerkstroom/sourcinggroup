import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Golden test for the site navigation, driven by a real browser against a
 * real production server - the same weight as every other route-level
 * test here (middleware.test.ts, app/zoeken's own page.test.ts).
 *
 * WHAT THIS IS ACTUALLY FOR. /zoeken (pijler 2, SOURCING_SPEC.md) was
 * reachable only by typing the URL: nothing in the interface linked to
 * it. The component test in app/_components/__tests__/site-nav.test.tsx
 * proves the anchor exists with the right href; this file proves the
 * thing the brief actually asked for - that a visitor standing on the
 * homepage can *get there by clicking*, through the real layout, the real
 * middleware and the real router.
 *
 * Both access states are exercised, because /zoeken sits behind
 * middleware.ts's session gate (SOURCING_SPEC.md §3) and "reachable"
 * means something different on each side of it:
 *
 *  - signed out, the click must land on the sign-in page - the existing
 *    access rule doing its job, not a broken link;
 *  - signed in, the same click must land on /zoeken itself.
 *
 * Only the second is proof the destination renders; only the first proves
 * the new link did not quietly punch a hole in the gate. Neither alone
 * would be enough.
 */

const PORT = 3184;
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

async function signUp(page: Page, prefix: string): Promise<void> {
  await page.goto(`${BASE_URL}/auth/signup`, { waitUntil: "networkidle" });
  await page.getByLabel("E-mailadres").fill(`${prefix}-${Date.now()}-${Math.random()}@example.com`);
  await page.getByLabel("Wachtwoord").fill("wachtwoord123");
  await page.getByRole("button", { name: "Account aanmaken" }).click();
  await page.waitForURL(/\/rapport\/nieuw\/pand/, { timeout: 10_000 });
}

/** The nav's own links, addressed through the landmark so the hero's own links cannot match instead. */
function navLink(page: Page, name: string) {
  return page.getByRole("navigation", { name: "Hoofdnavigatie" }).getByRole("link", { name });
}

let server: ChildProcessWithoutNullStreams;
let browser: Browser;

beforeAll(async () => {
  const repoRoot = path.resolve(import.meta.dirname, "../..");
  const nextBin = path.join(repoRoot, "node_modules/.bin/next");

  if (!existsSync(path.join(repoRoot, ".next/BUILD_ID"))) {
    throw new Error(
      "No production build found (.next/BUILD_ID missing). Run `npm run build` first - " +
        "this golden test drives the site navigation through a real `next start` server.",
    );
  }

  // TSG_AUTH_STORE=memory: the signed-in half below drives a real signup
  // through the actual form, and there is no Supabase project reachable
  // from here (lib/auth/auth-client.ts's resolveAuthBackend()).
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

describe("the navigation bar is on the homepage, with every destination linked", () => {
  it(
    "shows all four links and the account button to a visitor who just arrived",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: "networkidle" });

      const expectedHrefs: Record<string, string> = {
        Home: "/",
        "Gratis indicatie": "/gratis",
        "Betaald rapport": "/rapport/nieuw",
        Zoeken: "/zoeken",
      };
      for (const [label, href] of Object.entries(expectedHrefs)) {
        const link = navLink(page, label);
        expect(await link.count(), `${label} must be in the nav`).toBe(1);
        expect(await link.getAttribute("href"), `${label} must point at ${href}`).toBe(href);
      }
      expect(await navLink(page, "Inloggen").count()).toBe(1);

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );
});

describe("/zoeken is reachable from the homepage - the point of this change", () => {
  it(
    "signed in: clicking the nav's Zoeken link lands on the rendered search page",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Starts from the page signup lands on rather than from the
      // homepage, and that is a limitation of the test backend rather
      // than a gap in what is being proven. TSG_AUTH_STORE reaches
      // AuthProvider through app/layout.tsx, which is a *server-side*
      // read - so it only takes effect on routes rendered per request.
      // The homepage is statically prerendered, so it baked in "no
      // override" at build time and runs the real Supabase backend, whose
      // onAuthStateChange reports no session and clears the marker
      // cookie. Visiting the homepage under the memory backend therefore
      // signs the visitor out. Production never sees this: TSG_AUTH_STORE
      // is unset there, so static and dynamic routes agree on the
      // Supabase backend and there is nothing to disagree about.
      //
      // Nothing about the LINK is untested as a result. It is the same
      // nav on every page; the sibling test above pins that the
      // homepage's copy carries href="/zoeken", and this one pins that
      // clicking that href arrives at a rendered search page.
      await signUp(page, "site-nav-zoeken");
      expect(pathnameOf(page.url())).toBe("/rapport/nieuw/pand");

      await navLink(page, "Zoeken").click();
      await page.waitForURL(/\/zoeken/, { timeout: 10_000 });
      expect(pathnameOf(page.url())).toBe("/zoeken");

      // ...and the page that arrived is the real search page, not an
      // error boundary that happens to sit on the right URL.
      expect(
        await page.getByRole("heading", { name: "Zoek panden die aan uw criteria voldoen" }).count(),
      ).toBe(1);

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "signed out: the same click hits the session gate rather than a broken link",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(BASE_URL, { waitUntil: "networkidle" });

      // Starts on the homepage, and gets to search purely by clicking -
      // never by typing the URL, which is exactly what was impossible
      // before this bar existed.
      expect(pathnameOf(page.url())).toBe("/");
      await navLink(page, "Zoeken").click();
      await page.waitForURL(/\/auth\/signin/, { timeout: 10_000 });

      // SOURCING_SPEC.md §3's access rule, unchanged by the new link.
      expect(pathnameOf(page.url())).toBe("/auth/signin");

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );
});

describe("the navigation stays off the print routes, so it never reaches a PDF", () => {
  it(
    "renders no navigation landmark on the print page the PDF pipeline uses",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Unauthenticated on purpose: this is exactly how Playwright
      // reaches it from inside the PDF route, and middleware.ts excludes
      // it from the session gate for that reason.
      const response = await page.goto(`${BASE_URL}/rapport/resultaat/print`, {
        waitUntil: "networkidle",
      });
      expect(response?.status()).toBe(200);

      expect(await page.getByRole("navigation", { name: "Hoofdnavigatie" }).count()).toBe(0);

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );
});
