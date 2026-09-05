import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerSupabaseClient } from "@/lib/supabase/server-client";
import { PAYMENT_INTENT_TTL_MS } from "./payment-intent-contract";
import type { PaymentIntent, PaymentIntentStatus } from "./payment-intent-contract";

/**
 * The Supabase-backed payment-intent store, and the implementation the
 * payment flow actually runs on in production.
 *
 * It replaces a per-process Map inside stripe-mock.ts. That Map is the
 * live bug this module exists for: on Vercel the route that creates an
 * intent (/rapport/betalen/voorbereiden) and the page that reads it back
 * (/rapport/betalen) are separate Serverless Functions with separate
 * memory, so the page never found the intent and redirected every paying
 * customer back to step 1 of the wizard. A row does not have that
 * problem.
 *
 * Third time this exact swap has been made here - pending_inputs and the
 * auth registry went before it - and it is deliberately the same shape as
 * pending-input-supabase.ts down to the error discipline, so the two read
 * as one pattern rather than two solutions.
 *
 * THE STORE, NOT THE PROVIDER. This does not make payments real.
 * stripe-mock.ts is still a mock: it invents intents, and confirmPayment()
 * still decides on a test card number. What moved is only WHERE those
 * intents live, so the mock survives the gap between two invocations. The
 * later swap to the real Stripe SDK deletes this file along with the mock
 * (Stripe owns intent state on its own servers), which is why nothing
 * here is built to outlive it.
 *
 * WHAT IS AND IS NOT PROVEN, FROM HERE. Nothing in this sandbox has ever
 * completed a real round trip: the egress policy blocks *.supabase.co
 * (re-confirmed for this task - CONNECT to bsrsalvuherllxottutx.supabase.co
 * answered 403). Verified here: it compiles against the real
 * @supabase/supabase-js types (2.112.3); the real query builder still
 * exposes the methods it calls (the shallow type check below); and its
 * own logic behaves correctly against a fake client in
 * __tests__/payment-intent-supabase.test.ts, including across two module
 * instances that share no memory. NOT verified, and not claimed: that the
 * deployed payment_intents table matches these column names, or that any
 * query succeeds at all. The first real proof is a completed payment on
 * the live deployment.
 */

const TABLE = "payment_intents";

/**
 * One row as the database holds it. The intent itself goes in `data` as
 * jsonb rather than a column per field, the same choice pending_inputs
 * made and for the same reason: this is a short-lived record between two
 * requests, and Stripe owns the object's shape. Giving it columns would
 * freeze today's mock shape into a migration and mean a schema change
 * when the real SDK's richer object arrives.
 */
interface PaymentIntentRow {
  id: string;
  data: PaymentIntent;
  expires_at: string;
}

/**
 * The narrow slice of the Supabase client this adapter uses. Depending on
 * this rather than on SupabaseClient itself is what lets the test supply a
 * small fake without reconstructing postgrest-js's generics - and it is
 * the same compromise pending-input-supabase.ts documents: the full
 * structural assertion does not compile (postgrest-js's builder types hit
 * TS2589, "type instantiation is excessively deep"), so the narrowing at
 * client() below is an explicit cast resting on the SDK being read rather
 * than on the compiler agreeing.
 */
export interface PaymentIntentStoreClient {
  from(table: string): {
    upsert(values: PaymentIntentRow): PromiseLike<{ error: { message: string } | null }>;
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        maybeSingle(): PromiseLike<{
          data: PaymentIntentRow | null;
          error: { message: string } | null;
        }>;
      };
    };
    delete(): {
      eq(column: string, value: string): PromiseLike<{ error: { message: string } | null }>;
      lte(column: string, value: string): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

/**
 * Compile-time only, and shallow on purpose (see the interface above).
 * Each is `true` exactly while the real query builder still exposes that
 * method as callable; an SDK upgrade renaming one stops this compiling.
 */
type RealQueryBuilder = ReturnType<SupabaseClient["from"]>;
type HasUpsert = RealQueryBuilder["upsert"] extends (...args: never[]) => unknown ? true : false;
type HasSelect = RealQueryBuilder["select"] extends (...args: never[]) => unknown ? true : false;
type HasDelete = RealQueryBuilder["delete"] extends (...args: never[]) => unknown ? true : false;

const _sdkStillHasTheMethodsThisFileCalls: [HasUpsert, HasSelect, HasDelete] = [true, true, true];
void _sdkStillHasTheMethodsThisFileCalls;

/** The one place the real client is narrowed to the interface above. */
function client(): PaymentIntentStoreClient {
  return getServerSupabaseClient() as unknown as PaymentIntentStoreClient;
}

/**
 * upsert rather than insert, unlike pending_inputs. A pending input is
 * written once under a fresh token; an intent is written once at creation
 * and then AGAIN on every status change, under the id it already has.
 * insert would collide with the primary key on the second write.
 */
export async function storePaymentIntent(intent: PaymentIntent): Promise<void> {
  const { error } = await client()
    .from(TABLE)
    .upsert({
      id: intent.id,
      data: intent,
      expires_at: new Date(Date.now() + PAYMENT_INTENT_TTL_MS).toISOString(),
    });

  // This one DOES throw, the same call the pending-input store makes: a
  // failed write means the customer is about to be sent to a payment page
  // for an intent that exists nowhere. Failing now, before they pay, is
  // the only outcome that does not cost them money - and it is precisely
  // the silent failure (a lost intent, a redirect to step 1, no error
  // anywhere) that this whole swap exists to end.
  if (error !== null) {
    throw new Error(`Could not store payment intent: ${error.message}`);
  }
}

export async function readPaymentIntent(id: string): Promise<PaymentIntent | null> {
  const { data, error } = await client().from(TABLE).select("*").eq("id", id).maybeSingle();

  if (error !== null) {
    // A read failure is not "no such intent". Returning null would tell
    // the release route the payment does not exist, and it would refuse a
    // report the customer has already paid for. Throwing keeps a
    // transient database problem distinguishable from a genuinely missing
    // intent - the same reasoning readPendingInput() spells out.
    throw new Error(`Could not read payment intent: ${error.message}`);
  }
  if (data === null) return null;

  if (Date.parse(data.expires_at) <= Date.now()) {
    void deleteIntent(id);
    return null;
  }
  return data.data;
}

export async function writePaymentIntentStatus(
  id: string,
  status: PaymentIntentStatus,
): Promise<PaymentIntent | null> {
  const current = await readPaymentIntent(id);
  if (current === null) return null;

  const updated: PaymentIntent = { ...current, status };
  await storePaymentIntent(updated);
  return updated;
}

/**
 * Housekeeping, so it returns nothing and throws nothing on a database
 * error: a customer's payment must not fail because a cleanup query did.
 * The error surfaces in logs instead. The SQL side has its own pg_cron
 * job doing the same delete; either is sufficient, and having both means
 * the sweep does not stop when one is unavailable.
 */
export async function sweepExpiredPaymentIntents(now: number = Date.now()): Promise<void> {
  const { error } = await client()
    .from(TABLE)
    .delete()
    .lte("expires_at", new Date(now).toISOString());
  if (error !== null) {
    console.error(`[payment-intent] expiry sweep failed: ${error.message}`);
  }
}

async function deleteIntent(id: string): Promise<void> {
  const { error } = await client().from(TABLE).delete().eq("id", id);
  if (error !== null) {
    console.error(`[payment-intent] could not delete expired intent: ${error.message}`);
  }
}
