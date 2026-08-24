import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The server-side Supabase client (fase 4 stap 3).
 *
 * SERVER ONLY. This module reads SUPABASE_SERVICE_ROLE_KEY, which bypasses
 * row-level security entirely - it must never reach the browser bundle.
 * Deliberately not prefixed NEXT_PUBLIC_, so Next.js cannot inline it into
 * client code even by accident; the two existing NEXT_PUBLIC_SUPABASE_*
 * variables stay what they are, for the eventual client-side Auth swap.
 *
 * Why the service role rather than the anon key: the pending-input store
 * writes a row *before* the customer is necessarily an authenticated
 * Supabase user, and reads it back on a cold return from a payment
 * provider. There is no user JWT to attach on either side, so RLS has
 * nothing to key on. 0001_initial.sql therefore leaves pending_inputs
 * with RLS enabled and no policies at all - unreachable by anon and
 * authenticated alike - and this key is the only way in. That is the
 * narrow, deliberate hole; it lives on the server, guarded by that file
 * and this one.
 *
 * NOT VERIFIED AGAINST A LIVE INSTANCE. This sandbox's egress policy
 * blocks *.supabase.co (the same 403 policy denial auth-supabase.ts
 * documents), so nothing here has ever completed a real round trip. What
 * IS verified: it compiles against the real @supabase/supabase-js types
 * (2.112.3), and the narrow interface the pending-input adapter uses is
 * type-asserted against the real SupabaseClient. Everything else waits
 * for the live environment.
 */

let cached: SupabaseClient | null = null;

/**
 * Reads configuration at call time, not at module load. Importing this
 * module must stay free of side effects: several call sites are route
 * handlers that Next.js also loads while building, where the server-only
 * env is not necessarily present and a throw at import time would fail
 * the build rather than the request.
 */
export function getServerSupabaseClient(): SupabaseClient {
  if (cached !== null) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url === undefined || url === "" || serviceRoleKey === undefined || serviceRoleKey === "") {
    // Loud, not silent. The whole point of fase 4 stap 3 is that the
    // pending store stops living in one process's memory; a quiet
    // fallback to something in-memory would reintroduce exactly the bug
    // this replaces, and hide it until a customer lost a paid report.
    throw new Error(
      "Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "must both be set for the server-side client.",
    );
  }

  cached = createClient(url, serviceRoleKey, {
    auth: {
      // No session to persist or refresh: this client acts as the service
      // role on a server, never on behalf of a browser user.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cached;
}

/** Test seam: drops the memoised client so a test can change env between cases. */
export function resetServerSupabaseClientForTests(): void {
  cached = null;
}
