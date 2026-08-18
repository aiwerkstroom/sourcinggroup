import type { WizardData } from "@/app/rapport/nieuw/_state/wizard-state";

/**
 * What both pending-input implementations agree on: the cookie name, the
 * lifetime, and the shape of one entry.
 *
 * Split out when the Supabase adapter became the real implementation
 * (fase 4 stap 3, live swap). Before that, the in-memory module owned
 * these and the adapter imported them from it - which was fine while
 * pending-input.ts *was* the Map, but became a cycle the moment
 * pending-input.ts had to point at the adapter instead. A third module
 * that depends on neither breaks it.
 *
 * Deliberately free of any runtime import beyond a type. Both
 * implementations, and every caller, can reach this without dragging in
 * either the Supabase SDK or the Map.
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
