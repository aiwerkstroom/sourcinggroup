"use client";

/**
 * React context wrapper around lib/auth/auth-client.ts (fase 4 stap 2;
 * swapped to the real Supabase backend in the live-swap task that
 * replaced auth-memory.ts as the default). Every consumer - the
 * signup/signin pages, the resultaat page's logout button, a future
 * protected-route check - reads auth state through this hook, never by
 * importing a specific backend directly. That is what keeps a future
 * backend change contained to auth-client.ts and the backend modules
 * themselves: this file's own exported shape (AuthProvider, useAuth)
 * does not depend on which one is selected.
 *
 * File is .tsx, not .ts, despite this task's own naming: AuthProvider
 * returns JSX, so it needs the extension that lets it.
 *
 * All session state - the initial read, every later change, and the
 * "instant" update right after this tab's own signUp()/signIn()/
 * signOut() - flows through one channel: the backend's own
 * subscribeToSessionChanges(). Earlier this file did its own cookie
 * polling and set state directly from signUp()/signIn()'s return value
 * as well, because the mock's session lived in a cookie with no event of
 * its own. auth-memory.ts and auth-supabase.ts each now own that
 * mechanism internally (a cookie poll/listener for the former, the SDK's
 * own onAuthStateChange for the latter) and notify through the same
 * interface, so this file no longer needs to know which one is running
 * underneath it.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthResult, AuthUser } from "./auth-contract";
import { resolveAuthBackend } from "./auth-client";

interface AuthContextValue {
  user: AuthUser | null;
  /** True until the first subscribeToSessionChanges() callback fires - lets a consumer avoid a "signed out" flash before that first read completes. */
  loading: boolean;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  authStoreOverride,
}: {
  children: React.ReactNode;
  /**
   * A server-side read of process.env.TSG_AUTH_STORE, passed down by
   * app/layout.tsx (a Server Component, which can read that fresh per
   * request - unlike this file, which ships to the browser). Only ever
   * set by that one caller, to route the Playwright golden tests and
   * local test infrastructure at the in-memory backend without needing a
   * live Supabase project; omitted, it falls through to
   * resolveAuthBackend()'s own env read, which is what every real
   * deploy - and the plain-Node component test suite - actually uses.
   * See auth-client.ts's resolveAuthBackend() for the full reasoning.
   */
  authStoreOverride?: string;
}) {
  const backend = useMemo(() => resolveAuthBackend(authStoreOverride), [authStoreOverride]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let receivedFirst = false;
    const unsubscribe = backend.subscribeToSessionChanges((session) => {
      setUser(session);
      if (!receivedFirst) {
        receivedFirst = true;
        setLoading(false);
      }
    });
    return unsubscribe;
  }, [backend]);

  const signUp = useCallback(
    async (email: string, password: string) => backend.signUp(email, password),
    [backend],
  );

  const signIn = useCallback(
    async (email: string, password: string) => backend.signIn(email, password),
    [backend],
  );

  const signOut = useCallback(async () => {
    await backend.signOut();
  }, [backend]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, signUp, signIn, signOut }),
    [user, loading, signUp, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
