import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Golden test for the URL-driven handoff (SOURCING_SPEC.md §4/§7 step 4,
 * stap 2 van 3): /rapport/nieuw/pand?listing=<sourceId> -> server-side
 * getListingDetail() -> the real DOM shows the prefilled fields. Driven
 * against a real production server, same weight as every other
 * route-level golden test in this project - the point here is proving
 * pand/page.tsx's own server-side fetch actually reaches the real
 * source-mock.ts fixtures and the values actually land in the browser,
 * which a component test (pand-form.test.tsx, given a Listing object
 * directly) cannot prove on its own.
 *
 * The unknown-sourceId case is the one this step's own task named
 * explicitly: a stale or tampered ?listing= value must render the
 * ordinary empty wizard, not an error page - checked here by asserting
 * the same empty-field state a plain /rapport/nieuw/pand visit produces.
 */

const PORT = 3183;
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

async function signUp(page: Page, prefix: string): Promise<void> {
  await page.goto(`${BASE_URL}/auth/signup`, { waitUntil: "networkidle" });
  await page.getByLabel("E-mailadres").fill(`${prefix}-${Date.now()}-${Math.random()}@example.com`);
  await page.getByLabel("Wachtwoord").fill("wachtwoord123");
  await page.getByRole("button", { name: "Account aanmaken" }).click();
  await page.waitForURL(/\/rapport\/nieuw\/pand/, { timeout: 10_000 });
}

let server: ChildProcessWithoutNullStreams;
let browser: Browser;

beforeAll(async () => {
  const repoRoot = path.resolve(import.meta.dirname, "../../../../..");
  const nextBin = path.join(repoRoot, "node_modules/.bin/next");

  if (!existsSync(path.join(repoRoot, ".next/BUILD_ID"))) {
    throw new Error(
      "No production build found (.next/BUILD_ID missing). Run `npm run build` first - " +
        "this golden test drives the listing handoff through a real `next start` server.",
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

describe("a chosen listing prefills step 1, over real HTTP", () => {
  it(
    "mock-030's own fields land in the real form",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await signUp(page, "pand-handoff");

      await page.goto(`${BASE_URL}/rapport/nieuw/pand?listing=mock-030`, {
        waitUntil: "networkidle",
      });

      expect(await page.getByLabel("Wijk").inputValue()).toBe("El Carmen (Ciutat Vella)");
      expect(await page.getByLabel("Vraagprijs").inputValue()).toBe("620000");
      expect(await page.getByLabel("Gebouwd oppervlak").inputValue()).toBe("180");
      expect(await page.getByLabel("Bruikbaar oppervlak", { exact: false }).inputValue()).toBe("165");

      // Never prefilled - a listing carries no street address.
      expect(await page.getByLabel("Volledig adres").inputValue()).toBe("");

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "a listing with no usableAreaM2 of its own leaves that field blank",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await signUp(page, "pand-handoff-nousable");

      await page.goto(`${BASE_URL}/rapport/nieuw/pand?listing=mock-009`, {
        waitUntil: "networkidle",
      });

      expect(await page.getByLabel("Wijk").inputValue()).toBe("Cullera");
      expect(await page.getByLabel("Vraagprijs").inputValue()).toBe("72000");
      expect(await page.getByLabel("Gebouwd oppervlak").inputValue()).toBe("38");
      expect(await page.getByLabel("Bruikbaar oppervlak", { exact: false }).inputValue()).toBe("");

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );
});

describe("the edge case this step named: an unknown or stale ?listing= value", () => {
  it(
    "renders the ordinary empty wizard, not an error page",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await signUp(page, "pand-handoff-unknown");

      const response = await page.goto(
        `${BASE_URL}/rapport/nieuw/pand?listing=does-not-exist`,
        { waitUntil: "networkidle" },
      );

      expect(response?.status()).toBe(200);
      expect(await page.getByLabel("Volledig adres").inputValue()).toBe("");
      expect(await page.getByLabel("Wijk").inputValue()).toBe("");
      expect(await page.getByLabel("Vraagprijs").inputValue()).toBe("");
      // The wizard is genuinely usable, not a dead end - the customer
      // fills it in by hand exactly as a plain visit would ask them to.
      expect(await page.getByRole("heading", { name: "Het pand" }).isVisible()).toBe(true);

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "a plain visit with no ?listing= at all behaves identically",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await signUp(page, "pand-handoff-none");

      const response = await page.goto(`${BASE_URL}/rapport/nieuw/pand`, {
        waitUntil: "networkidle",
      });

      expect(response?.status()).toBe(200);
      expect(await page.getByLabel("Volledig adres").inputValue()).toBe("");
      expect(await page.getByLabel("Wijk").inputValue()).toBe("");

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );
});
