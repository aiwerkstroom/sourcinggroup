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
  TaxResult,
  TaxScenario,
} from "./types";

/** Annual depreciation base: 3% of 80% of the purchase value (Reference Info H58). */
export function depreciationBase(purchasePrice: number): number {
  return purchasePrice * DEPRECIATION_RATE * DEPRECIATION_BUILDING_SHARE;
}

export function taxCalculator(args: {
  purchasePrice: number;
  scenarios: ScenarioResult[];
  fixedCosts: Pick<FixedOperatingCosts, "propertyTaxIBI" | "insurance" | "bankAccountFee">;
  euResident: boolean;
}): TaxResult {
  const base = depreciationBase(args.purchasePrice);
  const taxScenarios: TaxScenario[] = args.scenarios.map((sc) => {
    const depreciation = base * DEPRECIATION_SCENARIO_FACTORS[sc.id];
    // Reference Info M63/N63/O63
    const deductibleCosts =
      sc.annualInterestOnly +
      args.fixedCosts.propertyTaxIBI +
      args.fixedCosts.insurance +
      sc.maintenance +
      sc.propertyManagement +
      depreciation +
      args.fixedCosts.bankAccountFee;
    return { id: sc.id, depreciation, deductibleCosts };
  });

  const baseScenario = args.scenarios.find((s) => s.id === "base");
  const baseTax = taxScenarios.find((s) => s.id === "base");
  if (!baseScenario || !baseTax) throw new Error("Base scenario missing");

  const taxableIncomeBase = baseScenario.grossIncome - baseTax.deductibleCosts;
  const taxRate = args.euResident
    ? RENTAL_INCOME_TAX_RATE_EU
    : RENTAL_INCOME_TAX_RATE_NON_EU;
  return {
    scenarios: taxScenarios,
    grossRentalIncomeBase: baseScenario.grossIncome,
    deductibleCostsBase: baseTax.deductibleCosts,
    taxableIncomeBase,
    taxRate,
    taxDueBase: taxableIncomeBase * taxRate,
  };
}
