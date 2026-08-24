/**
 * The in-memory Auth backend - what fase 4 stap 1 built when this
 * sandbox's egress policy blocked *.supabase.co outright (confirmed via
 * the proxy's own status endpoint reporting a 403 policy denial, not
 * assumed), and what auth-client.ts still selects for the component test
 * suite (vitest.config.ts sets TSG_AUTH_STORE=memory for every test run)
 * and for the same explicit-opt-in reason pending-input-memory.ts is kept
 * for its own route-level golden tests.
 *
 * It is NOT what a deployed app runs on. auth-client.ts is the swap
 * point: production has no opt-in set, so it resolves to auth-supabase.ts,
 * the real SDK. This file's only remaining job is to give the test suite
 * something deterministic, network-free, and behaviourally identical in
 * shape to run against - the same role the in-memory pending-input store
 * plays for its own golden tests.
 *
 * Client-only, by design. signUp()/signIn() validate against an
 * in-memory user registry that only this browser tab's JS runtime holds.
 * What DOES need to survive a full page load - and what middleware.ts
 * checks server-side, before any client JS has run - is the session, so
 * that part is a cookie, not memory.
 *
 * Passwords are compared in plaintext, in memory, never sent anywhere or
 * written to disk. Fine for a throwaway test double; the real backend in
 * auth-supabase.ts is what actually handles credentials.
 */

import type { AuthBackend, AuthResult, AuthUser } from "./auth-contract";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./auth-contract";

interface StoredUser extends AuthUser {
  password: string;
}

// globalThis-backed rather than a plain module-level Map: fase 3's PDF
// work found, empirically, that Next.js can give the same module
// separate instances across different bundles even within one process.
// This backend only ever runs client-side, so that specific failure mode
// does not apply here - but Fast Refresh during development re-evaluates
// client modules too, and globalThis survives that the same way. Cheap
// insurance either way, and it is the exact fix that already worked once.
const globalKey = Symbol.for("tsg.memoryAuthUsers");
type GlobalWithUsers = typeof globalThis & { [globalKey]?: Map<string, StoredUser> };
const g = globalThis as GlobalWithUsers;
const users = (g[globalKey] ??= new Map<string, StoredUser>());

type Listener = (user: AuthUser | null) => void;
const listeners = new Set<Listener>();

function notify(user: AuthUser | null): void {
  for (const listener of listeners) listener(user);
}

function setSessionCookie(user: AuthUser): void {
  const value = encodeURIComponent(JSON.stringify(user));
  document.cookie = `${SESSION_COOKIE}=${value}; path=/; max-age=${SESSION_MAX_AGE_SECONDS}; samesite=lax`;
}

function clearSessionCookie(): void {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
}

function readSessionCookie(): AuthUser | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`));
  if (match === null) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(match[1]!));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      "email" in parsed &&
      typeof parsed.id === "string" &&
      typeof parsed.email === "string"
    ) {
      return { id: parsed.id, email: parsed.email };
    }
    return null;
  } catch {
    return null;
  }
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  if (normalized === "" || password === "") {
    return { user: null, error: "E-mailadres en wachtwoord zijn verplicht." };
  }
  if (users.has(normalized)) {
    return { user: null, error: "Er bestaat al een account met dit e-mailadres." };
  }
  if (password.length < 8) {
    return { user: null, error: "Wachtwoord moet minstens 8 tekens zijn." };
  }

  const user: AuthUser = { id: crypto.randomUUID(), email: normalized };
  users.set(normalized, { ...user, password });
  setSessionCookie(user);
  notify(user);
  return { user, error: null };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  const stored = users.get(normalized);
  if (stored === undefined || stored.password !== password) {
    return { user: null, error: "E-mailadres of wachtwoord onjuist." };
  }

  const user: AuthUser = { id: stored.id, email: stored.email };
  setSessionCookie(user);
  notify(user);
  return { user, error: null };
}

export async function signOut(): Promise<void> {
  clearSessionCookie();
  notify(null);
}

export async function getSession(): Promise<AuthUser | null> {
  return readSessionCookie();
}

const SESSION_POLL_MS = 1000;

/**
 * Fires once immediately with the current session, then keeps listening
 * for changes this module's own signUp()/signIn()/signOut() did not
 * cause: another tab signing out or in, or the cookie simply expiring.
 * The Cookie Store API's `change` event covers that where the browser
 * implements it (Chromium); a short interval poll is the fallback where
 * it does not (Firefox, Safari at the time of writing).
 */
export function subscribeToSessionChanges(onChange: Listener): () => void {
  listeners.add(onChange);
  void getSession().then(onChange);

  const cookieStore = (globalThis as typeof globalThis & { cookieStore?: EventTarget })
    .cookieStore;
  const refresh = () => void getSession().then(onChange);

  let interval: ReturnType<typeof setInterval> | undefined;
  if (cookieStore !== undefined) {
    cookieStore.addEventListener("change", refresh);
  } else {
    interval = setInterval(refresh, SESSION_POLL_MS);
  }

  return () => {
    listeners.delete(onChange);
    if (cookieStore !== undefined) cookieStore.removeEventListener("change", refresh);
    else clearInterval(interval);
  };
}

const _shapeCheck: AuthBackend = {
  signUp,
  signIn,
  signOut,
  getSession,
  subscribeToSessionChanges,
};
void _shapeCheck;
