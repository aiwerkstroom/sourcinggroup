import { randomUUID } from "node:crypto";
import type { WizardData } from "@/app/rapport/nieuw/_state/wizard-state";

/**
 * Holds the wizard's input across the payment step (fase 4 stap 2).
 *
 * The problem this exists for: runEngine() runs only after a successful
 * payment, so WizardData has to survive the gap between "leaving step 4"
 * and "coming back paid". React context alone cannot carry that. It
 * survives client-side navigation between routes under /rapport/layout.tsx
 * - which is exactly how the wizard reaches the result page today - but a
 * payment is not always a client-side navigation. Card payments confirmed
 * in-page stay in the document; iDEAL, Bancontact, SEPA mandates and
 * 3-D Secure challenges send the browser to another origin and back to a
 * return_url. That return is a cold document load: context gone, input
 * gone. For a Dutch audience those are the likely methods, not the edge
 * case, so the mechanism has to survive a full page load or it only works
 * for the path customers use least.
 *
 * Hence: server-side, keyed by an opaque token the browser carries in an
 * httpOnly cookie. The address and the financial figures never enter a
 * URL and never enter browser storage - wizard-state.tsx refused the
 * latter deliberately, and this does not quietly reverse that. What the
 * browser holds is a UUID and nothing else.
 *
 * Nothing here is permanent. An entry lives for PENDING_TTL_MS and is
 * deleted the moment it is consumed, which keeps this inside the phase
 * boundary: report storage tied to an account is stap 3's job, not this
 * one's.
 *
 * THE SWAP POINT. The two functions below are the seam. Locally and in
 * this sandbox they are backed by an in-memory Map, the same proven shape
 * as fase 3's pending-results.ts. That only holds within a single server
 * process - and on Vercel it will not, because separate invocations are
 * separate instances and this entry has to survive minutes and several
 * requests, not the few seconds fase 3's PDF handoff needs. On a
 * multi-instance deployment the Map becomes a Supabase row with an
 * expires_at column; the callers do not change, because these functions
 * are already async precisely so a database round trip can slot in
 * without touching a single call site. That row is the same storage fase
 * 4 stap 3 introduces anyway - the same work, arriving in the right
 * order.
 */

/**
 * Thirty minutes. Fase 3's equivalent uses thirty seconds, which is right
 * for a handoff Playwright completes immediately; a person paying is a
 * different clock - a bank app, a 3-D Secure challenge, a second attempt
 * after a declined card. Roughly matches how long a real Stripe
 * PaymentIntent stays actionable.
 */
export const PENDING_TTL_MS = 30 * 60 * 1000;

/** The httpOnly cookie carrying the token. Exported so every reader uses one name, not a literal that can drift. */
export const PENDING_INPUT_COOKIE = "tsg-pending-report";

export interface PendingInput {
  data: WizardData;
  /**
   * The intent this input is being paid for. Stored alongside rather than
   * looked up later, so the release step cannot be talked into pairing a
   * payment for one intent with the input of another: one entry, one
   * intent, decided at creation.
   */
  paymentIntentId: string;
  expiresAt: number;
}

const globalKey = Symbol.for("tsg.pendingInputs");
type GlobalWithPending = typeof globalThis & { [globalKey]?: Map<string, PendingInput> };
const g = globalThis as GlobalWithPending;
const pending = (g[globalKey] ??= new Map<string, PendingInput>());

/**
 * Expiry is a stored timestamp checked on read, rather than a setTimeout
 * per entry as fase 3 uses. At thirty seconds a timer is fine; at thirty
 * minutes it would mean a live timer per abandoned checkout, and a
 * timestamp is also what the Supabase version will actually have in a
 * column - so the local shape matches the one it swaps into.
 */
function sweepExpired(now: number): void {
  for (const [token, entry] of pending) {
    if (entry.expiresAt <= now) pending.delete(token);
  }
}

export async function storePendingInput(entry: {
  data: WizardData;
  paymentIntentId: string;
}): Promise<string> {
  const now = Date.now();
  sweepExpired(now);

  const token = randomUUID();
  pending.set(token, { ...entry, expiresAt: now + PENDING_TTL_MS });
  return token;
}

/**
 * Reads without consuming. The payment page needs to show what is being
 * paid for before the payment exists, so it cannot be the same call that
 * removes the entry.
 */
export async function readPendingInput(token: string): Promise<PendingInput | null> {
  const entry = pending.get(token);
  if (entry === undefined) return null;
  if (entry.expiresAt <= Date.now()) {
    pending.delete(token);
    return null;
  }
  return entry;
}

/**
 * Reads and immediately removes - each token releases exactly one report.
 * The release step (stap 4) uses this, so a replayed request cannot mint
 * a second report from one payment.
 */
export async function takePendingInput(token: string): Promise<PendingInput | null> {
  const entry = await readPendingInput(token);
  if (entry === null) return null;
  pending.delete(token);
  return entry;
}
