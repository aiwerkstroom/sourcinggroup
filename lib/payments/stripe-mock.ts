/**
 * Mock Stripe service for this sandbox (fase 4 stap 2) - zero external
 * calls. Verified, not assumed: this sandbox's egress policy blocks both
 * api.stripe.com and js.stripe.com outright (403 on CONNECT, the same
 * policy denial that already ruled out *.supabase.co in stap 1). So
 * neither the server SDK nor Stripe.js can be reached or tested from
 * here, and the Payment Element UI later in this phase is a stand-in too,
 * not just this module.
 *
 * Swapping this out for the real SDK is meant to stay one file: replace
 * this body with `import Stripe from "stripe"` and a client built from
 * STRIPE_SECRET_KEY, keeping the same three exported functions. Callers
 * only depend on this file's exported shape, the same way useAuth.tsx
 * only depends on auth-memory.ts's - flat named functions a thin
 * wrapper would expose, rather than Stripe's own namespaced
 * `stripe.paymentIntents.create()`. That is the convention stap 1 already
 * set, and following it keeps every call site untouched at swap time.
 *
 * The object fields, by contrast, are deliberately snake_case
 * (`client_secret`, not `clientSecret`) against the rest of this
 * codebase's camelCase. Those are Stripe's data, not our wrapper's
 * surface: a real PaymentIntent comes back snake_case, so anything that
 * reads `.client_secret` or `.status` today keeps working verbatim once
 * the real objects flow through here. Our own naming stops at the
 * function boundary.
 *
 * SERVER-SIDE ONLY, and that is the whole point rather than an
 * implementation detail. The intent registry below is the authority on
 * whether something was paid for. The release route (stap 4) asks
 * retrievePaymentIntent() and believes that, never the browser's claim of
 * success - otherwise anyone who can call the route gets a EUR 49 report
 * for free. Keeping the trust boundary here from day one is what makes
 * the eventual swap a one-file change instead of a security rewrite.
 */

import { randomUUID } from "node:crypto";
import { TEST_CARDS } from "./test-cards";

/** EUR 49 from UI_SPEC.md section 2, in cents - Stripe's own unit for EUR. */
export const REPORT_PRICE_CENTS = 4900;
export const REPORT_CURRENCY = "eur";

/**
 * Stand-in for a network round trip, so the loading states built on top
 * of this module are honest rather than a flash. A real Stripe call costs
 * a few hundred milliseconds; a local function call costs none, and a
 * spinner that never appears in development is a spinner nobody notices
 * is broken in production.
 *
 * Overridable through TSG_STRIPE_MOCK_LATENCY_MS, and read per call
 * rather than once at import, so it does not depend on this module being
 * loaded after whoever sets it. vitest.setup.ts sets it to 0: the delay
 * earns its place in a browser, but in a test suite it is 600ms of
 * nothing per call, and this module is about to be on the path of every
 * payment test in this phase.
 */
const DEFAULT_LATENCY_MS = 600;

