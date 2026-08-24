/**
 * Pins the backend selection in auth-client.ts (the live Auth swap) - the
 * file that has to be right for the swap to be safe, so it is tested as
 * its own unit rather than trusted to a comment. Same intent as
 * app/rapport/betalen/_lib/__tests__/pending-input-selection.test.ts for
 * the pending-input store's own selection.
 *
 * The claim under test: the in-memory backend is unreachable by omission
 * and reachable only by an exact, deliberate opt-in - and a `forced`
 * value, when given, always wins over the environment. Unlike
 * pending-input.ts's selection (a module-level constant, read once at
 * import), resolveAuthBackend() is a function re-evaluated on every call,
 * so this file needs no vi.resetModules() dance to exercise every branch.
 *
 * Only imports auth-memory.ts and auth-supabase.ts to compare function
 * identity - never calls anything on either, so this file needs no
 * Supabase SDK mock at all.
 */

import { afterEach, describe, expect, it } from "vitest";
import * as memory from "../auth-memory";
import { resolveAuthBackend } from "../auth-client";
import * as supabaseAuth from "../auth-supabase";

const ENV_VAR = "TSG_AUTH_STORE";
const originalValue = process.env[ENV_VAR];

afterEach(() => {
  if (originalValue === undefined) delete process.env[ENV_VAR];
  else process.env[ENV_VAR] = originalValue;
});

describe("no forced value - falls through to process.env.TSG_AUTH_STORE", () => {
  it("resolves to the Supabase backend when the env var is unset", () => {
    delete process.env[ENV_VAR];
    const backend = resolveAuthBackend(undefined);
    expect(backend.signUp).toBe(supabaseAuth.signUp);
    expect(backend.signUp).not.toBe(memory.signUp);
  });

  it("resolves to the in-memory backend when the env var is exactly 'memory'", () => {
    process.env[ENV_VAR] = "memory";
    const backend = resolveAuthBackend(undefined);
    expect(backend.signUp).toBe(memory.signUp);
  });

  it.each([
    ["an empty string", ""],
    ["the wrong case", "Memory"],
    ["a trailing space", "memory "],
    ["a plausible typo", "memmory"],
    ["an unrelated value", "supabase"],
  ])("%s resolves to Supabase, never a silent fallback to memory", (_label, value) => {
    process.env[ENV_VAR] = value;
    const backend = resolveAuthBackend(undefined);
    expect(backend.signUp).toBe(supabaseAuth.signUp);
  });
});

describe("a forced value - what app/layout.tsx passes down - always wins over the environment", () => {
  it("forces memory even when the env var says otherwise", () => {
    process.env[ENV_VAR] = "";
    const backend = resolveAuthBackend("memory");
    expect(backend.signUp).toBe(memory.signUp);
  });

  it("forces Supabase even when the env var says 'memory'", () => {
    process.env[ENV_VAR] = "memory";
    const backend = resolveAuthBackend("supabase");
    expect(backend.signUp).toBe(supabaseAuth.signUp);
  });

  it("an empty forced string is still a forced value, not 'no override' - and resolves to Supabase", () => {
    process.env[ENV_VAR] = "memory";
    const backend = resolveAuthBackend("");
    expect(backend.signUp).toBe(supabaseAuth.signUp);
  });
});

describe("both backends satisfy the same contract", () => {
  it("expose the same five functions, both real (not undefined)", () => {
    for (const name of [
      "signUp",
      "signIn",
      "signOut",
      "getSession",
      "subscribeToSessionChanges",
    ] as const) {
      expect(typeof memory[name]).toBe("function");
      expect(typeof supabaseAuth[name]).toBe("function");
    }
  });
});
