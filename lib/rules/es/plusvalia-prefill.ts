/**
 * A starting-point estimate for step 4's plusvalía municipal field
 * (datakwaliteitsfix stap 2), on the same architecture rent-prefill.ts
 * already established for step 3's rent fields: pre-fill, always
 * overridable, calculation layer never sees this module - only the
 * number the customer confirms in the form does.
 *
 * That architecture is what makes this safe to ship despite the real
 * uncertainty in PLUSVALIA_VALENCIA_COEFFICIENTS/_RATE (see their own
 * docstrings in parameters.ts for exactly what is and is not verified).
 * A wrong coefficient here produces a wrong SUGGESTION the customer sees
 * and can correct before anything is computed - not a wrong CALCULATION,
 * which is the distinction that let this ship as a PLACEHOLDER rather
 * than being blocked on a source this sandbox could not reach.
 *
 * Formula, standard across every Spanish municipality:
 *   plusvalía = land cadastral value x coefficient(years held) x tax rate
 *
 * Server-side only in practice (reads parameters.ts), reached through a
 * Server Action for the same reason rent-prefill.ts is: parameters.ts is
 * one module, and importing any part of it into a client component would
 * pull TSG_SCORE_DIMENSION_WEIGHTS in with it.
 */

import { PLUSVALIA_VALENCIA_COEFFICIENTS, PLUSVALIA_VALENCIA_RATE } from "./parameters";

export type PlusvaliaPrefillSource = "cadastralEstimate" | "none";

export interface PlusvaliaPrefill {
  /** Whole euros, or null when no estimate could be formed. */
  estimatedTax: number | null;
  source: PlusvaliaPrefillSource;
  /** The coefficient actually looked up, so the form can show its working. */
  coefficientUsed: number | null;
  taxRate: number;
}

const MIN_YEARS = 0;
const MAX_YEARS = 20;

/** Clamps to the table's own range - under 1 year and 20-or-more both sit at their nearest defined band. */
function coefficientForYears(years: number): number {
  const clamped = Math.max(MIN_YEARS, Math.min(MAX_YEARS, Math.round(years)));
  return PLUSVALIA_VALENCIA_COEFFICIENTS.value[clamped]!;
}

export function computePlusvaliaPrefill(args: {
  /** StaatEnLastenStepData.cadastralSuelo (step 2), parsed. Undefined when not given - MODEL_SPEC.md §16 keeps it optional. */
  cadastralSuelo?: number;
  /** BeleggerStepData.holdingYears (step 3), parsed. */
  holdingYears?: number;
}): PlusvaliaPrefill {
  const taxRate = PLUSVALIA_VALENCIA_RATE.value;

  if (
    args.cadastralSuelo === undefined ||
    args.cadastralSuelo <= 0 ||
    args.holdingYears === undefined ||
    args.holdingYears < 0
  ) {
    return { estimatedTax: null, source: "none", coefficientUsed: null, taxRate };
  }

  const coefficientUsed = coefficientForYears(args.holdingYears);
  const estimatedTax = Math.round(args.cadastralSuelo * coefficientUsed * taxRate);

  return { estimatedTax, source: "cadastralEstimate", coefficientUsed, taxRate };
}
