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
 *
 * The acquisition value is also reduced by the cumulative depreciation
 * deducted over the holding period (valor de adquisición = coste -
 * amortizaciones fiscalmente deducidas, Agencia Tributaria). That figure
 * is summed directly from the projection's own per-year depreciation
 * track (§4) - the full `years` array is passed in for exactly this, not
 * a second, independent depreciation calculation that could drift out of
 * sync with what the tax layer actually used.
 */

import { propertyValueIndex } from "./indexation";
import {
  CAPITAL_GAINS_TAX_RATE_NON_RESIDENT,
  DEFAULT_RENOVATION_IMPROVEMENT_SHARE,
  NON_RESIDENT_WITHHOLDING_RATE,
} from "./parameters";
import type {
  AcquisitionCosts,
  ExitAssumptions,
  ExitResult,
  ProjectionYear,
  RenovationStrategyResult,
  ScenarioId,
} from "./types";

export function computeExit(args: {
  scenario: ScenarioId;
  /**
   * The full projection, year 1..n (§4). The holding period is n
   * (the last year's yearNumber), the debt to redeem at sale is the last
   * year's mortgageBalance, and the cumulative depreciation deducted from
   * the acquisition value is the sum of every year's depreciation - all
   * read from this single array, nothing recomputed.
   */
  years: ReadonlyArray<Pick<ProjectionYear, "yearNumber" | "mortgageBalance" | "depreciation">>;
  purchasePrice: number;
  /** Acquisition costs the law lets you deduct from the capital gain - ITP, AJD, notary, registration, legal advice. Agency fees and the bank fee are deliberately excluded (MODEL_SPEC_FASE1B §5). */
  acquisition: Pick<
    AcquisitionCosts,
    "transferTaxITP" | "stampDutyAJD" | "notaryFee" | "registrationFee" | "legalAdvice"
  >;
  /** The selected renovation strategy's CapEx; only renovationImprovementShare of this counts toward the acquisition value. */
  renovation: Pick<RenovationStrategyResult, "capex">;
  assumptions: ExitAssumptions;
  /**
   * Share of the renovation CapEx that qualifies as "mejora" and raises
   * the acquisition value. Defaults to DEFAULT_RENOVATION_IMPROVEMENT_SHARE
   * (0) - see the TODO on that constant; do not pass a nonzero share
   * without a documented basis.
   */
  renovationImprovementShare?: number;
}): ExitResult {
  if (args.years.length === 0) {
    throw new Error("computeExit needs at least one projection year");
  }
  const finalYear = args.years[args.years.length - 1]!;
  const holdingYears = finalYear.yearNumber;
  const sellingPrice = args.purchasePrice * propertyValueIndex(args.scenario, holdingYears);

  const sellingCommission = sellingPrice * args.assumptions.sellingCommissionRate;

  // "Valor de transmisión": sale price minus the transfer costs the seller
  // bears. Not the same quantity as netSaleProceeds, even though both
  // subtract commission and plusvalía - see the module docstring.
  const transferValueForCapitalGainsTax =
    sellingPrice - sellingCommission - args.assumptions.municipalCapitalGainsTax;

  const renovationImprovementShare =
    args.renovationImprovementShare ?? DEFAULT_RENOVATION_IMPROVEMENT_SHARE;
  const renovationImprovementValue = args.renovation.capex * renovationImprovementShare;

  // Exactly what §4's tax layer deducted, summed from its own track - not
  // an independent recomputation via DEPRECIATION_RATE and a share.
  const cumulativeDepreciation = args.years.reduce((sum, y) => sum + y.depreciation, 0);

  const acquisitionValueForCapitalGainsTax =
    args.purchasePrice +
    args.acquisition.transferTaxITP +
    args.acquisition.stampDutyAJD +
    args.acquisition.notaryFee +
    args.acquisition.registrationFee +
    args.acquisition.legalAdvice +
    renovationImprovementValue -
    cumulativeDepreciation;

  const capitalGain = transferValueForCapitalGainsTax - acquisitionValueForCapitalGainsTax;
  // A loss owes no capital gains tax; it is not a deduction elsewhere, so
  // it is clamped at zero rather than reported as a negative tax.
  const capitalGainsTax = Math.max(0, capitalGain) * CAPITAL_GAINS_TAX_RATE_NON_RESIDENT;

  const netSaleProceeds =
    sellingPrice -
    sellingCommission -
    args.assumptions.municipalCapitalGainsTax -
    capitalGainsTax -
    finalYear.mortgageBalance;

  const nonResidentWithholdingAdvance = sellingPrice * NON_RESIDENT_WITHHOLDING_RATE;

  return {
    scenario: args.scenario,
    holdingYears,
    sellingPrice,
    sellingCommission,
    municipalCapitalGainsTax: args.assumptions.municipalCapitalGainsTax,
    transferValueForCapitalGainsTax,
    renovationImprovementValue,
    cumulativeDepreciation,
    acquisitionValueForCapitalGainsTax,
    capitalGain,
    capitalGainsTax,
    mortgageBalanceAtExit: finalYear.mortgageBalance,
    netSaleProceeds,
    nonResidentWithholdingAdvance,
  };
}
