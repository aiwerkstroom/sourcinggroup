import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pins the store selection in pending-input.ts (fase 4 stap 3, live
 * swap). This is the file that has to be right for the swap to be safe,
 * so it is tested as its own unit rather than trusted to a comment.
 *
 * The claim under test: the in-memory Map is unreachable by omission and
 * reachable only by an exact, deliberate opt-in. The design that was
 * rejected - "Supabase if configured, else the Map" - fails open, because
 * a missing key in production quietly restores the per-process store and
 * nobody learns about it until a customer has paid and lost their report.
 * Every case below exists to prove this selection cannot do that.
 *
 * Each test re-imports the module with vi.resetModules(), because
 * pending-input.ts reads the environment once at load time (deliberately
 * - which store a process talks to should not vary per request).
 */

const ENV_VAR = "TSG_PENDING_STORE";

async function loadWith(value: string | undefined) {
  vi.resetModules();
  if (value === undefined) delete process.env[ENV_VAR];
  else process.env[ENV_VAR] = value;

  const [selected, memory, supabase] = await Promise.all([
    import("../pending-input"),
    import("../pending-input-memory"),
    import("../pending-input-supabase"),
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

    expect(selected.storePendingInput).toBe(supabase.storePendingInput);
    expect(selected.readPendingInput).toBe(supabase.readPendingInput);
    expect(selected.takePendingInput).toBe(supabase.takePendingInput);

    expect(selected.storePendingInput).not.toBe(memory.storePendingInput);
    expect(selected.readPendingInput).not.toBe(memory.readPendingInput);
    expect(selected.takePendingInput).not.toBe(memory.takePendingInput);
  });
});

describe("the fail-safe property: anything other than the exact opt-in gets Supabase", () => {
  // A typo, a stale value, a half-set variable. None of these may quietly
  // land on the Map - the selection has to fall to the real store and let
  // the missing-key error speak, rather than silently degrade.
  it.each([
    ["an empty string", ""],
    ["the wrong case", "Memory"],
    ["a trailing space", "memory "],
    ["a plausible typo", "memmory"],
    ["an unrelated value", "supabase"],
    ["a truthy-looking value", "true"],
  ])("%s resolves to Supabase", async (_label, value) => {
    const { selected, supabase, memory } = await loadWith(value);

    expect(selected.storePendingInput).toBe(supabase.storePendingInput);
    expect(selected.storePendingInput).not.toBe(memory.storePendingInput);
  });
});

describe("the exact opt-in - what the route-level golden tests set", () => {
  it("resolves to the in-memory store", async () => {
    const { selected, memory, supabase } = await loadWith("memory");

    expect(selected.storePendingInput).toBe(memory.storePendingInput);
    expect(selected.readPendingInput).toBe(memory.readPendingInput);
    expect(selected.takePendingInput).toBe(memory.takePendingInput);

    expect(selected.storePendingInput).not.toBe(supabase.storePendingInput);
  });

  it("is the value the exported constant names, so a test cannot drift from it", async () => {
    const { selected } = await loadWith("memory");
    expect(selected.MEMORY_STORE_ENV_VALUE).toBe("memory");
  });
});

describe("a missing Supabase key fails loudly rather than falling back", () => {
  it("throws when the default store is used without configuration", async () => {
    const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    try {
      const { selected } = await loadWith(undefined);
      // The point of the whole design: this is an error, not a quiet
      // write into a Map that the next request cannot read.
      await expect(
        selected.storePendingInput({
          data: {} as never,
          paymentIntentId: "pi_missing_config",
        }),
      ).rejects.toThrow(/Supabase is not configured/);
    } finally {
      if (savedUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
      if (savedKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
    }
  });
});

describe("the contract is identical whichever store is selected", () => {
  it("exports the cookie name and TTL from the shared contract in both cases", async () => {
    const withMemory = await loadWith("memory");
    const withSupabase = await loadWith(undefined);

    expect(withMemory.selected.PENDING_INPUT_COOKIE).toBe(
      withSupabase.selected.PENDING_INPUT_COOKIE,
    );
    expect(withMemory.selected.PENDING_TTL_MS).toBe(withSupabase.selected.PENDING_TTL_MS);
  });

  it("both implementations expose the same three functions with the same arity", async () => {
    const { memory, supabase } = await loadWith(undefined);

    for (const name of ["storePendingInput", "readPendingInput", "takePendingInput"] as const) {
      expect(typeof memory[name]).toBe("function");
      expect(typeof supabase[name]).toBe("function");
      expect(memory[name].length).toBe(supabase[name].length);
    }
  });
});
