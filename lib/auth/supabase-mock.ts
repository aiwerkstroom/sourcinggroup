/**
 * Mock Auth service for this sandbox (fase 4 stap 1) - zero external
 * calls, no Supabase network dependency. This sandbox's own egress policy
 * blocks *.supabase.co outright (confirmed via the proxy's own status
 * endpoint reporting a 403 policy denial, not assumed), so the real
 * Supabase SDK cannot be reached or tested from here at all.
 *
 * Swapping this out for the real SDK once outside the sandbox is meant to
 * stay a small, contained change: replace this file's body with
 * `import { createClient } from "@supabase/supabase-js"` and a client
 * built from NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY
 * (already in .env.local). useAuth.ts and every page that calls it stay
 * untouched, since they only depend on this file's exported shape
 * (AuthUser, signUp, signIn, signOut, getSession) - the same shape a thin
 * real-SDK wrapper would expose, not Supabase's own nested
 * {data, error} response shape.
 *
 * Client-only, by design. signUp()/signIn() validate against an
 * in-memory user registry that only this browser tab's JS runtime holds
 * - a real signup flow calls a server, but this mock does not need to
 * (this task's own "nul externe calls" instruction). What DOES need to
 * survive a full page load - and what middleware.ts checks server-side,
 * before any client JS has run - is the session, so that part is a
 * cookie, not memory: the one piece of state this mock and a real
 * cookie-based Supabase SSR session actually share in shape, which is
 * what keeps the eventual swap from also requiring a middleware rewrite.
 *
 * Passwords are compared in plaintext, in memory, never sent anywhere or
 * written to disk. Fine for a throwaway local mock; the real SDK replaces
 * this whole file, not just the parts that matter for security.
 */

const SESSION_COOKIE = "tsg-mock-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface AuthUser {
  id: string;
  email: string;
}

interface StoredUser extends AuthUser {
  password: string;
}

export interface AuthResult {
  user: AuthUser | null;
  error: string | null;
}

// globalThis-backed rather than a plain module-level Map: fase 3's PDF
// work found, empirically, that Next.js can give the same module
// separate instances across different bundles even within one process.
// This mock only ever runs client-side, so that specific failure mode
// does not apply here - but Fast Refresh during development re-evaluates
// client modules too, and globalThis survives that the same way. Cheap
// insurance either way, and it is the exact fix that already worked once.
const globalKey = Symbol.for("tsg.mockAuthUsers");
type GlobalWithUsers = typeof globalThis & { [globalKey]?: Map<string, StoredUser> };
const g = globalThis as GlobalWithUsers;
const users = (g[globalKey] ??= new Map<string, StoredUser>());

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
  return { user, error: null };
}

export async function signOut(): Promise<void> {
  clearSessionCookie();
}

export async function getSession(): Promise<AuthUser | null> {
  return readSessionCookie();
}
