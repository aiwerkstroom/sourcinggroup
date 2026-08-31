// @vitest-environment jsdom

/**
 * Isolated unit test for the real Supabase Auth backend (the live swap
 * task), driven against a fake @supabase/supabase-js client - the same
 * approach app/rapport/betalen/_lib/__tests__/pending-input-supabase.test.ts
 * already established for the pending-input adapter.
 *
 * WHAT THIS PROVES, AND WHAT IT CANNOT. It proves this file's own hand-written
 * logic: email/password validation before a call is even made, the Dutch
 * translation of Supabase's English error messages, the two distinct
 * signUp() outcomes (a session, or none because email confirmation is
 * pending), and that the session cookie middleware.ts reads is written or
 * cleared exactly when the SDK's own onAuthStateChange says the session
 * changed - never anywhere else. It proves NOTHING about Supabase itself:
 * the client is a fake, no request is ever sent, and whether
 * auth.signUp() on the real project behaves exactly as the Supabase docs
 * describe is a live-environment question this sandbox cannot answer (its
 * egress policy blocks *.supabase.co outright, confirmed again for this
 * task).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

const auth = await import("../auth-supabase");

interface FakeAuthOverrides {
  signUp?: ReturnType<typeof vi.fn>;
  signInWithPassword?: ReturnType<typeof vi.fn>;
  signOut?: ReturnType<typeof vi.fn>;
  getSession?: ReturnType<typeof vi.fn>;
  onAuthStateChange?: ReturnType<typeof vi.fn>;
}

function fakeClient(overrides: FakeAuthOverrides = {}) {
  const unsubscribe = vi.fn();
  return {
    auth: {
      signUp: overrides.signUp ?? vi.fn(),
      signInWithPassword: overrides.signInWithPassword ?? vi.fn(),
      signOut: overrides.signOut ?? vi.fn(async () => ({ error: null })),
      getSession: overrides.getSession ?? vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange:
        overrides.onAuthStateChange ??
        vi.fn(() => ({ data: { subscription: { unsubscribe } } })),
    },
    _unsubscribe: unsubscribe,
  };
}

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

beforeEach(() => {
  auth.resetSupabaseAuthClientForTests();
  createClient.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";
  document.cookie = "tsg-session=; path=/; max-age=0";
});

afterEach(() => {
  if (ORIGINAL_URL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
  if (ORIGINAL_ANON_KEY === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_ANON_KEY;
});

describe("configuration - fails loudly rather than falling back silently", () => {
  it("throws when NEXT_PUBLIC_SUPABASE_URL or the anon key is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    await expect(auth.signIn("a@example.com", "wachtwoord123")).rejects.toThrow(
      /Supabase is not configured/,
    );
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("signUp()", () => {
  it("rejects an empty email or password before ever calling the SDK", async () => {
    const result = await auth.signUp("", "wachtwoord123");
    expect(result.user).toBeNull();
    expect(result.error).toBe("E-mailadres en wachtwoord zijn verplicht.");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects a password under 8 characters before ever calling the SDK", async () => {
    const result = await auth.signUp("a@example.com", "kort");
    expect(result.error).toBe("Wachtwoord moet minstens 8 tekens zijn.");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns the user when signUp() establishes a session immediately", async () => {
    const signUp = vi.fn(async () => ({
      data: {
        user: { id: "user-1", email: "new@example.com" },
        session: { user: { id: "user-1", email: "new@example.com" } },
      },
      error: null,
    }));
    createClient.mockReturnValue(fakeClient({ signUp }));

    const result = await auth.signUp("New@Example.com", "wachtwoord123");

    expect(signUp).toHaveBeenCalledWith({ email: "new@example.com", password: "wachtwoord123" });
    expect(result.error).toBeNull();
    expect(result.user).toEqual({ id: "user-1", email: "new@example.com" });
  });

  it("reports a distinct, actionable message when signUp() succeeds but leaves no session (email confirmation pending)", async () => {
    const signUp = vi.fn(async () => ({
      data: { user: { id: "user-2", email: "pending@example.com" }, session: null },
      error: null,
    }));
    createClient.mockReturnValue(fakeClient({ signUp }));

    const result = await auth.signUp("pending@example.com", "wachtwoord123");

    // Not the generic "signed in" outcome - redirecting into a protected
    // route here would just bounce straight back at middleware.ts with no
    // explanation, since no session cookie was ever set.
    expect(result.user).toBeNull();
    expect(result.error).toContain("Bevestig uw e-mailadres");
  });

  it("translates 'already registered' to the same Dutch copy the mock backend uses", async () => {
    const signUp = vi.fn(async () => ({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    }));
    createClient.mockReturnValue(fakeClient({ signUp }));

    const result = await auth.signUp("existing@example.com", "wachtwoord123");
    expect(result.error).toBe("Er bestaat al een account met dit e-mailadres.");
  });
});

describe("signIn()", () => {
  it("returns the user on success", async () => {
    const signInWithPassword = vi.fn(async () => ({
      data: { user: { id: "user-3", email: "ok@example.com" } },
      error: null,
    }));
    createClient.mockReturnValue(fakeClient({ signInWithPassword }));

    const result = await auth.signIn("ok@example.com", "wachtwoord123");
    expect(result.error).toBeNull();
    expect(result.user).toEqual({ id: "user-3", email: "ok@example.com" });
  });

  it("translates 'Invalid login credentials' to the same wrong-password copy the mock backend uses", async () => {
    const signInWithPassword = vi.fn(async () => ({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    }));
    createClient.mockReturnValue(fakeClient({ signInWithPassword }));

    const result = await auth.signIn("wrong@example.com", "fout");
    expect(result.user).toBeNull();
    expect(result.error).toBe("E-mailadres of wachtwoord onjuist.");
  });

  it("translates 'Email not confirmed' to a distinct, actionable Dutch message", async () => {
    const signInWithPassword = vi.fn(async () => ({
      data: { user: null },
      error: { message: "Email not confirmed" },
    }));
    createClient.mockReturnValue(fakeClient({ signInWithPassword }));

    const result = await auth.signIn("unconfirmed@example.com", "wachtwoord123");
    expect(result.error).toContain("Bevestig eerst uw e-mailadres");
  });
});

describe("signOut()", () => {
  it("calls the SDK's own signOut()", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    createClient.mockReturnValue(fakeClient({ signOut }));

    await auth.signOut();
    expect(signOut).toHaveBeenCalledOnce();
  });
});

describe("getSession()", () => {
  it("returns null when the SDK holds no session", async () => {
    createClient.mockReturnValue(fakeClient());
    expect(await auth.getSession()).toBeNull();
  });

  it("maps the SDK's session to AuthUser when one exists", async () => {
    const getSession = vi.fn(async () => ({
      data: { session: { user: { id: "user-4", email: "session@example.com" } } },
    }));
    createClient.mockReturnValue(fakeClient({ getSession }));

    expect(await auth.getSession()).toEqual({ id: "user-4", email: "session@example.com" });
  });
});

describe("subscribeToSessionChanges() - the one writer of the marker cookie middleware.ts reads", () => {
  it("sets the cookie and calls onChange when the SDK reports a session", () => {
    let deliver: (event: string, session: unknown) => void = () => {};
    const onAuthStateChange = vi.fn((cb: typeof deliver) => {
      deliver = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    createClient.mockReturnValue(fakeClient({ onAuthStateChange }));

    const onChange = vi.fn();
    auth.subscribeToSessionChanges(onChange);

    deliver("SIGNED_IN", { user: { id: "user-5", email: "live@example.com" } });

    expect(document.cookie).toContain("tsg-session=1");
    expect(onChange).toHaveBeenCalledWith({ id: "user-5", email: "live@example.com" });
  });

  it("clears the cookie and calls onChange(null) when the SDK reports no session", () => {
    let deliver: (event: string, session: unknown) => void = () => {};
    const onAuthStateChange = vi.fn((cb: typeof deliver) => {
      deliver = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    createClient.mockReturnValue(fakeClient({ onAuthStateChange }));
    document.cookie = "tsg-session=1; path=/; max-age=604800";

    const onChange = vi.fn();
    auth.subscribeToSessionChanges(onChange);
    deliver("SIGNED_OUT", null);

    expect(document.cookie).not.toContain("tsg-session=");
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("unsubscribing calls the SDK's own unsubscribe()", () => {
    const client = fakeClient();
    createClient.mockReturnValue(client);

    const unsubscribe = auth.subscribeToSessionChanges(vi.fn());
    unsubscribe();

    expect(client._unsubscribe).toHaveBeenCalledOnce();
  });
});

/**
 * The fix for this task: a session object is not automatically current
 * just because the SDK handed one back. @supabase/auth-js reads a
 * cached session from localStorage with no server round trip whenever
 * it is more than 90 seconds from its OWN claimed expires_at
 * (EXPIRY_MARGIN_MS, GoTrueClient's __loadSession()) - so a session
 * revoked on the Supabase side keeps arriving here as non-null for up
 * to its access token's remaining lifetime. These tests exercise the
 * one part of that this file can act on without a network round trip:
 * a session whose own expires_at has already passed.
 */
