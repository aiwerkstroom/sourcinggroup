/**
 * Acquisition costs (Spain, existing build) and budget compliance.
 * Replicates Costs & Income!B125:H153.
 */

import { ACQUISITION_RATES, BANK_FEE, LEGAL_ADVICE_FEE } from "./parameters";
import type { AcquisitionCosts, InvestorConstraints } from "./types";

export function acquisitionCosts(args: {
  purchasePrice: number;
  renovationCosts: number;
  mortgageAmount: number;
  constraints: Pick<InvestorConstraints, "totalBudget" | "maxRenovationBudget">;
}): AcquisitionCosts {
  const p = args.purchasePrice;
  const transferTaxITP = p * ACQUISITION_RATES.transferTaxITP;
  const stampDutyAJD = p * ACQUISITION_RATES.stampDutyAJD;
  const notaryFee = p * ACQUISITION_RATES.notaryFee;
  const registrationFee = p * ACQUISITION_RATES.registrationFee;
  const legalAdvice = p * LEGAL_ADVICE_FEE;
  const agencyFees = p * ACQUISITION_RATES.agencyFee;
  const bankFee = BANK_FEE;
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
