/**
 * The real Supabase Auth backend - what auth-client.ts selects by
 * default, in production, preview, and any ordinary local run.
 *
 * Replaces the mock's in-memory user registry, which was the live bug
 * this file fixes: Vercel gives separate serverless invocations separate
 * processes, so a signUp() and the signIn() that followed it could land
 * on two different processes and never see the same registry - a
 * signup that appeared to work, and a login that silently did nothing.
 * The same class of bug the pending-input Map had before its own
 * Supabase swap. This backend has no per-process state at all: every
 * call is a request to Supabase's own Auth API, backed by auth.users,
 * reachable from every instance alike.
 *
 * Client-only. Uses the anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY), which
 * is meant to be public - the real access control for anything an
 * authenticated user can read or write is row-level security on the
 * Supabase side, keyed on the request's own JWT, not on this key being
 * secret.
 *
 * WHAT IS AND IS NOT PROVEN, FROM HERE. This sandbox's egress policy
 * still blocks *.supabase.co (confirmed again for this task, the same
 * 403 policy denial documented since fase 4 stap 1), so nothing here has
 * ever completed a real round trip. What IS verified: it compiles
 * against the real @supabase/supabase-js types (2.112.3); the shape this
 * file exposes satisfies AuthBackend, the same contract auth-memory.ts
 * satisfies, so useAuth.tsx cannot tell them apart. What is NOT verified,
 * and not claimed: that public.users and the handle_new_auth_user
 * trigger (supabase/migrations/0001_initial.sql) are actually applied to
 * the live project in their current form - they are reported to be, the
 * same report pending-input-supabase.ts already rested on, and that
 * report is credible but not something this sandbox can check. Also not
 * verified: whether the live project requires email confirmation before
 * a session exists. signUp() below handles both outcomes explicitly (see
 * its own comment) rather than assuming either.
 */

import { createClient } from "@supabase/supabase-js";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import type { AuthBackend, AuthResult, AuthUser } from "./auth-contract";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./auth-contract";

let cached: SupabaseClient | null = null;

/**
 * Reads configuration at call time, not at module load, so importing this
 * module stays free of side effects - the same discipline
 * lib/supabase/server-client.ts already established for the same reason.
 */
function client(): SupabaseClient {
  if (cached !== null) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url === undefined || url === "" || anonKey === undefined || anonKey === "") {
    // Loud, not silent - the same discipline the pending-input swap
    // applied. A quiet fallback to the in-memory backend here would
    // reintroduce exactly the bug this file exists to fix, and hide it
    // until a customer could not log in.
    throw new Error(
      "Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set for the browser Auth client.",
    );
  }

  cached = createClient(url, anonKey);
  return cached;
}

/** Test seam: drops the memoised client so a test can change env between cases. */
export function resetSupabaseAuthClientForTests(): void {
  cached = null;
}

function toAuthUser(user: User): AuthUser {
  return { id: user.id, email: user.email ?? "" };
}

const GENERIC_CREDENTIALS_ERROR = "E-mailadres of wachtwoord onjuist.";

/**
 * Supabase's own error messages are English and were never meant to be
 * shown to a customer on a Dutch page. Translated to the same copy the
 * mock backend already used, so the swap changes nothing about what a
 * user sees for the cases that existed before, and adds Dutch copy for
 * the cases only the real backend can produce (email confirmation,
 * rate limiting).
 */
function toDutchError(message: string): string {
  if (/invalid login credentials/i.test(message)) return GENERIC_CREDENTIALS_ERROR;
  if (/email not confirmed/i.test(message)) {
    return "Bevestig eerst uw e-mailadres via de link die u heeft ontvangen.";
  }
  if (/(user already registered|already registered)/i.test(message)) {
    return "Er bestaat al een account met dit e-mailadres.";
  }
  if (/password.*(least|minimum|characters)/i.test(message)) {
    return "Wachtwoord moet minstens 8 tekens zijn.";
  }
  if (/rate limit/i.test(message)) {
    return "Te veel pogingen. Probeer het over enkele minuten opnieuw.";
  }
  return message;
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  if (normalized === "" || password === "") {
    return { user: null, error: "E-mailadres en wachtwoord zijn verplicht." };
  }
  if (password.length < 8) {
    return { user: null, error: "Wachtwoord moet minstens 8 tekens zijn." };
  }

  const { data, error } = await client().auth.signUp({ email: normalized, password });
  if (error !== null) return { user: null, error: toDutchError(error.message) };
  if (data.user === null) return { user: null, error: "Aanmaken van account is mislukt." };

  // Two real outcomes here, not one. If the Supabase project requires
  // email confirmation, signUp() creates the identity but returns no
  // session - redirecting to a protected route regardless would just
  // bounce straight back at middleware.ts with no explanation. Treated as
  // its own case rather than assumed away, since this sandbox cannot
  // check which setting the live project actually has.
  if (data.session === null) {
    return {
      user: null,
      error:
        "Account aangemaakt. Bevestig uw e-mailadres via de link die u heeft ontvangen om in te loggen.",
    };
  }

  return { user: toAuthUser(data.user), error: null };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await client().auth.signInWithPassword({
    email: normalized,
    password,
  });
  if (error !== null) return { user: null, error: toDutchError(error.message) };
  if (data.user === null) return { user: null, error: GENERIC_CREDENTIALS_ERROR };

  return { user: toAuthUser(data.user), error: null };
}

