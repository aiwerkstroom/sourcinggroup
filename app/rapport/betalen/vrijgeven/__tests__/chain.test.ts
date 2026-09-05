import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_CARDS } from "@/lib/payments/test-cards";

/**
 * Golden test for the whole paid chain (fase 4 stap 2, stap 4 van 5):
 * wizard input -> prepare -> pay -> release -> the report on screen,
 * driven by a real browser against a real production server.
 *
 * The anchor is the point. The reference case's base scenario scores 3.7
 * at percentile 70 - pinned independently in engine.test.ts against the
 * hand-assembled outcome, and in the PDF golden test against the printed
 * document. If it also comes out of the paid chain, then reordering the
 * flow around a payment did not disturb the calculation: the same input
 * produces the same number, one route later. That is the one thing worth
 * checking end to end rather than per unit.
 *
 * Runs in a browser rather than over raw fetch because the confirmation
 * step is a Server Action, and because the release is what the payment
 * form triggers - calling the route directly would test the route and
 * skip the wiring this step is mostly about.
 *
 * The failure path (paid, then runEngine throws) is not here: it cannot
 * be reached through this chain by construction, because the prepare
 * route's validation gate refuses uncomputable input before a payment
 * exists. It is covered in failure.test.ts, which reaches the route with
 * the store in a state this chain cannot produce.
 */

const PORT = 3181;
const BASE_URL = `http://localhost:${PORT}`;
const START_TIMEOUT_MS = 20_000;
const TEST_TIMEOUT_MS = 90_000;

const REFERENCE_ADDRESS = "Avenida Primado Reig 19, Valencia";

/**
 * Walks the four wizard steps as a customer would, filling the reference
 * case. Not a POST of a prepared payload: the point of this test is the
 * chain, and the wizard's own last step is the first link in it.
 */
async function fillWizard(page: Page): Promise<void> {
  await page.getByLabel("Volledig adres").fill(REFERENCE_ADDRESS);
  await page.getByLabel("Wijk").selectOption("__other__");
  await page.getByLabel("Vraagprijs").fill("330.000");
  await page.getByLabel("Gebouwd oppervlak").fill("133");
  await page.getByLabel("Bruikbaar oppervlak").fill("133");
  // Anchored: "Kamers" also matches Slaapkamers and Badkamers.
  await page.getByLabel(/^Kamers/).fill("7");
  await page.getByLabel("Slaapkamers").fill("5");
  await page.getByLabel("Badkamers").fill("5");
  await page.getByLabel("Bouwjaar").fill("1972");
  await page.getByLabel("Energielabel").selectOption("B");
  await page.getByRole("button", { name: /Volgende/ }).click();
  await page.waitForURL(/staat-en-lasten/);

  await page.locator('input[type="radio"][value="average"]').check();
  await page.getByLabel("Gastos de comunidad per jaar").fill("900");
  await page.getByLabel("Huurstatus").selectOption("vacant");
  await page.locator('input[type="radio"][value="yes"]').check();
  await page.getByRole("button", { name: /Volgende/ }).click();
  await page.waitForURL(/belegger/);

  await page.getByLabel("Beschikbaar eigen vermogen").fill("115.000");
  await page.getByLabel("Totaalbudget").fill("450.000");
  await page.getByLabel("Renovatiebudget").fill("60.000");
  await page.getByLabel("Gewenste LTV").fill("75");
  await page.getByLabel("Minimale LTV").fill("60");
  await page.getByLabel("Maximale LTV").fill("75");
  await page.getByLabel("Maximale maandlast").fill("1.000");
  await page.getByLabel("Minimale maandcashflow").fill("500");
  await page.getByLabel("Minimale ROI").fill("4");
  await page.getByLabel("Houdperiode").fill("10");
  // Required since the tax-residency correction. "netherlands" is the
  // treatment this chain always implicitly assumed, so the figures it
  // asserts on downstream are unchanged.
  await page.getByLabel("Waar bent u fiscaal inwoner?").selectOption("netherlands");
  await page.locator('input[type="radio"][value="hybrid"]').check();
  await page.getByLabel("Langetermijnhuur").fill("17");
  await page.getByLabel("Kortetermijnhuur").fill("36");
  await page.getByRole("button", { name: /Volgende/ }).click();
  await page.waitForURL(/\/exit/);

  await page.getByLabel("Plusvalía municipal").fill("3.500");
}

async function signUp(page: Page, prefix: string): Promise<void> {
  await page.goto(`${BASE_URL}/auth/signup`, { waitUntil: "networkidle" });
  await page.getByLabel("E-mailadres").fill(`${prefix}-${Date.now()}-${Math.random()}@example.com`);
  await page.getByLabel("Wachtwoord").fill("wachtwoord123");
  await page.getByRole("button", { name: "Account aanmaken" }).click();
  await page.waitForURL(/\/rapport\/nieuw\/pand/);
}

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

let server: ChildProcessWithoutNullStreams;
let browser: Browser;

