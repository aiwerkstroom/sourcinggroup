/**
 * The two release refusals the paid chain cannot produce (fase 4 stap 2,
 * stap 4 van 5), tested in-process because that is the only way to reach
 * them at all:
 *
 * - AN UNDERPAYMENT. The prepare route always opens an intent for
 *   REPORT_PRICE_CENTS, so no amount other than EUR 49 can arise by
 *   walking the app. It can arise from a tampered or replayed payment,
 *   and stripe-mock.ts's own golden test pins that an intent succeeds
 *   perfectly well for one cent - so checking status alone would release
 *   the report for whatever was actually paid.
 *
 * - RUNENGINE FAILING AFTER PAYMENT. The validation gate in
 *   voorbereiden/route.ts runs the engine's own cross-field rules before
 *   any payment exists, so input that cannot be computed never reaches a
 *   payment through the app. It is still the failure with the worst
 *   consequences if it ever happens, because the customer's money has
 *   already moved. What this test pins is the promise made in the route's
 *   docstring: nothing is consumed and nothing is cleared, so the payment
 *   can be settled by hand and the failure stays reproducible.
 *
 * Both are reached by putting the store in a state the app itself will
 * not produce: an entry written directly, paired with an intent
 * confirmed directly. That is the point - these are the states an
 * attacker or a bug produces, not a customer.
 *
 * The cookie is stubbed through next/headers. The stub records whether
 * anything tried to write it, which is how "the cookie is NOT cleared"
 * is checked rather than assumed.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Runs before the imports below are evaluated, which is the point: the
// route's module graph reaches pending-input.ts, and that file decides
// which store it exports at load time. Since fase 4 stap 3's live swap
// the default is Supabase, which has no database to talk to here - this
// test drives the release route's own failure handling, not the store,
// so it opts into the in-memory one explicitly.
vi.hoisted(() => {
  process.env.TSG_PENDING_STORE = "memory";
});
import type { WizardData } from "@/app/rapport/nieuw/_state/wizard-state";
import {
  confirmPayment,
  createPaymentIntent,
  REPORT_CURRENCY,
  REPORT_PRICE_CENTS,
  retrievePaymentIntent,
} from "@/lib/payments/stripe-mock";
import { TEST_CARDS } from "@/lib/payments/test-cards";
import { PENDING_INPUT_COOKIE, readPendingInput, storePendingInput } from "../../_lib/pending-input";

let cookieValue: string | undefined;
const cookieWrites: { name: string; value: string }[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === PENDING_INPUT_COOKIE && cookieValue !== undefined
        ? { name, value: cookieValue }
        : undefined,
    set: (name: string, value: string) => {
      cookieWrites.push({ name, value });
    },
  }),
}));

const { POST } = await import("../route");

/** The reference case, as WizardData - computable, so the engine succeeds on it. */
const computable: WizardData = {
  pand: {
    address: "Avenida Primado Reig 19, Valencia",
    neighborhood: "__other__",
    propertyType: "",
    units: "",
    purchasePrice: "330.000",
    builtAreaM2: "133",
    usableAreaM2: "133",
    rooms: "7",
    bedrooms: "5",
    bathrooms: "5",
    constructionYear: "1972",
    energyLabel: "B",
  },
  staatEnLasten: {
    maintenanceCondition: "average",
    communityFeesAnnual: "900",
    cadastralSuelo: "",
    cadastralConstruccion: "",
    currentRentStatus: "vacant",
    currentRentMonthly: "",
    hasTouristRentalLicense: "yes",
  },
  belegger: {
    ownMoney: "115.000",
    totalBudget: "450.000",
    maxRenovationBudget: "60.000",
    preferredLtvPercent: "75",
    minLtvPercent: "60",
    maxLtvPercent: "75",
    maxMonthlyDebt: "1.000",
    minMonthlyCashflow: "500",
    minRoiTargetPercent: "4",
    holdingYears: "10",
    taxResidency: "netherlands",
    rentalStrategy: "hybrid",
    rentPerM2LongTerm: "17",
    rentPerM2ShortTerm: "36",
    rentFromActualCurrentRent: "",
    rentPrefilled: true,
    occupancyLongTermPercent: "",
    occupancyShortTermPercent: "",
  },
  exit: { sellingCommissionPercent: "4", municipalCapitalGainsTax: "3.500", plusvaliaPrefilled: true },
  listingOrigin: null,
};

/**
 * Passes assembly, then fails the engine's own permit rule: no tourist
 * licence, short-term strategy. A real ValidationError from runEngine,
 * not a mocked throw - the failure path is exercised by the code that
 * actually raises it.
 */
