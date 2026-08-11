/**
 * TSG Yield Engine - orchestration.
 * Runs the full model for one property, replicating the corrected
 * TSG_Model_v3.xlsx end to end.
 */

import { acquisitionCosts } from "./acquisition";
import { financingStrategyTable, selectFinancing } from "./financing";
import { buildIncomeModel } from "./income";
import { fixedOperatingCosts, utilitiesBaseAnnual } from "./operating";
import { renovationStrategyTable, selectRenovation } from "./renovation";
import { runScenarios } from "./scenarios";
import { taxCalculator } from "./tax";
import { assertValidEngineInput } from "./validation";
import type { EngineInput, EngineResult } from "./types";

export function runEngine(input: EngineInput): EngineResult {
  assertValidEngineInput(input);
  const { property, constraints, selections } = input;

  const renovationStrategies = renovationStrategyTable(constraints);
  const selectedRenovation = selectRenovation(selections.renovationStrategy, constraints);

  const income = buildIncomeModel({
    rentPerM2LongTerm: selections.rentPerM2LongTerm,
    rentPerM2ShortTerm: selections.rentPerM2ShortTerm,
    livingAreaM2: property.livingAreaM2,
    rentMultiplier: selectedRenovation.rentMultiplier,
    rentalStrategy: selections.rentalStrategy,
  });

  const financingStrategies = financingStrategyTable(property.purchasePrice, constraints);
  const selectedFinancing = selectFinancing({
    purchasePrice: property.purchasePrice,
    constraints,
    strategy: selections.financingStrategy,
    residency: selections.residency,
  });

  const acquisition = acquisitionCosts({
    purchasePrice: property.purchasePrice,
    renovationCosts: selectedRenovation.capex,
    mortgageAmount: selectedFinancing.mortgageAmount,
    constraints,
  });

  const fixedCosts = fixedOperatingCosts({
    purchasePrice: property.purchasePrice,
    mortgageAmount: selectedFinancing.mortgageAmount,
    effectiveInterestRate:
      selectedFinancing.interestRate + selectedFinancing.nonResidentSpread,
    communityFeesAnnual: property.communityFeesAnnual,
  });

  const utilitiesBase = utilitiesBaseAnnual(property.livingAreaM2);

  const scenarios = runScenarios({
    grossAnnualIncome: income.selectedGrossAnnualIncome,
    utilitiesBaseAnnual: utilitiesBase,
    fixedAnnualCosts:
      fixedCosts.propertyTaxIBI +
      fixedCosts.insurance +
      fixedCosts.bankAccountFee +
      fixedCosts.communityFees,
    renovation: selectedRenovation,
    financing: selectedFinancing,
    constraints,
  });

  const tax = taxCalculator({
    purchasePrice: property.purchasePrice,
    scenarios,
    fixedCosts,
    euResident: selections.euResident ?? true,
  });

  return {
    income,
    renovationStrategies,
    selectedRenovation,
    financingStrategies,
    selectedFinancing,
    acquisition,
    fixedOperatingCosts: fixedCosts,
    utilitiesBaseAnnual: utilitiesBase,
    scenarios,
    tax,
  };
}