beforeAll(async () => {
  const repoRoot = path.resolve(import.meta.dirname, "../../../../..");
  const nextBin = path.join(repoRoot, "node_modules/.bin/next");

  if (!existsSync(path.join(repoRoot, ".next/BUILD_ID"))) {
    throw new Error(
      "No production build found (.next/BUILD_ID missing). Run `npm run build` first - " +
        "this golden test drives the paid chain through a real `next start` server.",
    );
  }

  // TSG_PENDING_STORE=memory: this server has no Supabase behind it, and
  // since fase 4 stap 3's live swap pending-input.ts otherwise resolves
  // to the real adapter. This chain is about the payment->release path
  // and the anchor surviving it, not about which store backs it - so it
  // runs on the in-memory one, via the explicit opt-in pending-input.ts
  // documents, never a fallback a missing key could trigger.
  server = spawn(nextBin, ["start", "-p", String(PORT)], {
    cwd: repoRoot,
    stdio: "pipe",
    env: { ...process.env, TSG_PENDING_STORE: "memory", TSG_PAYMENT_STORE: "memory" },
  });
  await waitForServer(Date.now() + START_TIMEOUT_MS);
  browser = await chromium.launch();
}, TEST_TIMEOUT_MS);

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

/** Signs up, fills the wizard, and follows its last step into the payment page. */
async function arriveAtPayment(page: Page, prefix = "chain"): Promise<void> {
  await signUp(page, prefix);
  await fillWizard(page);

  // The wizard's last step no longer calculates - it opens a payment.
  await page.getByRole("button", { name: "Doorgaan naar betaling" }).click();
  await page.waitForURL(/\/rapport\/betalen/, { timeout: 20_000 });
}

describe("the paid chain, end to end", () => {
  it(
    "carries the reference case through payment to a released report with the anchor intact",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await arriveAtPayment(page);

      await page.getByLabel("Kaartnummer").fill(TEST_CARDS.success);
      await page.getByRole("button", { name: /Betaal/ }).click();

      // The release runs behind this, then navigates.
      await page.waitForURL(/\/rapport\/resultaat/, { timeout: 30_000 });

      const body = await page.locator("body").innerText();

      // THE ANCHOR: base scenario, 3.7 at percentile 70 - the same pair
      // engine.test.ts pins directly against the engine. It was 3.8 until
      // the ITP/AJD correction (AJD is not owed on an existing-build
      // purchase, so it left the acquisition costs); that moved the
      // score by one tenth everywhere it is pinned, and this test was the
      // one place it was not updated.
      expect(body).toContain("3,7");
      expect(body).toContain("percentiel 70");

      // The report itself arrived, not just a page.
      expect(body).toContain(REFERENCE_ADDRESS);
      // The eyebrow is styled `uppercase`, so innerText reports it that
      // way regardless of the source casing.
      expect(body.toLowerCase()).toContain("rendementsrapport");

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "clears the pending cookie on release, so a second release finds nothing",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await arriveAtPayment(page);

      await page.getByLabel("Kaartnummer").fill(TEST_CARDS.success);
      await page.getByRole("button", { name: /Betaal/ }).click();
      await page.waitForURL(/\/rapport\/resultaat/, { timeout: 30_000 });

      // The cookie is gone from the browser.
      const cookies = await context.cookies();
      expect(cookies.find((c) => c.name === "tsg-pending-report")).toBeUndefined();

      // And a replayed release has nothing left to hand out: one
      // payment, one report.
      const replay = await page.evaluate(async () => {
        const res = await fetch("/rapport/betalen/vrijgeven", { method: "POST" });
        return { status: res.status, body: await res.json() };
      });
      expect(replay.status).toBe(404);
      expect(replay.body.result).toBeUndefined();

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "refuses to release while the payment has not been made",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await arriveAtPayment(page);

      // Paid nothing: the intent is still requires_payment_method.
      const attempt = await page.evaluate(async () => {
        const res = await fetch("/rapport/betalen/vrijgeven", { method: "POST" });
        return { status: res.status, body: await res.json() };
      });

      expect(attempt.status).toBe(402);
      expect(attempt.body.result).toBeUndefined();
      expect(attempt.body.error).toContain("nog niet voltooid");

      // And the input is untouched, so the customer can still pay.
      await page.reload({ waitUntil: "networkidle" });
      expect(await page.locator("body").innerText()).toContain(REFERENCE_ADDRESS);

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "refuses to release for someone who never opened a payment at all",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${BASE_URL}/auth/signup`, { waitUntil: "networkidle" });
      await page.getByLabel("E-mailadres").fill(`nopay-${Date.now()}@example.com`);
      await page.getByLabel("Wachtwoord").fill("wachtwoord123");
      await page.getByRole("button", { name: "Account aanmaken" }).click();
      await page.waitForURL(/\/rapport\/nieuw\/pand/);

      const attempt = await page.evaluate(async () => {
        const res = await fetch("/rapport/betalen/vrijgeven", { method: "POST" });
        return { status: res.status, body: await res.json() };
      });

      expect(attempt.status).toBe(404);
      expect(attempt.body.result).toBeUndefined();

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "sends the customer through payment from the wizard's last step, not straight to a report",
    async () => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await signUp(page, "wiz");
      await fillWizard(page);

      // The old flow calculated here and went straight to the report.
      expect(await page.getByRole("button", { name: "Rapport doorrekenen" }).count()).toBe(0);
      expect(await page.getByRole("button", { name: "Doorgaan naar betaling" }).count()).toBe(1);

      await page.getByRole("button", { name: "Doorgaan naar betaling" }).click();
      await page.waitForURL(/\/rapport\/betalen/, { timeout: 20_000 });

      // Paid nothing yet, so no report exists anywhere near this point.
      expect(page.url()).not.toContain("/rapport/resultaat");
      expect(await page.locator("body").innerText()).toContain("Wat u afrekent");

      await context.close();
    },
    TEST_TIMEOUT_MS,
  );
});
