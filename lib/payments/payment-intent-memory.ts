import { PAYMENT_INTENT_TTL_MS } from "./payment-intent-contract";
import type { PaymentIntent, PaymentIntentStatus } from "./payment-intent-contract";

/**
 * The IN-MEMORY payment-intent store - the Map that used to live inside
 * stripe-mock.ts, moved here unchanged in behaviour when that Map turned
 * out to be a live bug.
 *
 * WHAT IT COST. On Vercel, `/rapport/betalen/voorbereiden` (the route
 * that creates an intent) and `/rapport/betalen` (the page that reads it
 * back) are separate Serverless Functions - separate build entries, each
 * with its own file trace, so separate processes that share no memory at
 * all. The intent written by the first was therefore never visible to the
 * second, retrievePaymentIntent() returned null, and the page's
 * `if (intent === null) redirect("/rapport/nieuw/pand")` sent every
 * paying customer from the end of step 4 back to step 1. Deterministic,
 * not flaky, and invisible to the test suite because `next start` runs
 * every route in ONE process where globalThis genuinely is shared.
 *
 * The globalThis key below is not the mistake, and it is kept: Next.js
 * hands a Route Handler and a Page separate MODULE instances even inside
 * one process (confirmed empirically in fase 3), and without this key
 * they would miss each other even locally. What it cannot do is cross a
 * process boundary, and nothing keyed to a process can.
 *
 * So this module is no longer what production runs on: payment-intent-store.ts
 * resolves to payment-intent-supabase.ts, and this is reachable only by
 * the exact TSG_PAYMENT_STORE=memory opt-in that the route-level golden
 * tests use, because they drive a real `next start` server with no
 * database behind it. It is NOT a production fallback - see the swap
 * point for why a missing key cannot land here.
 *
 * This is the third store in this codebase to make the same trip. The
 * pending-input Map and the auth mock registry went first; this was the
 * last one left.
 */

const globalKey = Symbol.for("tsg.mockPaymentIntents");
type GlobalWithIntents = typeof globalThis & { [globalKey]?: Map<string, PaymentIntent> };
const g = globalThis as GlobalWithIntents;
const intents = (g[globalKey] ??= new Map<string, PaymentIntent>());

/**
 * Expiry is tracked in a side map rather than on PaymentIntent itself:
 * the intent's shape is Stripe's, and a real one has no `expiresAt`
 * field. Putting one there would mean the object this store hands back
 * stops matching what the real SDK returns, which is the one thing
 * stripe-mock.ts's whole design is trying to preserve.
 */
const expiryKey = Symbol.for("tsg.mockPaymentIntentExpiry");
type GlobalWithExpiry = typeof globalThis & { [expiryKey]?: Map<string, number> };
const expiries = ((globalThis as GlobalWithExpiry)[expiryKey] ??= new Map<string, number>());

function forget(id: string): void {
  intents.delete(id);
  expiries.delete(id);
}

export async function storePaymentIntent(intent: PaymentIntent): Promise<void> {
  intents.set(intent.id, { ...intent });
  expiries.set(intent.id, Date.now() + PAYMENT_INTENT_TTL_MS);
}

/**
 * Returns a copy, so a caller cannot mutate the registry's own record
 * into a `succeeded` it never reached - the same guarantee the Supabase
 * adapter gets for free by returning a row.
 */
export async function readPaymentIntent(id: string): Promise<PaymentIntent | null> {
  const intent = intents.get(id);
  if (intent === undefined) return null;

  const expiresAt = expiries.get(id);
  if (expiresAt !== undefined && expiresAt <= Date.now()) {
    forget(id);
    return null;
  }
  return { ...intent };
}

export async function writePaymentIntentStatus(
  id: string,
  status: PaymentIntentStatus,
): Promise<PaymentIntent | null> {
  const intent = await readPaymentIntent(id);
  if (intent === null) return null;

  const updated: PaymentIntent = { ...intent, status };
  intents.set(id, updated);
  return { ...updated };
}

export async function sweepExpiredPaymentIntents(now: number = Date.now()): Promise<void> {
  for (const [id, expiresAt] of expiries) {
    if (expiresAt <= now) forget(id);
  }
}
