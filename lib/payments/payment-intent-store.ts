import * as memory from "./payment-intent-memory";
import * as supabase from "./payment-intent-supabase";

/**
 * THE SWAP POINT. stripe-mock.ts reaches the intent store through here
 * and nowhere else, so which implementation runs is decided once, in this
 * file - the same role pending-input.ts plays for the pending-input
 * store, and deliberately the same selection discipline.
 *
 * The default is the Supabase adapter: a real table, reachable from every
 * Vercel instance. The Map it replaced was per-process, and Vercel gives
 * separate invocations separate processes - so an intent created while
 * preparing a payment was not there when the payment page read it back,
 * and every customer who finished the wizard was redirected to step 1.
 * That was a real, observed, live failure, not a theoretical one.
 *
 * === Why this is a selection and not a hard re-export ===
 *
 * The route-level golden tests (betalen/__tests__/page.test.ts,
 * voorbereiden/__tests__/route.test.ts, vrijgeven/__tests__/chain.test.ts
 * and failure.test.ts) drive a real `next start` server through the
 * actual payment routes, with no database behind it. They already spawn
 * with TSG_PENDING_STORE=memory for exactly this reason and now set
 * TSG_PAYMENT_STORE=memory alongside it. Without a way to run those
 * against the Map, the whole route-level payment suite would have to be
 * deleted.
 *
 * === Why this is NOT the silent fallback that was ruled out ===
 *
 * The rejected design is "use Supabase if configured, else the Map". That
 * fails open: a missing key in production quietly restores the
 * per-process store, and nobody finds out until a customer has paid and
 * lost their report - or, as actually happened, until they cannot reach
 * the payment page at all. This selection cannot do that, because it does
 * not consult the Supabase configuration:
 *
 *   - Nothing set (production, preview, any ordinary run) -> Supabase.
 *     A missing SUPABASE_SERVICE_ROLE_KEY then throws, loudly, on the
 *     first call (lib/supabase/server-client.ts).
 *   - TSG_PAYMENT_STORE set to anything but the exact string "memory" -
 *     a typo, a stale value, an empty string -> Supabase, and the same
 *     loud failure. The Map is never the default of a fallthrough.
 *   - Only the exact opt-in reaches the Map, which takes a deliberate act.
 *
 * __tests__/payment-intent-selection.test.ts pins each of those branches.
 */

/**
 * The one string that selects the Map. Exported so tests that opt in use
 * this constant rather than retyping the literal - a typo in a spawned
 * test server's env would otherwise silently give it Supabase and a
 * confusing connection error instead of the store it asked for.
 */
export const MEMORY_STORE_ENV_VALUE = "memory";

/**
 * Read at module load, deliberately. Which store a process talks to is a
 * property of the process, not of the request - re-reading per call would
 * invite a deploy where two requests in one instance disagree.
 */
const useMemoryStore = process.env.TSG_PAYMENT_STORE === MEMORY_STORE_ENV_VALUE;

const impl = useMemoryStore ? memory : supabase;

export const storePaymentIntent = impl.storePaymentIntent;
export const readPaymentIntent = impl.readPaymentIntent;
export const writePaymentIntentStatus = impl.writePaymentIntentStatus;
export const sweepExpiredPaymentIntents = impl.sweepExpiredPaymentIntents;

export { PAYMENT_INTENT_TTL_MS } from "./payment-intent-contract";
export type { PaymentIntent, PaymentIntentStatus } from "./payment-intent-contract";
