/**
 * Non-resident rental income tax calculator.
 * Replicates Reference Info H45:O63 (corrected, see Changelog):
 * deductible costs per scenario = interest-only mortgage interest + IBI +
 * insurance + maintenance + property management + depreciation + bank fees;
 * taxable income and tax due are computed on the base scenario.
 */

import {
  DEPRECIATION_BUILDING_SHARE,
  DEPRECIATION_RATE,
  DEPRECIATION_SCENARIO_FACTORS,
  RENTAL_INCOME_TAX_RATE_EU,
  RENTAL_INCOME_TAX_RATE_NON_EU,
} from "./parameters";
import type {
  FixedOperatingCosts,
  ScenarioResult,
  TaxResidency,
  TaxResult,
  TaxScenario,
} from "./types";

/**
 * How Spain taxes this investor's rental income: the rate, and whether
 * costs may be deducted at all.
 *
 * The single place that answer is derived, so tax.ts and projection.ts
 * cannot drift apart on it. Before this existed they shared the rate
 * lookup but each computed the base independently - and both computed it
 * as net regardless of residency, which is exactly the bug this fixes.
 *
 * taxResidency wins when given; euResident is the legacy fallback, and
 * EU treatment is the default when neither is supplied. That order is
 * what keeps every pre-existing caller (and the reference case's anchor)
 * on the behaviour it had.
 */
export function rentalIncomeTaxTreatment(args: {
  taxResidency?: TaxResidency;
  euResident?: boolean;
}): { rate: number; deductionsAllowed: boolean } {
  const isEu =
    args.taxResidency !== undefined ? args.taxResidency !== "nonEu" : (args.euResident ?? true);

  return isEu
    ? { rate: RENTAL_INCOME_TAX_RATE_EU.value, deductionsAllowed: true }
    : { rate: RENTAL_INCOME_TAX_RATE_NON_EU.value, deductionsAllowed: false };
}

/** Annual depreciation base: 3% of 80% of the purchase value (Reference Info H58). */
export function depreciationBase(purchasePrice: number): number {
  return purchasePrice * DEPRECIATION_RATE.value * DEPRECIATION_BUILDING_SHARE.value;
}

export function taxCalculator(args: {
  purchasePrice: number;
  scenarios: ScenarioResult[];
  fixedCosts: Pick<
    FixedOperatingCosts,
    "propertyTaxIBI" | "insurance" | "bankAccountFee" | "communityFees"
  >;
  /** Legacy; taxResidency takes precedence when both are given. */
  euResident?: boolean;
  taxResidency?: TaxResidency;
}): TaxResult {
  const base = depreciationBase(args.purchasePrice);
  const taxScenarios: TaxScenario[] = args.scenarios.map((sc) => {
    const depreciation = base * DEPRECIATION_SCENARIO_FACTORS[sc.id].value;
    // Reference Info M63/N63/O63, plus gastos de comunidad (not in the
    // Excel; a deductible cost of obtaining the rental income, the same
    // category as IBI/insurance/maintenance under IRNR rules).
    const deductibleCosts =
      sc.annualInterestOnly +
      args.fixedCosts.propertyTaxIBI +
      args.fixedCosts.insurance +
      sc.maintenance +
      sc.propertyManagement +
      depreciation +
      args.fixedCosts.bankAccountFee +
      args.fixedCosts.communityFees;
    return { id: sc.id, depreciation, deductibleCosts };
  });

  const baseScenario = args.scenarios.find((s) => s.id === "base");
  const baseTax = taxScenarios.find((s) => s.id === "base");
  if (!baseScenario || !baseTax) throw new Error("Base scenario missing");

  const { rate: taxRate, deductionsAllowed } = rentalIncomeTaxTreatment(args);

  // The base, not just the rate. A non-EU investor is taxed on gross
  // rent: the costs above are still real and still reported, they simply
  // do not reduce what Spain taxes.
  const taxableIncomeBase = deductionsAllowed
    ? baseScenario.grossIncome - baseTax.deductibleCosts
    : baseScenario.grossIncome;

  return {
    scenarios: taxScenarios,
    grossRentalIncomeBase: baseScenario.grossIncome,
    deductibleCostsBase: baseTax.deductibleCosts,
    taxableIncomeBase,
    taxRate,
    taxDueBase: taxableIncomeBase * taxRate,
    deductionsAllowed,
  };
}
