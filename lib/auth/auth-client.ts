import type { AuthBackend } from "./auth-contract";
import * as memory from "./auth-memory";
import * as supabaseAuth from "./auth-supabase";

/**
 * THE SWAP POINT. useAuth.tsx imports the Auth backend from here, and
 * nowhere else, so which implementation runs is decided once, in this
 * file - the same role pending-input.ts plays for the pending-input
 * store, and the same selection discipline.
 *
 * Since this task's live swap that is auth-supabase.ts: the real
 * Supabase Auth SDK, with no per-process state, unlike the in-memory
 * registry it replaced (auth-memory.ts) - which is exactly why signup
 * and login used to be able to land on two different Vercel instances
 * and never see the same user.
 *
 * === Why this is a selection and not a hard re-export ===
 *
 * The component test suite (signin/signup page tests, the logout-button
 * test, useAuth.test.tsx) renders the real AuthProvider and drives real
 * signUp()/signIn()/signOut() calls through it - and the two Playwright
 * golden tests that drive an actual sign-up through a real browser
 * (middleware.test.ts, app/rapport/nieuw/pand/__tests__/page.test.ts) do
 * the same against a real `next start` server. There is no live Supabase
 * project reachable from this sandbox or from CI, so without a way to run
 * those against the in-memory backend, that whole suite would have to be
 * deleted. vitest.setup.ts sets TSG_AUTH_STORE=memory for every vitest
 * run, and the two Playwright tests spawn `next start` with the same
 * variable set, which app/layout.tsx reads server-side and passes down
 * (see resolveAuthBackend()'s own comment for why that indirection is
 * needed) - the same opt-in discipline pending-input.ts's own
 * TSG_PENDING_STORE=memory tests use.
 *
 * === Why this is NOT the silent fallback that was ruled out ===
 *
 * The rejected design was "use Supabase if configured, else the mock".
 * That fails open: a missing key in production quietly restores the
 * per-process registry and the exact bug this swap fixes comes back,
 * unnoticed until a customer cannot log in. This one cannot do that,
 * because the selection does not consult the Supabase configuration at
 * all:
 *
 *   - Nothing set (production, preview, any ordinary run) -> Supabase.
 *     A missing NEXT_PUBLIC_SUPABASE_ANON_KEY then throws, loudly, on the
 *     first call (auth-supabase.ts).
 *   - TSG_AUTH_STORE set to anything other than the exact string
 *     "memory" - a typo, a stale value, an empty string -> Supabase, and
 *     the same loud failure. The in-memory backend is never the default
 *     of a fallthrough.
 *   - Only the exact opt-in reaches it, which takes a deliberate act.
 */

export const MEMORY_STORE_ENV_VALUE = "memory";

/**
 * Resolves which backend to use. `forced`, when given, always wins - this
 * is how app/layout.tsx passes down a server-side read of
 * process.env.TSG_AUTH_STORE, taken at *request* time rather than build
 * time.
 *
 * That distinction matters because this module itself ships to the
 * browser (useAuth.tsx is a client component). In a bundle built by
 * `next build`, any process.env access other than NEXT_PUBLIC_-prefixed
 * ones is inlined to `undefined` once, at build time - so a bare
 * module-level read here would fix the backend forever to whatever
 * `npm run build` happened to see, and the same production build could
 * never also serve the test suite's need for a network-free backend. A
 * Server Component has no such limit; it reads process.env fresh, on the
 * server, per request. Falling back to a direct read below covers
 * callers with no Server Component upstream to ask - the component test
 * suite (vitest, plain Node, unaffected by webpack's inlining, see
 * vitest.setup.ts) is the only one of those.
 */
export function resolveAuthBackend(forced?: string): AuthBackend {
  const useMemoryStore =
    forced !== undefined
      ? forced === MEMORY_STORE_ENV_VALUE
      : process.env.TSG_AUTH_STORE === MEMORY_STORE_ENV_VALUE;
  return useMemoryStore ? memory : supabaseAuth;
}

export { SESSION_COOKIE } from "./auth-contract";
export type { AuthBackend, AuthResult, AuthUser } from "./auth-contract";