describe("subscribeToSessionChanges() - a session already past its own expires_at is treated as no session", () => {
  function deliverVia(onAuthStateChange: ReturnType<typeof vi.fn>) {
    let deliver: (event: string, session: unknown) => void = () => {};
    onAuthStateChange.mockImplementation((cb: typeof deliver) => {
      deliver = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    return (event: string, session: unknown) => deliver(event, session);
  }

  it("clears the cookie for a session object whose expires_at is already in the past", () => {
    const onAuthStateChange = vi.fn();
    createClient.mockReturnValue(fakeClient({ onAuthStateChange }));
    const deliver = deliverVia(onAuthStateChange);
    document.cookie = "tsg-session=1; path=/; max-age=604800";

    const onChange = vi.fn();
    auth.subscribeToSessionChanges(onChange);
    const expiredSecondsAgo = Math.floor(Date.now() / 1000) - 3600;
    deliver("TOKEN_REFRESHED", {
      user: { id: "user-6", email: "stale@example.com" },
      expires_at: expiredSecondsAgo,
    });

    expect(document.cookie).not.toContain("tsg-session=1");
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("keeps the cookie for a session whose expires_at is still in the future", () => {
    const onAuthStateChange = vi.fn();
    createClient.mockReturnValue(fakeClient({ onAuthStateChange }));
    const deliver = deliverVia(onAuthStateChange);

    const onChange = vi.fn();
    auth.subscribeToSessionChanges(onChange);
    const expiresInOneHour = Math.floor(Date.now() / 1000) + 3600;
    deliver("SIGNED_IN", {
      user: { id: "user-7", email: "fresh@example.com" },
      expires_at: expiresInOneHour,
    });

    expect(document.cookie).toContain("tsg-session=1");
    expect(onChange).toHaveBeenCalledWith({ id: "user-7", email: "fresh@example.com" });
  });

  it("still trusts a session that carries no expires_at at all, rather than treating the field's absence as expiry", () => {
    // Defensive default: the real SDK always sets expires_at, but nothing
    // here should invent an expiry the SDK itself did not claim.
    const onAuthStateChange = vi.fn();
    createClient.mockReturnValue(fakeClient({ onAuthStateChange }));
    const deliver = deliverVia(onAuthStateChange);

    const onChange = vi.fn();
    auth.subscribeToSessionChanges(onChange);
    deliver("SIGNED_IN", { user: { id: "user-8", email: "no-expiry@example.com" } });

    expect(document.cookie).toContain("tsg-session=1");
    expect(onChange).toHaveBeenCalledWith({ id: "user-8", email: "no-expiry@example.com" });
  });

  it("still clears the cookie for the unconditional case this fix leaves untouched: session === null", () => {
    const onAuthStateChange = vi.fn();
    createClient.mockReturnValue(fakeClient({ onAuthStateChange }));
    const deliver = deliverVia(onAuthStateChange);
    document.cookie = "tsg-session=1; path=/; max-age=604800";

    const onChange = vi.fn();
    auth.subscribeToSessionChanges(onChange);
    deliver("SIGNED_OUT", null);

    expect(document.cookie).not.toContain("tsg-session=1");
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
