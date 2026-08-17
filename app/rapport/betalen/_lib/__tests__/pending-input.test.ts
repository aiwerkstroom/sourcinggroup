/**
 * Golden test for the pending-input store (fase 4 stap 2).
 *
 * Two behaviours carry real weight here and the rest is bookkeeping:
 *
 * - read does not consume, take does. The payment page has to show what
 *   is being paid for before a payment exists, and the release step has
 *   to make sure one payment releases exactly one report - a replayed
 *   request must find nothing.
 * - an expired entry reads as absent. The TTL is the only thing keeping
 *   this inside the phase's "nothing is stored permanently" boundary, so
 *   it is tested against the clock rather than assumed from the constant.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_BELEGGER,
  EMPTY_EXIT,
  EMPTY_PAND,
  EMPTY_STAAT_EN_LASTEN,
} from "@/app/rapport/nieuw/_state/wizard-state";
import type { WizardData } from "@/app/rapport/nieuw/_state/wizard-state";
import { readPendingInput, storePendingInput, takePendingInput } from "../pending-input";

/**
 * The store never looks inside the data it holds, so the emptiest legal
 * WizardData is the honest fixture: anything richer would suggest this
 * layer cares about the contents. Only the address is filled, to prove it
 * survives the round trip unchanged.
 */
const wizardData: WizardData = {
  pand: { ...EMPTY_PAND, address: "Carrer de Prova 1, Valencia" },
  staatEnLasten: EMPTY_STAAT_EN_LASTEN,
  belegger: EMPTY_BELEGGER,
  exit: EMPTY_EXIT,
  listingOrigin: null,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("storePendingInput", () => {
  it("returns an opaque token, not anything derived from the input", async () => {
    const token = await storePendingInput({ data: wizardData, paymentIntentId: "pi_one" });

    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    expect(token).not.toContain("Prova");
    expect(token).not.toContain("pi_one");
  });

  it("gives every entry its own token", async () => {
    const first = await storePendingInput({ data: wizardData, paymentIntentId: "pi_a" });
    const second = await storePendingInput({ data: wizardData, paymentIntentId: "pi_b" });
    expect(first).not.toBe(second);
  });
});

describe("readPendingInput", () => {
  it("returns the input and the intent it belongs to", async () => {
    const token = await storePendingInput({ data: wizardData, paymentIntentId: "pi_read" });
    const entry = await readPendingInput(token);

    expect(entry).not.toBeNull();
    expect(entry!.paymentIntentId).toBe("pi_read");
    expect(entry!.data.pand.address).toBe("Carrer de Prova 1, Valencia");
  });

  it("does not consume - the payment page can read before the release does", async () => {
    const token = await storePendingInput({ data: wizardData, paymentIntentId: "pi_peek" });

    expect(await readPendingInput(token)).not.toBeNull();
    expect(await readPendingInput(token)).not.toBeNull();
    expect(await readPendingInput(token)).not.toBeNull();
  });

  it("returns null for an unknown token", async () => {
    expect(await readPendingInput("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("takePendingInput", () => {
  it("returns the entry once and nothing after - one payment, one report", async () => {
    const token = await storePendingInput({ data: wizardData, paymentIntentId: "pi_take" });

    const first = await takePendingInput(token);
    expect(first).not.toBeNull();
    expect(first!.paymentIntentId).toBe("pi_take");

    // A replayed release request finds nothing to release.
    expect(await takePendingInput(token)).toBeNull();
    expect(await readPendingInput(token)).toBeNull();
  });

  it("returns null for an unknown token", async () => {
    expect(await takePendingInput("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});

describe("expiry - nothing outlives the checkout it belongs to", () => {
  it("still reads inside the TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const token = await storePendingInput({ data: wizardData, paymentIntentId: "pi_fresh" });

    vi.setSystemTime(new Date("2026-01-01T12:29:00Z"));
    expect(await readPendingInput(token)).not.toBeNull();
  });

  it("reads as absent past the TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const token = await storePendingInput({ data: wizardData, paymentIntentId: "pi_stale" });

    vi.setSystemTime(new Date("2026-01-01T12:31:00Z"));
    expect(await readPendingInput(token)).toBeNull();
    expect(await takePendingInput(token)).toBeNull();
  });

  it("an abandoned checkout cannot be released later", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const token = await storePendingInput({ data: wizardData, paymentIntentId: "pi_abandoned" });

    vi.setSystemTime(new Date("2026-01-02T12:00:00Z"));
    expect(await takePendingInput(token)).toBeNull();
  });
});
