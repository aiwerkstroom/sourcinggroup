/**
 * Acquisition costs (Spain, existing build) and budget compliance.
 * Replicates Costs & Income!B125:H153, with one deliberate divergence -
 * see chargedRates() below.
 */

import { ACQUISITION_RATES, BANK_FEE, LEGAL_ADVICE_FEE } from "./parameters";
import type { AcquisitionCostRates, AcquisitionCosts, InvestorConstraints } from "./types";

/**
 * The rates this model actually charges an existing-build purchase, as
 * shares of the purchase price. One definition, read by both
 * acquisitionCosts() (which prices a specific deal) and
 * acquisitionCostRates() (which quotes the headline percentage on the
 * free indication), so the two cannot quote different figures.
 *
 * DELIBERATE DIVERGENCE FROM THE WORKBOOK: stampDutyAJD is zero here,
 * where Costs & Income!B125:H153 charges it alongside ITP on the full
 * purchase price. In Spain the two are alternatives, not companions -
 * ITP is the transfer tax on a second-hand sale, AJD the stamp duty on a
 * new-build deed (beside IVA). A resale buyer pays ITP and no AJD on the
 * purchase deed at all; the AJD that does arise on the *mortgage* deed
 * has been the lender's liability since the 2018 reform, not the buyer's.
 * Charging both on the purchase price overstated acquisition costs by
 * 1.5% of the price for every deal this model has ever priced.
 *
 * The same class of correction as the tax-residency fix: the workbook
 * carried the error, and matching it would mean publishing a figure we
 * know to be wrong. MODEL_SPEC.md §22 records it.
 *
 * ACQUISITION_RATES.stampDutyAJD itself is kept, not deleted: the rate is
 * real and correctly sourced, it is simply not owed on this transaction
 * type. Nothing in the engine distinguishes new build from existing build
 * today - "existing build" is the only path through the code - so a
 * future new-build path is where that parameter comes back into use, and
 * it stays documented and available for it.
 */
function chargedRates() {
  const r = ACQUISITION_RATES.value;
  return {
    transferTaxITP: r.transferTaxITP,
    stampDutyAJD: 0,
    notaryFee: r.notaryFee,
    registrationFee: r.registrationFee,
    legalAdvice: LEGAL_ADVICE_FEE.value,
    agencyFee: r.agencyFee,
  };
}

/**
 * The acquisition cost rates as shares of the purchase price, summed -
 * what a buyer must budget on top of the asking price.
 *
 * Exists so the free indication can name that figure without inventing
 * one. It reads chargedRates(), exactly as acquisitionCosts() does, so
 * the free page and the paid report cannot quote different numbers.
 * BANK_FEE is left out because it is a flat euro amount, not a rate
 * (EUR 100, immaterial against a percentage of a property price, and it
 * would make this function price-dependent for no gain).
 *
 * Split rather than a single total, because the two halves are different
 * kinds of cost. `mandatory` is what any buyer pays whoever they buy
 * through - the transfer tax and three professional fees. `agency` is a
 * purchase agent's fee, which not every buyer incurs. Presenting only the
 * sum would overstate the unavoidable part; presenting only `mandatory`
 * would understate what this model actually charges.
 */
export function acquisitionCostRates(): AcquisitionCostRates {
  const r = chargedRates();
  const mandatory =
    r.transferTaxITP + r.stampDutyAJD + r.notaryFee + r.registrationFee + r.legalAdvice;
  return { mandatory, agency: r.agencyFee, total: mandatory + r.agencyFee };
}

export function acquisitionCosts(args: {
  purchasePrice: number;
  renovationCosts: number;
  mortgageAmount: number;
  constraints: Pick<InvestorConstraints, "totalBudget" | "maxRenovationBudget">;
}): AcquisitionCosts {
  const p = args.purchasePrice;
  const r = chargedRates();
  const transferTaxITP = p * r.transferTaxITP;
  const stampDutyAJD = p * r.stampDutyAJD;
  const notaryFee = p * r.notaryFee;
  const registrationFee = p * r.registrationFee;
  const legalAdvice = p * r.legalAdvice;
  const agencyFees = p * r.agencyFee;
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
    // Zero on an existing-build purchase - see chargedRates(). The field
    // stays on the result rather than disappearing: it is a real line of
    // a Spanish purchase, and a reader comparing this breakdown against
    // their own notario's figures should see it named and at zero rather
    // than absent.
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