const uncomputable: WizardData = {
  ...computable,
  staatEnLasten: { ...computable.staatEnLasten, hasTouristRentalLicense: "no" },
  belegger: { ...computable.belegger, rentalStrategy: "shortTerm" },
};

/** Unparseable rather than contradictory - buildEngineInput's own failure mode. */
const unassemblable: WizardData = {
  ...computable,
  pand: { ...computable.pand, purchasePrice: "" },
};

/** Opens an intent, pays it, and parks `data` against it - bypassing the app's own gate. */
async function paidPendingFor(data: WizardData, amount = REPORT_PRICE_CENTS): Promise<string> {
  const intent = await createPaymentIntent({ amount, currency: REPORT_CURRENCY });
  await confirmPayment({ clientSecret: intent.client_secret, cardNumber: TEST_CARDS.success });

  const token = await storePendingInput({ data, paymentIntentId: intent.id });
  cookieValue = token;
  return token;
}

beforeEach(() => {
  cookieValue = undefined;
  cookieWrites.length = 0;
});

describe("an underpayment does not release the report", () => {
  it("refuses a succeeded intent for the wrong amount", async () => {
    const token = await paidPendingFor(computable, 1);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(402);
    expect(body.result).toBeUndefined();
    expect(body.error).toContain("bedrag");

    // The input is still there, so the situation can be settled by hand.
    expect(await readPendingInput(token)).not.toBeNull();
    expect(cookieWrites).toHaveLength(0);
  });

  it("releases the same input once the amount is right, so the amount really is the discriminator", async () => {
    const token = await paidPendingFor(computable, REPORT_PRICE_CENTS);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);

    // The anchor, straight out of the release route: base scenario, 3.8
    // at percentile 70, the pair engine.test.ts pins against the engine.
    const base = body.result.scenarioOutcomes.find(
      (outcome: { scenario: string }) => outcome.scenario === "base",
    );
    expect(base.score.total).toBe(3.8);
    expect(base.percentile).toBe(70);
    expect(await readPendingInput(token)).toBeNull();
  });
});

describe("runEngine failing after payment leaves everything recoverable", () => {
  it("refuses with an explanation and a contact address", async () => {
    await paidPendingFor(uncomputable);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.result).toBeUndefined();
    expect(body.error).toContain("betaling is gelukt");
    expect(body.error).toContain("niets kwijt");
    expect(body.contact).toBeTruthy();
  });

  it("does NOT consume the input - the failure stays reproducible", async () => {
    const token = await paidPendingFor(uncomputable);

    await POST();

    const stillThere = await readPendingInput(token);
    expect(stillThere).not.toBeNull();
    expect(stillThere!.data.belegger.rentalStrategy).toBe("shortTerm");
  });

  it("does NOT clear the cookie - the customer keeps their handle on the payment", async () => {
    await paidPendingFor(uncomputable);

    await POST();

    expect(cookieWrites).toHaveLength(0);
  });

  it("leaves the payment untouched, so it can be settled or refunded by hand", async () => {
    const token = await paidPendingFor(uncomputable);
    const pending = await readPendingInput(token);

    await POST();

    const intent = await retrievePaymentIntent(pending!.paymentIntentId);
    expect(intent!.status).toBe("succeeded");
    expect(intent!.amount).toBe(REPORT_PRICE_CENTS);
  });

  it("is repeatable - a second attempt fails identically rather than half-releasing", async () => {
    const token = await paidPendingFor(uncomputable);

    const first = await POST();
    const second = await POST();

    expect(first.status).toBe(500);
    expect(second.status).toBe(500);
    expect(await readPendingInput(token)).not.toBeNull();
    expect(cookieWrites).toHaveLength(0);
  });

  it("treats unassemblable input the same way", async () => {
    const token = await paidPendingFor(unassemblable);

    const response = await POST();

    expect(response.status).toBe(500);
    expect(await readPendingInput(token)).not.toBeNull();
    expect(cookieWrites).toHaveLength(0);
  });
});

describe("a successful release consumes exactly once", () => {
  it("clears the cookie and takes the input", async () => {
    const token = await paidPendingFor(computable);

    const response = await POST();
    expect(response.status).toBe(200);

    // Cleared by writing an empty value - which is what removes it.
    expect(cookieWrites).toHaveLength(1);
    expect(cookieWrites[0]).toEqual({ name: PENDING_INPUT_COOKIE, value: "" });
    expect(await readPendingInput(token)).toBeNull();

    // And a replay has nothing left.
    const replay = await POST();
    expect(replay.status).toBe(404);
  });
});
