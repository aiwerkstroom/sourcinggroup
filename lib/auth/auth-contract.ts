/**
 * What every Auth backend (auth-memory.ts, auth-supabase.ts) agrees on:
 * the shapes, the session cookie's name, and the interface useAuth.tsx
 * actually depends on. Mirrors pending-input-contract.ts's role for the
 * pending-input swap - a third module that depends on neither
 * implementation, so middleware.ts and useAuth.tsx can both reach the
 * cookie name and the shared types without dragging in either the
 * Supabase SDK or the in-memory registry.
 */

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResult {
  user: AuthUser | null;
  error: string | null;
}

/**
 * Presence-only signal for middleware.ts, which runs server-side, before
 * any client JS, and cannot read either backend's real session storage -
 * auth-memory.ts's session lives in a cookie already, but auth-supabase.ts's
 * real session lives in the browser's localStorage, which the server
 * never sees at all. Both backends keep this cookie's presence in sync
 * with their own notion of "signed in right now"; middleware only ever
 * checks whether it exists. That makes it a UX gate, not a verified
 * credential - unchanged from what it already was under the mock. The
 * actual authorization boundary for any Supabase-backed data access is
 * row-level security, keyed on the request's own Supabase JWT, never on
 * this cookie.
 */
export const SESSION_COOKIE = "tsg-session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * The shape both backends expose, and the only thing useAuth.tsx depends
 * on - which is what keeps that file identical regardless of which
 * backend auth-client.ts selects.
 */
export interface AuthBackend {
  signUp(email: string, password: string): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthUser | null>;
  /**
   * Calls onChange once immediately with the current session (mirroring
   * Supabase's own INITIAL_SESSION event on subscribe), then again on
   * every later change - a sign-in or sign-out in this tab, a token
   * refresh, another tab doing any of those. Returns an unsubscribe
   * function. This is what lets AuthProvider stay one implementation for
   * both backends: it never polls or listens for cookie changes itself,
   * it just asks its backend to tell it when the session changes.
   */
  subscribeToSessionChanges(onChange: (user: AuthUser | null) => void): () => void;
}