export async function signOut(): Promise<void> {
  await client().auth.signOut();
}

export async function getSession(): Promise<AuthUser | null> {
  const { data } = await client().auth.getSession();
  if (data.session === null) return null;
  return toAuthUser(data.session.user);
}

function setSessionCookie(): void {
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${SESSION_MAX_AGE_SECONDS}; samesite=lax`;
}

function clearSessionCookie(): void {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
}

/**
 * session !== null is not the same question as "is this session still
 * good right now" - the gap this task's own investigation found.
 * @supabase/auth-js reads a cached session straight from localStorage
 * and hands it back with no server round trip whenever it is more than
 * EXPIRY_MARGIN_MS (90 seconds) from its OWN claimed expiry
 * (GoTrueClient's __loadSession()), so a session revoked on the
 * Supabase side - the account deleted, a password reset that signs out
 * everywhere, a manual revocation - keeps arriving here as a non-null
 * session, unnoticed, for up to its access token's full lifetime
 * (default one hour). onAuthStateChange never fires a separate event to
 * say so: a failed refresh either surfaces as SIGNED_OUT with
 * session: null (GoTrueClient's _removeSession(), which every genuinely
 * dead refresh routes through) or, if the access token was still
 * technically valid at that moment, no event at all
 * ("proactive-preserve" - the SDK's own term for it). TOKEN_REFRESHED
 * itself never fires with a failure; it is a success-only event.
 *
 * So the one thing this file CAN check without adding a network round
 * trip this task did not ask for is the session's own expires_at
 * against the clock - which is exactly what this function does. It does
 * NOT close the gap above (nothing client-side can, short of a
 * getUser() call on every event, which was explicitly out of scope for
 * this fix): a session Supabase revoked five minutes ago, whose access
 * token is not due to expire for another fifty, will still read as
 * valid here, because its own expires_at has not been reached yet
 * either. What this DOES fix is no longer trusting a session object
 * whose own timestamp already says it is dead, regardless of which
 * event happened to carry it.
 */
function isCurrentlyValid(session: Session | null): session is Session {
  if (session === null) return false;
  if (session.expires_at === undefined) return true;
  return session.expires_at * 1000 > Date.now();
}

function handleSessionEvent(
  session: Session | null,
  onChange: (user: AuthUser | null) => void,
): void {
  if (!isCurrentlyValid(session)) {
    clearSessionCookie();
    onChange(null);
  } else {
    setSessionCookie();
    onChange(toAuthUser(session.user));
  }
}

/**
 * The single place the marker cookie middleware.ts reads is written or
 * cleared for this backend - driven by the SDK's own onAuthStateChange,
 * which fires on sign-in, sign-out, token refresh, and once on subscribe
 * with whatever session already exists (INITIAL_SESSION). That is what
 * keeps the cookie from being able to drift out of step with what the
 * SDK itself considers the current session: there is exactly one writer,
 * and it is the SDK's own event, not signIn()/signUp()/signOut() setting
 * it directly - handleSessionEvent()'s own expiry check above is what
 * keeps that one writer honest about a session it already knows is
 * dead, on top of session === null.
 */
export function subscribeToSessionChanges(onChange: (user: AuthUser | null) => void): () => void {
  const {
    data: { subscription },
  } = client().auth.onAuthStateChange((_event, session) => {
    handleSessionEvent(session, onChange);
  });
  return () => subscription.unsubscribe();
}

const _shapeCheck: AuthBackend = {
  signUp,
  signIn,
  signOut,
  getSession,
  subscribeToSessionChanges,
};
void _shapeCheck;
