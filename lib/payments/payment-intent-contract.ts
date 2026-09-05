/**
 * What every payment-intent store (memory, Supabase) agrees on: the
 * intent's shape, its lifetime, and the four operations stripe-mock.ts
 * needs. Mirrors pending-input-contract.ts's role for the pending-input
 * swap - a third module that depends on neither implementation, so the
 * swap point and both adapters can reach these without one importing the
 * other.
 *
 * The intent TYPE lives here rather than in stripe-mock.ts because both
 * adapters have to name it, and stripe-mock.ts re-exports it unchanged -
 * so every existing call site that imports PaymentIntent from
 * stripe-mock.ts keeps working verbatim.
 *
 * Deliberately free of any runtime import. Both implementations, and
 * every caller, reach this without dragging in either the Supabase SDK
 * or the Map.
 */

/**
 * Stripe's own PaymentIntent lifecycle, narrowed to the states this flow
 * can actually produce. `processing` and `requires_capture` exist in the
 * real API but belong to asynchronous methods and manual capture, neither
 * of which this flow uses.
 */
export type PaymentIntentStatus =
  | "requires_payment_method"
  | "requires_action"
  | "succeeded"
  | "canceled";

/**
 * snake_case against the rest of this codebase's camelCase, deliberately
 * and unchanged from when this lived in stripe-mock.ts: these are
 * Stripe's data, not our wrapper's surface. A real PaymentIntent comes
 * back snake_case, so anything reading `.client_secret` or `.status`
 * keeps working verbatim once real objects flow through here.
 */
export interface PaymentIntent {
  id: string;
  client_secret: string;
  status: PaymentIntentStatus;
  amount: number;
  currency: string;
}

/**
 * Twenty-four hours, and deliberately far longer than the pending
 * input's thirty minutes (PENDING_TTL_MS).
 *
 * The two are not interchangeable clocks. The pending input is a parking
 * space for the customer's data and should disappear quickly - it holds a
 * full address and a household's finances. The intent is the record of
 * whether money moved, holds no personal data at all (an id, a secret, a
 * status, an amount), and is read again by the release route AFTER the
 * customer pays. If it expired on the same schedule as the input, a
 * customer paying at minute 29 could race their own intent out of
 * existence and be refused a report they had just paid for. Outliving
 * the input by a wide margin is what makes that impossible, and it also
 * leaves a day's worth of "did this payment succeed?" answerable by hand.
 */
export const PAYMENT_INTENT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * The operations stripe-mock.ts performs on whichever store is selected.
 * Written as flat named functions rather than a class, the same
 * convention pending-input.ts follows, so the swap point can re-export
 * them one by one and a caller never holds an instance.
 */
export interface PaymentIntentStore {
  storePaymentIntent(intent: PaymentIntent): Promise<void>;
  readPaymentIntent(id: string): Promise<PaymentIntent | null>;
  /**
   * Sets a new status and returns the updated intent, or null when there
   * is no such intent.
   *
   * Read-then-write, with the window that implies: two confirmations
   * racing on one intent could both pass the "already succeeded" guard in
   * stripe-mock.ts. That window is left open on purpose rather than
   * closed with a conditional update, because the thing that closes it
   * properly is Stripe itself - the real API owns intent state and
   * rejects a second confirmation server-side. Building our own
   * compare-and-set here would be machinery the real swap deletes.
   */
  writePaymentIntentStatus(id: string, status: PaymentIntentStatus): Promise<PaymentIntent | null>;
  sweepExpiredPaymentIntents(now?: number): Promise<void>;
}
