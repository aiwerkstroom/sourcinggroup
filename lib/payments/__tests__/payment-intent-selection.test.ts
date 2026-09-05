import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pins the store selection in payment-intent-store.ts. This is the file
 * that has to be right for the swap to be safe, so it is tested as its
 * own unit rather than trusted to a comment - exactly as
 * pending-input-selection.test.ts does for the pending-input swap.
 *
 * The claim under test: the in-memory Map is unreachable by omission and
 * reachable only by an exact, deliberate opt-in. The design that was
 * rejected - "Supabase if configured, else the Map" - fails open, and
 * failing open here is not hypothetical: the Map in production is the bug
 * that sent every paying customer from the end of step 4 back to step 1
 * of the wizard, silently, with no error anywhere. Every case below
 * exists to prove this selection cannot bring that back by accident.
 *
 * Each test re-imports the module with vi.resetModules(), because
 * payment-intent-store.ts reads the environment once at load time
 * (deliberately - which store a process talks to should not vary per
 * request).
 *
 * NOTE: vitest.setup.ts sets TSG_PAYMENT_STORE=memory for the whole
 * suite, so every case here sets or deletes it explicitly. Testing "the
 * default" means deleting it, not leaving it alone.
 */

const ENV_VAR = "TSG_PAYMENT_STORE";

async function loadWith(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) delete process.env[ENV_VAR];
  else process.env[ENV_VAR] = value;

  const [selected, memory, supabase] = await Promise.all([
    import("../payment-intent-store"),
    import("../payment-intent-memory"),
    import("../payment-intent-supabase"),
  ]);
  return { selected, memory, supabase };
}

const originalValue = process.env[ENV_VAR];

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  if (originalValue === undefined) delete process.env[ENV_VAR];
  else process.env[ENV_VAR] = originalValue;
  vi.resetModules();
});

describe("with no opt-in - production, preview, and every ordinary run", () => {
  it("resolves to the Supabase adapter, not the Map", async () => {
    const { selected, supabase, memory } = await loadWith(undefined);

    expect(selected.storePaymentIntent).toBe(supabase.storePaymentIntent);
    expect(selected.readPaymentIntent).toBe(supabase.readPaymentIntent);
    expect(selected.writePaymentIntentStatus).toBe(supabase.writePaymentIntentStatus);
    expect(selected.sweepExpiredPaymentIntents).toBe(supabase.sweepExpiredPaymentIntents);

    expect(selected.storePaymentIntent).not.toBe(memory.storePaymentIntent);
    expect(selected.readPaymentIntent).not.toBe(memory.readPaymentIntent);
    expect(selected.writePaymentIntentStatus).not.toBe(memory.writePaymentIntentStatus);
    expect(selected.sweepExpiredPaymentIntents).not.toBe(memory.sweepExpiredPaymentIntents);
  });
});

describe("the fail-safe property: anything other than the exact opt-in gets Supabase", () => {
  // A typo, a stale value, a half-set variable. None of these may quietly
  // land on the Map - the selection has to fall to the real store and let
  // the missing-key error speak, rather than silently degrade into the
  // exact failure this whole change exists to end.
  it.each([
    ["an empty string", ""],
    ["the wrong case", "Memory"],
    ["a trailing space", "memory "],
    ["a plausible typo", "memmory"],
    ["an unrelated value", "supabase"],
    ["the other store's value", "true"],
  ])("%s resolves to Supabase", async (_label, value) => {
    const { selected, supabase, memory } = await loadWith(value);
    expect(selected.readPaymentIntent).toBe(supabase.readPaymentIntent);
    expect(selected.readPaymentIntent).not.toBe(memory.readPaymentIntent);
  });
});

describe("the exact opt-in, and only the exact opt-in, reaches the Map", () => {
  it('resolves to the in-memory adapter for exactly "memory"', async () => {
    const { selected, memory, supabase } = await loadWith("memory");

    expect(selected.storePaymentIntent).toBe(memory.storePaymentIntent);
    expect(selected.readPaymentIntent).toBe(memory.readPaymentIntent);
    expect(selected.writePaymentIntentStatus).toBe(memory.writePaymentIntentStatus);
    expect(selected.sweepExpiredPaymentIntents).toBe(memory.sweepExpiredPaymentIntents);

    expect(selected.storePaymentIntent).not.toBe(supabase.storePaymentIntent);
  });

  it("exposes the opt-in string as a constant, so a test never retypes the literal", async () => {
    const { selected } = await loadWith("memory");
    expect(selected.MEMORY_STORE_ENV_VALUE).toBe("memory");
  });
});
