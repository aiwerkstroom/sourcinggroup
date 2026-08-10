/**
 * Exit: sale price, selling costs, capital gains tax and the net proceeds
 * after redeeming the mortgage (MODEL_SPEC_FASE1B §5, corrected to the
 * actual IRNR non-resident capital gains method - Agencia Tributaria,
 * "Ganancias patrimoniales - Impuesto sobre la Renta de no Residentes",
 * Modelo 210 instructions).
 *
 * The IRNR taxable gain is NOT sellingPrice minus acquisition cost. It is:
 *
 *   ganancia = valor de transmisión - valor de adquisición
 *
 * where valor de transmisión is the sale price minus the transfer costs
 * the SELLER bears (commission, plusvalía) - not the raw sale price. Those
 * same two costs are also subtracted in netSaleProceeds (the actual cash
 * received); that is not a double count, it is the same expense affecting
 * two different quantities (taxable gain vs. cash in hand).
 *
 * Two inputs have no source this engine can derive them from - the selling
 * commission and the municipal capital gains tax (plusvalía) - and are
 * required arguments with no default (see ExitAssumptions in types.ts).
 * A caller that doesn't have real figures yet should not call this
 * function with a guess.
 */

import { propertyValueIndex } from "./indexation";
import {
  CAPITAL_GAINS_TAX_RATE_NON_RESIDENT,
  NON_RESIDENT_WITHHOLDING_RATE,
} from "./parameters";
import type {
  AcquisitionCosts,
  ExitAssumptions,
  ExitResult,
  ProjectionYear,
  ScenarioId,
} from "./types";

export function computeExit(args: {
  scenario: ScenarioId;
  /** The projection's final year: its yearNumber is the holding period, its mortgageBalance the debt to redeem at sale. */
  finalYear: Pick<ProjectionYear, "yearNumber" | "mortgageBalance">;
  purchasePrice: number;
  /** Acquisition costs the law lets you deduct from the capital gain - ITP, AJD, notary, registration, legal advice. Agency fees and the bank fee are deliberately excluded (MODEL_SPEC_FASE1B §5). */
  acquisition: Pick<
    AcquisitionCosts,
    "transferTaxITP" | "stampDutyAJD" | "notaryFee" | "registrationFee" | "legalAdvice"
  >;
  assumptions: ExitAssumptions;
}): ExitResult {
  const holdingYears = args.finalYear.yearNumber;
  const sellingPrice = args.purchasePrice * propertyValueIndex(args.scenario, holdingYears);

  const sellingCommission = sellingPrice * args.assumptions.sellingCommissionRate;

  // "Valor de transmisión": sale price minus the transfer costs the seller
  // bears. Not the same quantity as netSaleProceeds, even though both
  // subtract commission and plusvalía - see the module docstring.
  const transferValueForCapitalGainsTax =
    sellingPrice - sellingCommission - args.assumptions.municipalCapitalGainsTax;

  const acquisitionValueForCapitalGainsTax =
    args.purchasePrice +
    args.acquisition.transferTaxITP +
    args.acquisition.stampDutyAJD +
    args.acquisition.notaryFee +
    args.acquisition.registrationFee +
    args.acquisition.legalAdvice;

  const capitalGain = transferValueForCapitalGainsTax - acquisitionValueForCapitalGainsTax;
  // A loss owes no capital gains tax; it is not a deduction elsewhere, so
  // it is clamped at zero rather than reported as a negative tax.
  const capitalGainsTax = Math.max(0, capitalGain) * CAPITAL_GAINS_TAX_RATE_NON_RESIDENT;

  const netSaleProceeds =
    sellingPrice -
    sellingCommission -
    args.assumptions.municipalCapitalGainsTax -
    capitalGainsTax -
    args.finalYear.mortgageBalance;

  const nonResidentWithholdingAdvance = sellingPrice * NON_RESIDENT_WITHHOLDING_RATE;

  return {
    scenario: args.scenario,
    holdingYears,
    sellingPrice,
    sellingCommission,
    municipalCapitalGainsTax: args.assumptions.municipalCapitalGainsTax,
    transferValueForCapitalGainsTax,
    acquisitionValueForCapitalGainsTax,
    capitalGain,
    capitalGainsTax,
    mortgageBalanceAtExit: args.finalYear.mortgageBalance,
    netSaleProceeds,
    nonResidentWithholdingAdvance,
  };
}
