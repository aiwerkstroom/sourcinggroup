import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SOURCING_YIELD_DISCLOSURE_COPY_NL } from "@/lib/copy/es/sourcing-yield-disclosures";

/**
 * Golden test for the search page's full flow (SOURCING_SPEC.md §7 step
 * 3): criteria in, through the real form, to a filtered results list -
 * driven by a real browser against a real production server, the same
 * weight as every other route-level golden test in this project
 * (middleware.test.ts, the payment page's own page.test.ts).
 *
 * The filter assertions below rest on sieve-yield percentages computed
 * independently (a standalone script calling computeSieveYield() against
 * the real fixtures, the same method sieve-yield.test.ts's own seven
 * anchor points were derived from) and confirmed once more here:
 * El Carmen's four listings are 6%, 6%, 6%, 7% (mock-021/022/023/030);
 * Cullera's two are both 7% (mock-009/010). A search for
 * "El Carmen (Ciutat Vella)" at a 7% threshold therefore has exactly one
 * correct answer - not a plausible one - which is what makes it worth
 * pinning rather than just checking "some results came back".
 *
 * This is also the first golden test to prove SOURCING_SPEC.md §3's
 * access rule end to end: unauthenticated visitors never see this page
 * at all, the same middleware.ts gate /rapport/* already sits behind.
 */

const PORT = 3182;
const BASE_URL = `http://localhost:${PORT}`;
const START_TIMEOUT_MS = 20_000;
const TEST_TIMEOUT_MS = 90_000;

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

/**
 * Clicks "Zoeken" and waits for the actual result content to appear,
 * not for a network-idle signal. router.push() to /zoeken?... is a
 * client-side (soft) App Router navigation - there is no full page load
 * for waitForLoadState("networkidle") to hook into, and it can resolve
 * before the RSC response for the new query has streamed in and
 * re-rendered. Confirmed empirically: a direct page.goto() to the same
 * URL always rendered the right results instantly, while the client-side
 * click path intermittently read stale (pre-navigation) content when
 * only network-idle was awaited. Waiting for the one piece of text that
 * can only appear once the server has actually answered - the result
 * count line, or the neutral zero-results line - is what the test
 * actually needs, so it waits for that directly instead.
 */
async function submitSearch(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Zoeken" }).click();
  await page
    .getByText(/voldoet aan uw criteria|voldoen aan uw criteria|Geen panden voldoen aan uw criteria/)
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
}

let server: ChildProcessWithoutNullStreams;
let browser: Browser;

beforeAll(async () => {
  const repoRoot = path.resolve(import.meta.dirname, "../../..");
  const nextBin = path.join(repoRoot, "node_modules/.bin/next");

  if (!existsSync(path.join(repoRoot, ".next/BUILD_ID"))) {
    throw new Error(
      "No production build found (.next/BUILD_ID missing). Run `npm run build` first - " +
        "this golden test drives the search page through a real `next start` server.",
    );
  }

  server = spawn(nextBin, ["start", "-p", String(PORT)], { cwd: repoRoot, stdio: "pipe" });
  await waitForServer(Date.now() + START_TIMEOUT_MS);
  browser = await chromium.launch();
}, TEST_TIMEOUT_MS);

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

