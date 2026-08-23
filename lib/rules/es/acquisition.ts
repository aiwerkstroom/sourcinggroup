/**
 * Acquisition costs (Spain, existing build) and budget compliance.
 * Replicates Costs & Income!B125:H153.
 */

import { ACQUISITION_RATES, BANK_FEE, LEGAL_ADVICE_FEE } from "./parameters";
import type { AcquisitionCosts, AcquisitionCostRates, InvestorConstraints } from "./types";

/**
 * The acquisition cost rates as shares of the purchase price, summed -
 * what a buyer must budget on top of the asking price.
 *
 * Exists so the free indication can name that figure without inventing
 * one: it reads exactly the parameters acquisitionCosts() charges below,
 * so the free page and the paid report cannot quote different numbers.
 * Everything here is a share of the purchase price; BANK_FEE is left out
 * because it is a flat euro amount, not a rate (EUR 100, immaterial
 * against a percentage of a property price, and it would make this
 * function price-dependent for no gain).
 *
 * Split rather than a single total, because the two halves are different
 * kinds of cost. `mandatory` is what any buyer pays whoever they buy
 * through - two taxes and three professional fees. `agency` is a purchase
 * agent's fee, which not every buyer incurs. Presenting only the sum
 * would overstate the unavoidable part; presenting only `mandatory` would
 * understate what this model actually charges in acquisitionCosts().
 */
export function acquisitionCostRates(): AcquisitionCostRates {
  const r = ACQUISITION_RATES.value;
  const mandatory =
    r.transferTaxITP + r.stampDutyAJD + r.notaryFee + r.registrationFee + LEGAL_ADVICE_FEE.value;
  return { mandatory, agency: r.agencyFee, total: mandatory + r.agencyFee };
}

export function acquisitionCosts(args: {
  purchasePrice: number;
  renovationCosts: number;
  mortgageAmount: number;
  constraints: Pick<InvestorConstraints, "totalBudget" | "maxRenovationBudget">;
}): AcquisitionCosts {
  const p = args.purchasePrice;
  const transferTaxITP = p * ACQUISITION_RATES.value.transferTaxITP;
  const stampDutyAJD = p * ACQUISITION_RATES.value.stampDutyAJD;
  const notaryFee = p * ACQUISITION_RATES.value.notaryFee;
  const registrationFee = p * ACQUISITION_RATES.value.registrationFee;
  const legalAdvice = p * LEGAL_ADVICE_FEE.value;
  const agencyFees = p * ACQUISITION_RATES.value.agencyFee;
  const bankFee = BANK_FEE.value;
  const total =
    p +
    args.renovationCosts +
    transferTaxITP +
    stampDutyAJD +
    notaryFee +
    registrationFee +
    legalAdvice +
    agencyFees +
    bankFee;
  const equityRequired = total - args.mortgageAmount;
  return {
    purchasePrice: p,
    renovationCosts: args.renovationCosts,
    transferTaxITP,
    stampDutyAJD,
    notaryFee,
    registrationFee,
    legalAdvice,
    agencyFees,
    bankFee,
    total,
    mortgageAmount: args.mortgageAmount,
    equityRequired,
    // Excel H149 compares the required equity with the total budget.
    withinTotalBudget: equityRequired <= args.constraints.totalBudget,
    renovationWithinBudget:
      args.renovationCosts <= args.constraints.maxRenovationBudget,
  };
}
