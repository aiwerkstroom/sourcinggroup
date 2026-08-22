/**
 * Operating costs: utilities base and the fixed annual cost block.
 * Replicates Costs & Income!F50:H60 and B155:D179.
 */

import {
  BANK_FEE,
  DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO,
  PROJECTION_YEARS,
  PROPERTY_TAX_IBI_RATE,
  TOTAL_INSURANCE_ANNUAL,
  TOTAL_UTILITIES_PER_M2_ANNUAL,
} from "./parameters";
import type { CadastralValue, FixedOperatingCosts } from "./types";

/** Utilities base €/year: (gas + water + electricity per m²) x built area (H60). */
export function utilitiesBaseAnnual(builtAreaM2: number): number {
  return TOTAL_UTILITIES_PER_M2_ANNUAL.value * builtAreaM2;
}

/**
 * Fixed annual operating costs (D159-D167). Shown alongside the scenario
 * layer in the Excel; the scenario cashflow itself only subtracts the
 * income-linked opex + debt service (see MODEL_SPEC.md, observations).
 */
export function fixedOperatingCosts(args: {
  purchasePrice: number;
  mortgageAmount: number;
  /** Selected rate + non-resident spread, Excel D165 = D149*(D123+D124). */
  effectiveInterestRate: number;
  /** PropertyInput.communityFeesAnnual - gastos de comunidad, no default. */
  communityFeesAnnual: number;
  /** PropertyInput.cadastralValue - when given, IBI is computed over it instead of approximating with purchasePrice (MODEL_SPEC.md §16). */
  cadastralValue?: CadastralValue;
  /**
   * PropertyInput.upcomingDerramasEstimate, €, total - datakwaliteitsfix
   * stap 4. Spread evenly over PROJECTION_YEARS.value rather than charged
   * as a one-off: this figure feeds the same steady-state annual cost
   * lines (scenarios.ts, tax.ts) that never see year-specific timing, so a
   * one-off would have to land somewhere arbitrary in that pipeline. An
   * even spread is the simplest change that is still defensible - it is
   * the anticipated cost's honest annual run-rate over the model's own
   * horizon, not a claim about which calendar year the levy is actually due.
   */
  upcomingDerramasEstimate?: number;
}): FixedOperatingCosts {
  const propertyTaxIBI = args.cadastralValue
    ? (args.cadastralValue.suelo + args.cadastralValue.construccion) * PROPERTY_TAX_IBI_RATE.value
    : args.purchasePrice *
      PROPERTY_TAX_IBI_RATE.value *
      DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO.value;
  const insurance = TOTAL_INSURANCE_ANNUAL.value;
  const bankAccountFee = BANK_FEE.value;
  const communityFees = args.communityFeesAnnual;
  const derramas = (args.upcomingDerramasEstimate ?? 0) / PROJECTION_YEARS.value;
  const mortgageInterest = args.mortgageAmount * args.effectiveInterestRate;
  return {
    propertyTaxIBI,
    insurance,
    bankAccountFee,
    communityFees,
    derramas,
    mortgageInterest,
    total:
      propertyTaxIBI + insurance + bankAccountFee + communityFees + derramas + mortgageInterest,
  };
}
