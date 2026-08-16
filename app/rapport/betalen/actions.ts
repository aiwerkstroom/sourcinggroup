"use server";

/**
 * The payment confirmation, run server-side (fase 4 stap 2, stap 3 van 5).
 *
 * With real Stripe this hop does not exist: Stripe.js calls Stripe's own
 * servers straight from the browser, and the card number never touches
 * our origin. The mock has no Stripe to call, and its intent registry is
 * the authority on whether something was paid for (stripe-mock.ts's own
 * docstring) - so the hop goes to our server instead. Same shape, one
 * fewer party.
 *
 * That is also why these are Server Actions rather than client calls into
 * the mock: a browser-side confirm would mutate a browser-side copy of
 * the registry, and the release step (stap 4) would then ask the server a
 * question the server has no answer to. The status has to change where it
 * is later read.
 *
 * At swap time this file goes away with the mock's card fields: the form
 * calls Stripe.js's confirmPayment() directly and nothing downstream of
 * the intent's status changes.
 */

import {
  completeAuthentication,
  confirmPayment,
  type PaymentIntentStatus,
  type StripeError,
} from "@/lib/payments/stripe-mock";

export interface ConfirmOutcome {
  status: PaymentIntentStatus | null;
  error: StripeError | null;
}

export async function confirmMockPayment(
  clientSecret: string,
  cardNumber: string,
): Promise<ConfirmOutcome> {
  const { paymentIntent, error } = await confirmPayment({ clientSecret, cardNumber });
  return { status: paymentIntent?.status ?? null, error };
}

/**
 * Stands in for the customer returning from a 3-D Secure challenge -
 * with real Stripe, Stripe.js handles that itself and the browser may
 * well come back through a full page load. See stripe-mock.ts's note on
 * completeAuthentication(); this wrapper exists for the same reason and
 * disappears at the same moment.
 */
export async function completeMockAuthentication(clientSecret: string): Promise<ConfirmOutcome> {
  const { paymentIntent, error } = await completeAuthentication(clientSecret);
  return { status: paymentIntent?.status ?? null, error };
}