function simulatedLatencyMs(): number {
  const configured = Number(process.env.TSG_STRIPE_MOCK_LATENCY_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_LATENCY_MS;
}

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

export interface PaymentIntent {
  id: string;
  client_secret: string;
  status: PaymentIntentStatus;
  amount: number;
  currency: string;
}

export interface StripeError {
  type: "card_error" | "invalid_request_error";
  code: string;
  /** Dutch and customer-facing: this string is shown in the UI as-is. */
  message: string;
}

export interface ConfirmPaymentResult {
  paymentIntent: PaymentIntent | null;
  error: StripeError | null;
}

/**
 * Re-exported so this module stays the one import a server-side caller
 * needs. The numbers themselves live in test-cards.ts, which has no
 * imports at all: the payment form shows them on screen and is a client
 * component, and it must not reach into this file to get them.
 */
export { TEST_CARDS };

// globalThis-backed for the same reason pending-results.ts is: Next.js
// hands a Route Handler and a Page separate module instances even inside
// one `next start` process, confirmed empirically during fase 3. An
// intent created by one route and read by another would otherwise land in
// two different Maps, and the release check would see nothing.
const globalKey = Symbol.for("tsg.mockPaymentIntents");
type GlobalWithIntents = typeof globalThis & { [globalKey]?: Map<string, PaymentIntent> };
const g = globalThis as GlobalWithIntents;
const intents = (g[globalKey] ??= new Map<string, PaymentIntent>());

function token(): string {
  return randomUUID().replace(/-/g, "").slice(0, 24);
}

function delay(): Promise<void> {
  const ms = simulatedLatencyMs();
  if (ms === 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The client secret embeds its own intent id, exactly as Stripe's does
 * (`pi_xxx_secret_yyy`). That is why no second lookup table is needed:
 * the id is recoverable from the secret the browser holds.
 */
function intentIdFromClientSecret(clientSecret: string): string | null {
  const separator = clientSecret.indexOf("_secret_");
  if (separator <= 0) return null;
  return clientSecret.slice(0, separator);
}

/** Mirrors `stripe.paymentIntents.create()`. */
export async function createPaymentIntent(params: {
  amount: number;
  currency: string;
}): Promise<PaymentIntent> {
  await delay();

  const id = `pi_${token()}`;
  const intent: PaymentIntent = {
    id,
    client_secret: `${id}_secret_${token()}`,
    status: "requires_payment_method",
    amount: params.amount,
    currency: params.currency,
  };
  intents.set(id, intent);
  return { ...intent };
}

/**
 * Mirrors `stripe.paymentIntents.retrieve()`, except that an unknown id
 * returns null rather than throwing - the release route needs to tell
 * "no such intent" apart from "not paid", and a thrown error at that
 * layer would collapse the two.
 *
 * Returns a copy, so a caller cannot mutate the registry's own record
 * into a `succeeded` it never reached.
 */
export async function retrievePaymentIntent(id: string): Promise<PaymentIntent | null> {
  const intent = intents.get(id);
  return intent === undefined ? null : { ...intent };
}

/**
 * Stands in for Stripe.js's `stripe.confirmPayment()`. This is the one
 * signature that cannot match the real SDK: the real call takes the
 * mounted Element and never sees a card number, because the number goes
 * straight from Stripe's iframe to Stripe. There is no iframe here, so
 * the mock takes the number directly.
 *
 * That difference is contained to the payment form: the swap replaces
 * this function and the form's card fields together, and nothing
 * downstream of the intent's status changes.
 */
export async function confirmPayment(params: {
  clientSecret: string;
  cardNumber: string;
}): Promise<ConfirmPaymentResult> {
  await delay();

  const id = intentIdFromClientSecret(params.clientSecret);
  const intent = id === null ? undefined : intents.get(id);
  if (intent === undefined) {
    return {
      paymentIntent: null,
      error: {
        type: "invalid_request_error",
        code: "resource_missing",
        message: "De betaling kon niet worden gevonden. Begin de betaling opnieuw.",
      },
    };
  }

  if (intent.status === "succeeded") {
    return {
      paymentIntent: null,
      error: {
        type: "invalid_request_error",
        code: "payment_intent_unexpected_state",
        message: "Deze betaling is al voldaan.",
      },
    };
  }

  const number = params.cardNumber.replace(/\s/g, "");

  if (number === TEST_CARDS.declined) {
    // Stays payable: a declined card is not a dead intent, the customer
    // can try another one. Same as Stripe's own behaviour.
    intent.status = "requires_payment_method";
    return {
      paymentIntent: null,
      error: {
        type: "card_error",
        code: "card_declined",
        message: "Uw kaart is geweigerd. Probeer een andere kaart.",
      },
    };
  }

  if (number === TEST_CARDS.requiresAuthentication) {
    intent.status = "requires_action";
    return { paymentIntent: { ...intent }, error: null };
  }

  if (number !== TEST_CARDS.success) {
    intent.status = "requires_payment_method";
    return {
      paymentIntent: null,
      error: {
        type: "card_error",
        code: "incorrect_number",
        message: "Dit kaartnummer klopt niet. Controleer het en probeer opnieuw.",
      },
    };
  }

  intent.status = "succeeded";
  return { paymentIntent: { ...intent }, error: null };
}

/**
 * MOCK-ONLY - no equivalent in the real SDK, and it disappears at swap
 * time rather than being reimplemented.
 *
 * With real Stripe, a `requires_action` intent is resolved by Stripe.js
 * itself: it opens the 3-D Secure challenge, and on redirect-based
 * methods sends the browser away and back to `return_url`. That full page
 * load is precisely the case this phase's dataflow was designed around,
 * so the mock needs some way to reach the far side of it - otherwise the
 * one path the architecture exists for is the one path never exercised.
 * This function is that stand-in, and nothing but a test or the mock
 * payment form's own "challenge" step should call it.
 */
export async function completeAuthentication(clientSecret: string): Promise<ConfirmPaymentResult> {
  await delay();

  const id = intentIdFromClientSecret(clientSecret);
  const intent = id === null ? undefined : intents.get(id);
  if (intent === undefined || intent.status !== "requires_action") {
    return {
      paymentIntent: null,
      error: {
        type: "invalid_request_error",
        code: "payment_intent_unexpected_state",
        message: "Er is geen bevestiging in behandeling voor deze betaling.",
      },
    };
  }

  intent.status = "succeeded";
  return { paymentIntent: { ...intent }, error: null };
}
