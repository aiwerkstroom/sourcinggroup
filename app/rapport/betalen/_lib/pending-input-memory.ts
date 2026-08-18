import { randomUUID } from "node:crypto";
import type { WizardData } from "@/app/rapport/nieuw/_state/wizard-state";
import { PENDING_TTL_MS } from "./pending-input-contract";
import type { PendingInput } from "./pending-input-contract";

/**
 * The IN-MEMORY pending-input store. No longer what the payment flow
 * runs on: since fase 4 stap 3's live swap, pending-input.ts resolves to
 * pending-input-supabase.ts, and this module is reached only when
 * TSG_PENDING_STORE=memory is set explicitly - which the route-level
 * golden tests do, because they drive a real `next start` server with no
 * database behind it.
 *
 * Kept rather than deleted for exactly that reason: it is what lets those
 * tests exercise the real routes end to end. It is NOT a production
 * fallback, and pending-input.ts is built so that a missing Supabase key
 * cannot land here by accident - see that file.
 *
 * Original purpose, still the reason the contract looks like this:
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
 * WHY THIS SHAPE SURVIVED THE SWAP. These functions were async from the
 * first version even though a Map needs no await, precisely so a database
 * round trip could slot in later without touching a single call site.
 * That is what made fase 4 stap 3's swap a change to one module rather
 * than to six - the prediction held.
 */

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
