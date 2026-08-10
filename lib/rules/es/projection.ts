/**
 * Multi-year cashflow after tax (MODEL_SPEC_FASE1B §4).
 *
 * The IRR needs the investor's actual net cashflow, so the tax layer runs
 * every year instead of once. The one thing that must not be simplified
 * away: the deductible mortgage interest is the interest *portion* of that
 * year's annuity payment, which shrinks every year as the loan amortizes -
 * not the flat "interest-only" figure phase 1 used for its single-year tax
 * estimate. That is why this module builds its own amortization schedule
 * per scenario instead of reusing the annual debt service total.
 *
 * Depreciation also gets its own building-share input here rather than
 * reusing phase 1's fixed 80% (tax.ts, Excel parity): the real building
 * share of a purchase price is property-specific (cadastral suelo /
 * construcción split), not a universal constant, so this module takes it
 * as an explicit, overridable parameter (DEFAULT_BUILDING_SHARE_OF_VALUE).
 */

import { amortizationSchedule } from "./financing";
import { buildIndexSeries } from "./indexation";
import {
  DEFAULT_BUILDING_SHARE_OF_VALUE,
  DEPRECIATION_RATE,
  DEPRECIATION_SCENARIO_FACTORS,
  PROPERTY_MANAGEMENT_FEE,
  RENTAL_INCOME_TAX_RATE_EU,
  RENTAL_INCOME_TAX_RATE_NON_EU,
} from "./parameters";
import type {
  FixedOperatingCosts,
  ProjectionYear,
  ScenarioId,
  ScenarioResult,
  SelectedFinancing,
} from "./types";

export function buildProjectionYears(args: {
  years: number;
  startYear?: number;
  scenario: ScenarioId;
  /** Phase-1 (year-1) scenario outcome; its gross income and cost lines are the base every year indexes from. */
  scenarioResult: ScenarioResult;
  purchasePrice: number;
  financing: SelectedFinancing;
  /** Phase-1 fixed cost breakdown (IBI/insurance/bank fee), the year-1 base each is indexed from. */
  fixedCosts: Pick<FixedOperatingCosts, "propertyTaxIBI" | "insurance" | "bankAccountFee">;
  euResident: boolean;
  /**
   * Building share of the purchase value used for depreciation (3% per
   * year applies to this share, not the full price). Defaults to
   * DEFAULT_BUILDING_SHARE_OF_VALUE - a generic placeholder, not sourced
   * per property; see the TODO on that constant.
   */
  buildingShareOfValue?: number;
}): ProjectionYear[] {
  const indexSeries = buildIndexSeries({
    years: args.years,
    startYear: args.startYear,
    scenario: args.scenario,
  });

  // The scenario's stress-tested rate is fixed for the loan's life, same as
  // phase 1; only the interest/principal split changes year over year.
  const amortization = amortizationSchedule({
    annualRate: args.scenarioResult.interestRate,
    termYears: args.financing.loanTermYears,
    principal: args.financing.mortgageAmount,
    yearsToProject: args.years,
  });

  const buildingShareOfValue = args.buildingShareOfValue ?? DEFAULT_BUILDING_SHARE_OF_VALUE;
  const depreciationYear1 =
    args.purchasePrice *
    DEPRECIATION_RATE *
    buildingShareOfValue *
    DEPRECIATION_SCENARIO_FACTORS[args.scenario];
  const taxRate = args.euResident
    ? RENTAL_INCOME_TAX_RATE_EU
    : RENTAL_INCOME_TAX_RATE_NON_EU;

  return indexSeries.map((idx, i): ProjectionYear => {
    const amort = amortization[i]!;

    const grossIncome = args.scenarioResult.grossIncome * idx.rentIndex;
    // Property management is always a fixed % of that year's rent, so it
    // tracks the rent index directly rather than CPI.
    const propertyManagement = grossIncome * PROPERTY_MANAGEMENT_FEE;
    const maintenance = args.scenarioResult.maintenance * idx.costIndex;
    const utilities = args.scenarioResult.utilities * idx.costIndex;
    // IBI is levied on the cadastral value, which is set administratively
    // and does not track market price; absent a cadastral-value series it
    // is CPI-indexed like the other fixed cost lines (MODEL_SPEC.md §6/§10).
    const propertyTaxIBI = args.fixedCosts.propertyTaxIBI * idx.costIndex;
    const insurance = args.fixedCosts.insurance * idx.costIndex;
    const bankAccountFee = args.fixedCosts.bankAccountFee * idx.costIndex;
    const fixedCosts = propertyTaxIBI + insurance + bankAccountFee;

    const noi = grossIncome - (propertyManagement + maintenance + utilities + fixedCosts);

    const interestPaid = amort.interestPaid;
    const principalPaid = amort.principalPaid;
    const debtService = interestPaid + principalPaid;

    const preTaxCashflow =
      grossIncome - (propertyManagement + maintenance + utilities + fixedCosts + debtService);

    // Depreciation is tied to the original acquisition cost, not indexed.
    const depreciation = depreciationYear1;
    const deductibleCosts =
      interestPaid +
      propertyTaxIBI +
      insurance +
      maintenance +
      propertyManagement +
      depreciation +
      bankAccountFee;
    const taxableIncome = grossIncome - deductibleCosts;
    // Spanish non-resident rental tax (IRNR) is filed and withheld per
    // period; a negative result means no tax is due that year, not a
    // refund, so it is clamped at zero rather than reported as negative.
    const taxDue = Math.max(0, taxableIncome) * taxRate;
    const cashflowAfterTax = preTaxCashflow - taxDue;

    return {
      yearNumber: idx.yearNumber,
      calendarYear: idx.calendarYear,
      extrapolated: idx.extrapolated,
      grossIncome,
      propertyManagement,
      maintenance,
      utilities,
      propertyTaxIBI,
      insurance,
      bankAccountFee,
      fixedCosts,
      noi,
      interestPaid,
      principalPaid,
      debtService,
      mortgageBalance: amort.closingBalance,
      preTaxCashflow,
      depreciation,
      deductibleCosts,
      taxableIncome,
      taxDue,
      cashflowAfterTax,
    };
  });
}
