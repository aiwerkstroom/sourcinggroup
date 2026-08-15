"use client";

/**
 * React context wrapper around lib/auth/supabase-mock.ts (fase 4 stap 2).
 * Every consumer - the signup/signin pages, the resultaat page's logout
 * button, a future protected-route check - reads auth state through this
 * hook, never by importing supabase-mock.ts directly. That is what keeps
 * the later swap to the real Supabase SDK contained to supabase-mock.ts's
 * internals: this file's own exported shape (AuthProvider, useAuth) does
 * not need to change for that swap to work.
 *
 * File is .tsx, not .ts, despite this task's own naming: AuthProvider
 * returns JSX, so it needs the extension that lets it.
 *
 * `user` is not solely reactive to this tab's own signUp()/signIn()/
 * signOut() calls - those update it immediately and synchronously, for
 * instant UI feedback without waiting on anything else - but the mock's
 * session lives in a cookie (supabase-mock.ts's own docstring explains
 * why), not in this component's state alone. Another tab signing out, or
 * the cookie simply expiring, should be reflected here too, which is
 * what the cookie listener below is for. The Cookie Store API's `change`
 * event covers that where the browser implements it (Chromium); a short
 * interval poll is the fallback where it does not (Firefox, Safari at
 * the time of writing), so this does not depend on which engine runs it.
 * Both paths re-read the session via getSession() rather than trusting
 * any event payload - one source of truth for "what does the cookie
 * currently say".
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthResult, AuthUser } from "./supabase-mock";
import * as mockAuth from "./supabase-mock";

const SESSION_POLL_MS = 1000;

interface AuthContextValue {
  user: AuthUser | null;
  /** True until the initial getSession() read resolves - lets a consumer avoid a "signed out" flash before that first read completes. */
  loading: boolean;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void mockAuth.getSession().then((session) => {
      if (!cancelled) {
        setUser(session);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void mockAuth.getSession().then((session) => {
        if (!cancelled) setUser(session);
      });
    };

    const cookieStore = (window as typeof window & { cookieStore?: EventTarget }).cookieStore;
    if (cookieStore !== undefined) {
      cookieStore.addEventListener("change", refresh);
      return () => {
        cancelled = true;
        cookieStore.removeEventListener("change", refresh);
      };
    }

    const interval = setInterval(refresh, SESSION_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await mockAuth.signUp(email, password);
    if (result.user !== null) setUser(result.user);
    return result;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await mockAuth.signIn(email, password);
    if (result.user !== null) setUser(result.user);
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await mockAuth.signOut();
    setUser(null);
  }, []);

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
