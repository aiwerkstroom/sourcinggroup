import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WizardData } from "@/app/rapport/nieuw/_state/wizard-state";
import { getServerSupabaseClient } from "@/lib/supabase/server-client";
import { PENDING_TTL_MS } from "./pending-input";
import type { PendingInput } from "./pending-input";

/**
 * The real Supabase-backed pending-input store (fase 4 stap 3) - the
 * adapter that replaces pending-input.ts's in-memory Map.
 *
 * Same three functions, same signatures, same semantics. It sits beside
 * the mock rather than editing it, which is why the swap is a one-line
 * change and why the mock stays available for the test suite and for
 * local work without a database.
 *
 * TO SWAP, once a Supabase project with 0001_initial.sql applied exists
 * and SUPABASE_SERVICE_ROLE_KEY is set: replace the body of
 * pending-input.ts with a re-export of this module -
 *
 *   export { PENDING_INPUT_COOKIE, PENDING_TTL_MS } from "./pending-input-supabase";
 *   export type { PendingInput } from "./pending-input-supabase";
 *   export * from "./pending-input-supabase";
 *
 * - or point the six call sites here. Nothing else changes: those callers
 * already await these functions, which is precisely why pending-input.ts
 * made them async from the start even though a Map needs no await.
 *
 * Deliberately NOT selected by an env check at runtime. A "use Supabase
 * if configured, else the Map" fallback would fail exactly the way this
 * step exists to prevent: a missing variable in production would silently
 * restore the per-process Map, and nobody would notice until a customer
 * paid and lost their report. Missing configuration throws here
 * (server-client.ts), loudly, on the first call.
 *
 * WHAT IS AND IS NOT PROVEN. This has never run against a live database:
 * the sandbox's egress policy blocks *.supabase.co. Verified: it compiles
 * against the real @supabase/supabase-js types (2.112.3); the real query
 * builder still exposes the three methods it calls (the shallow type
 * check below); and its own logic behaves correctly against a fake client
 * in __tests__/pending-input-supabase.test.ts.
 *
 * NOT verified, and not claimed: that pending_inputs exists with these
 * column names, that the service role gets past RLS, that jsonb
 * round-trips WizardData unchanged, or that any query succeeds at all.
 * The client is narrowed to a hand-written interface by an explicit cast,
 * because the full structural check does not compile (see below) - so the
 * match between that interface and the SDK's real behaviour rests on
 * reading the SDK, not on the compiler. All of that is a live-environment
 * question, the same posture the Auth mock took, and for the same reason.
 */

const TABLE = "pending_inputs";

/**
 * The shape of one row as the database holds it. snake_case here and
 * camelCase in PendingInput on purpose: the mapping happens in this file
 * and nowhere else, so no caller has to know the storage layout.
 */
interface PendingInputRow {
  token: string;
  data: WizardData;
  payment_intent_id: string;
  expires_at: string;
}

/**
 * The narrow slice of the Supabase client this adapter actually uses.
 * Depending on this rather than on SupabaseClient itself is what lets the
 * test supply a small fake without reconstructing postgrest-js's
 * generics.
 *
 * HOW FAR THIS IS CHECKED, precisely. The first instinct was to assert
 * `SupabaseClient extends PendingInputStoreClient` and call the adapter
 * compiler-verified. That does not compile: postgrest-js's builder types
 * are generic enough that the full structural comparison hits TS2589
 * ("type instantiation is excessively deep"). So the full assertion is
 * not available, and this file does not pretend it is - the narrowing at
 * client() below is an explicit cast, resting on the method names being
 * read off the SDK rather than on the compiler agreeing.
 *
 * What IS checked is the shallow assertion further down: that the real
 * builder still HAS insert/select/delete as callable members. That
 * catches the realistic regression - an SDK upgrade renaming or dropping
 * a method - at `npm run typecheck`, and it is verified to fail when a
 * name is wrong. It says nothing about argument or return types, and
 * nothing about runtime behaviour.
 */
