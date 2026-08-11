/**
 * Operating costs: utilities base and the fixed annual cost block.
 * Replicates Costs & Income!F50:H60 and B155:D179.
 */

import {
  BANK_FEE,
  PROPERTY_TAX_IBI_RATE,
  TOTAL_INSURANCE_ANNUAL,
  TOTAL_UTILITIES_PER_M2_ANNUAL,
} from "./parameters";
import type { FixedOperatingCosts } from "./types";

/** Utilities base €/year: (gas + water + electricity per m²) x living area (H60). */
export function utilitiesBaseAnnual(livingAreaM2: number): number {
  return TOTAL_UTILITIES_PER_M2_ANNUAL.value * livingAreaM2;
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
}): FixedOperatingCosts {
  const propertyTaxIBI = args.purchasePrice * PROPERTY_TAX_IBI_RATE.value;
  const insurance = TOTAL_INSURANCE_ANNUAL.value;
  const bankAccountFee = BANK_FEE.value;
  const communityFees = args.communityFeesAnnual;
  const mortgageInterest = args.mortgageAmount * args.effectiveInterestRate;
  return {
    propertyTaxIBI,
    insurance,
    bankAccountFee,
    communityFees,
    mortgageInterest,
    total: propertyTaxIBI + insurance + bankAccountFee + communityFees + mortgageInterest,
  };
}
