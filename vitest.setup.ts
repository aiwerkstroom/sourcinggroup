/**
 * Loaded before every test file (vitest.config.ts's setupFiles). Extends
 * `expect` with jest-dom's DOM matchers (toHaveTextContent, etc.) for the
 * handful of tests that render into a real DOM (fase 4's useAuth.test.tsx
 * and anything similar later) - a no-op import cost for the rest of the
 * suite, which never touches these matchers.
 *
 * @testing-library/react normally registers its own afterEach(cleanup)
 * automatically, but only when it detects `afterEach` as a global - this
 * project calls describe/it/expect as explicit imports everywhere rather
 * than setting Vitest's `globals: true`, so that auto-registration never
 * fires and renders from one test stay mounted into the next (screen
 * queries then match multiple stacked copies). Registering cleanup here
 * explicitly is the fix that keeps `globals: true` off the rest of the
 * suite.
 */
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

/**
 * stripe-mock.ts simulates a payment provider's network latency so the
 * UI's loading states are honest in a browser. In a test suite that is
 * 600ms of waiting per call and nothing else, on a module that fase 4
 * stap 2 puts on the path of every payment test - so it is switched off
 * here rather than per file.
 */
process.env.TSG_STRIPE_MOCK_LATENCY_MS = "0";

/** Same reasoning as the Stripe mock's latency override, for source-mock.ts (pijler 2). */
process.env.TSG_SOURCE_MOCK_LATENCY_MS = "0";

/**
 * lib/auth/auth-client.ts (the live Auth swap) defaults to the real
 * Supabase SDK, which has no reachable project from this sandbox or from
 * CI. The component test suite - the signin/signup page tests, the
 * logout-button test, useAuth.test.tsx - renders the real AuthProvider
 * and drives real signUp()/signIn()/signOut() calls through it, so it
 * needs the in-memory backend instead. This is the opt-in
 * auth-client.ts's own docstring describes, set here rather than per
 * file so no test can forget it and silently start trying to reach a
 * Supabase project that is not there.
 */
process.env.TSG_AUTH_STORE = "memory";

/**
 * Same reasoning, for the payment-intent store: since the live fix that
 * moved stripe-mock.ts's intents out of a per-process Map,
 * lib/payments/payment-intent-store.ts defaults to Supabase, which no
 * test here can reach. Every test that creates or confirms a payment
 * would otherwise try to open a connection that is not there. Set once
 * here so no test file can forget it.
 *
 * The two files that must NOT inherit this - payment-intent-selection.test.ts,
 * which is about what the default resolves to, and the cross-process
 * durability test - override or delete it themselves.
 */
process.env.TSG_PAYMENT_STORE = "memory";

afterEach(() => {
  cleanup();
});