export interface PendingInputStoreClient {
  from(table: string): {
    insert(values: PendingInputRow): PromiseLike<{ error: { message: string } | null }>;
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        maybeSingle(): PromiseLike<{
          data: PendingInputRow | null;
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
 * Compile-time only, and shallow on purpose (see the interface above for
 * why the deep version is not available). Each of these is `true` exactly
 * while the real query builder still exposes that method as callable; if
 * an SDK upgrade renames one, the corresponding line stops compiling.
 * Verified to behave that way - a deliberately wrong member name was
 * checked to produce TS2322 before this was relied on.
 */
type RealQueryBuilder = ReturnType<SupabaseClient["from"]>;
type HasInsert = RealQueryBuilder["insert"] extends (...args: never[]) => unknown ? true : false;
type HasSelect = RealQueryBuilder["select"] extends (...args: never[]) => unknown ? true : false;
type HasDelete = RealQueryBuilder["delete"] extends (...args: never[]) => unknown ? true : false;

const _sdkStillHasTheMethodsThisFileCalls: [HasInsert, HasSelect, HasDelete] = [true, true, true];
void _sdkStillHasTheMethodsThisFileCalls;

/**
 * The one place the real client is narrowed to the interface above. An
 * explicit cast, not an inferred assignment: the compiler cannot complete
 * the structural check (TS2589), so this is the seam where hand-read SDK
 * knowledge is asserted, and therefore the seam a live-environment test
 * is actually testing.
 */
function client(): PendingInputStoreClient {
  return getServerSupabaseClient() as unknown as PendingInputStoreClient;
}

function toPendingInput(row: PendingInputRow): PendingInput {
  return {
    data: row.data,
    paymentIntentId: row.payment_intent_id,
    expiresAt: Date.parse(row.expires_at),
  };
}

/**
 * Deletes every row past its expiry. Exported for a scheduler to call
 * directly - the SQL side has its own pg_cron job doing the same delete,
 * and either is sufficient; having both means the sweep does not stop
 * when one of them is unavailable.
 *
 * Returns nothing and throws nothing on a database error, by design: this
 * is housekeeping, and a customer's payment must not fail because a
 * cleanup query did. The error surfaces in logs instead.
 */
export async function sweepExpiredPendingInputs(now: number = Date.now()): Promise<void> {
  const { error } = await client().from(TABLE).delete().lte("expires_at", new Date(now).toISOString());
  if (error !== null) {
    console.error(`[pending-input] expiry sweep failed: ${error.message}`);
  }
}

export async function storePendingInput(entry: {
  data: WizardData;
  paymentIntentId: string;
}): Promise<string> {
  const now = Date.now();
  const token = randomUUID();

  const { error } = await client()
    .from(TABLE)
    .insert({
      token,
      data: entry.data,
      payment_intent_id: entry.paymentIntentId,
      expires_at: new Date(now + PENDING_TTL_MS).toISOString(),
    });

  // This one DOES throw. A failed write means the customer is about to
  // pay for input that no longer exists anywhere; failing now, before the
  // payment, is the only outcome that does not cost them money.
  if (error !== null) {
    throw new Error(`Could not store pending input: ${error.message}`);
  }

  // After the write, not before: a slow sweep must never delay the row
  // the customer is waiting on, and a failing one must not prevent it.
  void sweepExpiredPendingInputs(now);

  return token;
}

/**
 * Reads without consuming. The payment page needs to show what is being
 * paid for before the payment exists, so it cannot be the same call that
 * removes the entry.
 *
 * Expiry is enforced here as well as by the sweep. The sweep is
 * eventually-consistent housekeeping; this check is the guarantee, and it
 * is what makes an expired row unreadable the instant it expires rather
 * than whenever cleanup next runs.
 */
export async function readPendingInput(token: string): Promise<PendingInput | null> {
  const { data, error } = await client().from(TABLE).select("*").eq("token", token).maybeSingle();

  if (error !== null) {
    // A read failure is not "no such token": returning null would tell
    // the caller the input is gone, and the release step would refuse a
    // report the customer has already paid for. Throwing keeps a
    // transient database problem distinguishable from a genuinely
    // missing row.
    throw new Error(`Could not read pending input: ${error.message}`);
  }
  if (data === null) return null;

  const entry = toPendingInput(data);
  if (entry.expiresAt <= Date.now()) {
    void deleteToken(token);
    return null;
  }
  return entry;
}

/**
 * Reads and immediately removes - each token releases exactly one report.
 * The release step uses this, so a replayed request cannot mint a second
 * report from one payment.
 *
 * NOTE for the live swap, stated because it is a real limitation rather
 * than a theoretical one: read-then-delete is not atomic. Two identical
 * requests arriving at the same instant can both read the row before
 * either deletes it, and both would be served. The Map version has the
 * same gap and it never mattered, because one process handled both; on
 * Vercel two instances genuinely can. The fix is a single-statement
 * `delete ... where token = $1 returning *` via an RPC, which is one
 * function in a follow-up migration. Left out here on purpose: it needs a
 * live database to verify, and shipping it unverified alongside code that
 * is honestly labelled unverified would blur which is which.
 */
export async function takePendingInput(token: string): Promise<PendingInput | null> {
  const entry = await readPendingInput(token);
  if (entry === null) return null;

  const { error } = await client().from(TABLE).delete().eq("token", token);
  if (error !== null) {
    // Deliberately not fatal. The report has been paid for; refusing to
    // release it because the cleanup delete failed would punish the
    // customer for a database hiccup. The row expires on its own anyway.
    console.error(`[pending-input] could not delete consumed token: ${error.message}`);
  }
  return entry;
}

async function deleteToken(token: string): Promise<void> {
  const { error } = await client().from(TABLE).delete().eq("token", token);
  if (error !== null) {
    console.error(`[pending-input] could not delete expired token: ${error.message}`);
  }
}

export { PENDING_INPUT_COOKIE, PENDING_TTL_MS } from "./pending-input";
export type { PendingInput } from "./pending-input";