describe("middleware protection (SOURCING_SPEC.md §3)", () => {
  it(
    "redirects an unauthenticated visit to signin",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/zoeken`, { waitUntil: "networkidle" });
      expect(pathnameOf(page.url())).toBe("/auth/signin");

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );
});

describe("cold entry", () => {
  it(
    "prompts for criteria rather than showing results or a zero-results message",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await signUp(page, "zoeken-cold");

      await page.goto(`${BASE_URL}/zoeken`, { waitUntil: "networkidle" });
      const body = await page.locator("body").innerText();

      expect(body).toContain("Vul uw criteria in om te zoeken");
      expect(body).not.toContain("Geen panden voldoen aan uw criteria");
      expect(body).not.toContain("voldoen aan uw criteria —");

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );
});

describe("the search flow, through the real form", () => {
  it(
    "a wijk + yield-drempel combination returns exactly the one listing that clears it",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await signUp(page, "zoeken-elcarmen");
      await page.goto(`${BASE_URL}/zoeken`, { waitUntil: "networkidle" });

      await page.getByLabel("Wijk").selectOption("El Carmen (Ciutat Vella)");
      await page.getByLabel("Minimale bruto yield (zeef)").fill("7");
      await submitSearch(page);

      const body = await page.locator("body").innerText();

      // The count/sort line is styled `uppercase` (DESIGN_SPEC.md's
      // eyebrow treatment), so innerText() reports it in caps regardless
      // of source casing - same thing already learned in the paid
      // chain's own golden test.
      expect(body.toLowerCase()).toContain("1 pand voldoet aan uw criteria");
      // THE ANCHOR: of El Carmen's four listings (6%, 6%, 6%, 7%), only
      // mock-030 clears a 7% threshold.
      expect(body).toContain("Groot herenhuis in El Carmen");
      expect(body).not.toContain("Penthouse met dakterras in El Carmen");
      expect(body).not.toContain("Studio in historisch pand, El Carmen");
      expect(body).not.toContain("Volledig gerenoveerd appartement, El Carmen");

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "a wijk-only search returns every listing in that wijk, sorted by price ascending",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await signUp(page, "zoeken-cullera");
      await page.goto(`${BASE_URL}/zoeken`, { waitUntil: "networkidle" });

      await page.getByLabel("Wijk").selectOption("Cullera");
      await submitSearch(page);

      const body = await page.locator("body").innerText();
      expect(body.toLowerCase()).toContain("2 panden voldoen aan uw criteria");
      expect(body.toLowerCase()).toContain("gesorteerd op prijs");

      // mock-009 (€ 72.000) must read before mock-010 (€ 122.000).
      const posCheap = body.indexOf("Studio vlak bij het strand van Cullera");
      const posPricier = body.indexOf("Appartement met balkon en bergruimte");
      expect(posCheap).toBeGreaterThanOrEqual(0);
      expect(posPricier).toBeGreaterThan(posCheap);

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "an impossible combination yields the neutral zero-results state, not an error",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await signUp(page, "zoeken-impossible");
      await page.goto(`${BASE_URL}/zoeken`, { waitUntil: "networkidle" });

      await page.getByLabel("Minimale bruto yield (zeef)").fill("99");
      await submitSearch(page);

      const body = await page.locator("body").innerText();
      expect(body).toContain("Geen panden voldoen aan uw criteria");

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );
});

describe("the sieve-yield percentage never appears without its disclosure set - on the real page too", () => {
  it(
    "every disclosure sentence is present alongside the results",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await signUp(page, "zoeken-disclosures");
      await page.goto(`${BASE_URL}/zoeken`, { waitUntil: "networkidle" });

      await page.getByLabel("Wijk").selectOption("Cullera");
      await submitSearch(page);

      const body = await page.locator("body").innerText();
      expect(body).toContain(SOURCING_YIELD_DISCLOSURE_COPY_NL.grossOnly);
      expect(body).toContain(SOURCING_YIELD_DISCLOSURE_COPY_NL.longTermOnly);
      expect(body).toContain(SOURCING_YIELD_DISCLOSURE_COPY_NL.neighborhoodAverage);
      expect(body).toContain(SOURCING_YIELD_DISCLOSURE_COPY_NL.notTheReport);

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );
});

describe("neutral language, on the live page", () => {
  it(
    "never uses recommendation or ranking language anywhere on the page",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await signUp(page, "zoeken-neutral");
      await page.goto(`${BASE_URL}/zoeken`, { waitUntil: "networkidle" });

      // An entirely empty submit is indistinguishable from a fresh visit
      // (query-params.ts's own hasAnyCriteria), so at least one filter
      // is filled in here - otherwise this would just re-show the
      // cold-entry prompt rather than a results list.
      await page.getByLabel("Wijk").selectOption("Mislata");
      await submitSearch(page);

      const body = (await page.locator("body").innerText()).toLowerCase();
      expect(body).not.toContain("aanbevolen");
      expect(body).not.toContain("beste match");
      expect(body).not.toContain("top pand");
      // Mislata has two listings (mock-011, mock-012), so the plural -
      // already lowercased above, since the source line is styled
      // `uppercase`.
      expect(body).toContain("voldoen aan uw criteria");

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );
});
