/**
 * Stripe's real test card numbers, in their own module with no imports.
 *
 * Split out of stripe-mock.ts because two very different places need
 * them: the mock service, which runs server-side and pulls in
 * node:crypto, and the payment form's on-screen test-card reference,
 * which is a client component. Importing stripe-mock.ts from the browser
 * would drag the intent registry and node:crypto into the client bundle
 * - the registry is the authority on whether something was paid for, and
 * it has no business being shipped to a browser.
 *
 * These are the numbers Stripe itself documents for test mode, so they
 * keep behaving identically once the real SDK is connected: the manual
 * test script for this flow survives the swap unchanged.
 */
export const TEST_CARDS = {
  /** Succeeds immediately. */
  success: "4242424242424242",
  /** Declined by the issuer. */
  declined: "4000000000000002",
  /** Requires a 3-D Secure challenge before it can succeed. */
  requiresAuthentication: "4000002500003155",
} as const;
