/**
 * TSG Yield Engine - orchestration.
 * Runs the full model for one property, replicating the corrected
 * TSG_Model_v3.xlsx end to end.
 *
 * With EngineInput.exitPlanning supplied, this also assembles a complete
 * per-scenario ScenarioOutcome for each of conservative/base/optimistic
 * (EngineResult.scenarioOutcomes) - the same buildProjectionYears ->
 * computeExit -> computeScenarioIrr -> buildScenarioOutcome chain a caller
 * would otherwise have to wire up by hand, TSG score and percentile
 * included. No new logic: every step here is an existing function from
 * projection.ts/exit.ts/irr.ts/outcome.ts, called with the same arguments
 * a manual caller already passes them.
 *
 * Unconditionally, this also reports EngineResult.rentInputProvenance
 * (rent-provenance.ts): whether the rate(s) the selected rentalStrategy
 * used came from the neighbourhood reference table or were supplied by
 * the customer, and by how much - needed for every call, not only when
 * exitPlanning is given, since it depends on nothing but
 * property.neighborhood and the selected rates.
 *
 * EngineResult.listingFieldProvenance is the same kind of unconditional
 * passthrough, but with no comparison happening here at all: whoever
 * calls this (buildEngineInput()) has already done that work, so this
 * function's only job is to default to EMPTY_LISTING_FIELD_PROVENANCE
 * when the caller did not supply one - no new calculation logic, same as
 * PropertyInput.propertyType.
 */

import { acquisitionCosts } from "./acquisition";
import { computeExit } from "./exit";
import { financingStrategyTable, selectFinancing } from "./financing";
import { computeScenarioIrr } from "./irr";
import { buildIncomeModel } from "./income";
import { rentalStrategyAvailability } from "./licensing";
import { buildScenarioOutcome } from "./outcome";
import { fixedOperatingCosts, utilitiesBaseAnnual } from "./operating";
import { DEFAULT_USABLE_TO_BUILT_AREA_RATIO, PROJECTION_YEARS, SCENARIO_ORDER } from "./parameters";
import { buildProjectionYears } from "./projection";
import { renovationStrategyTable, selectRenovation } from "./renovation";
import { computeRentInputProvenance } from "./rent-provenance";
import { runScenarios } from "./scenarios";
import { taxCalculator } from "./tax";
import { assertValidEngineInput } from "./validation";
import { EMPTY_LISTING_FIELD_PROVENANCE } from "./types";
import type { EngineInput, EngineResult, ScenarioOutcome } from "./types";

export function runEngine(input: EngineInput): EngineResult {
  assertValidEngineInput(input);
  const { property, constraints, selections } = input;

  // MODEL_SPEC.md §17: rent uses usable floor area; when it isn't known
  // directly, derive it from the built area via the PLACEHOLDER ratio.
  const usableAreaM2 =
    property.usableAreaM2 ?? property.builtAreaM2 * DEFAULT_USABLE_TO_BUILT_AREA_RATIO.value;

  const rentalStrategies = rentalStrategyAvailability(property.hasTouristRentalLicense);

  const renovationStrategies = renovationStrategyTable(constraints);
  const selectedRenovation = selectRenovation(selections.renovationStrategy, constraints);

  const income = buildIncomeModel({
    rentPerM2LongTerm: selections.rentPerM2LongTerm,
    rentPerM2ShortTerm: selections.rentPerM2ShortTerm,
    usableAreaM2,
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
    cadastralValue: property.cadastralValue,
  });

  const utilitiesBase = utilitiesBaseAnnual(property.builtAreaM2);

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

  // MODEL_SPEC_FASE1B §7 / SCORE_SPEC.md §1-§6: a full per-scenario outcome
  // (projection years, exit, IRR, TSG score, percentile), the same
  // buildProjectionYears -> computeExit -> computeScenarioIrr ->
  // buildScenarioOutcome chain a caller would otherwise have to assemble
  // by hand. Only possible when exit assumptions were supplied - they have
  // no default (MODEL_SPEC_FASE1B §5) - so this stays null otherwise
  // rather than guessing a selling commission or a plusvalía.
  const scenarioOutcomes: ScenarioOutcome[] | null = input.exitPlanning
    ? SCENARIO_ORDER.map((scenarioId) => {
        const scenarioResult = scenarios.find((s) => s.id === scenarioId)!;
        const years = buildProjectionYears({
          years: input.exitPlanning!.holdingYears ?? PROJECTION_YEARS.value,
          scenario: scenarioId,
          scenarioResult,
          purchasePrice: property.purchasePrice,
          financing: selectedFinancing,
          fixedCosts,
          euResident: selections.euResident ?? true,
          renovation: selectedRenovation,
          cadastralValue: property.cadastralValue,
        });
        const exit = computeExit({
          scenario: scenarioId,
          years,
          purchasePrice: property.purchasePrice,
          acquisition,
          renovation: selectedRenovation,
          assumptions: input.exitPlanning!.assumptions,
        });
        const irr = computeScenarioIrr({
          equityInvested: acquisition.equityRequired,
          years,
          exit,
        });
        return buildScenarioOutcome({
          scenario: scenarioId,
          purchasePrice: property.purchasePrice,
          years,
          exit,
          irr,
          equityRequired: acquisition.equityRequired,
          equityAvailable: property.ownMoney,
          minRequiredReturn: constraints.minRoiTarget,
          rentalStrategy: selections.rentalStrategy,
          renovationStrategy: selections.renovationStrategy,
          financingStrategy: selections.financingStrategy,
          residency: selections.residency,
          euResident: selections.euResident ?? true,
          usableAreaM2Provided: property.usableAreaM2 !== undefined,
          cadastralValueProvided: property.cadastralValue !== undefined,
          // cadastralValue, when given, also replaces the building-share
          // default (projection.ts: "takes priority over
          // buildingShareOfValue") - the same override, so the same flag.
          buildingShareOfValueProvided: property.cadastralValue !== undefined,
          scenarioCashflow: {
            monthlyCashflow: scenarioResult.monthlyCashflow,
            dscr: scenarioResult.dscr,
          },
          maxRenovationBudget: constraints.maxRenovationBudget,
          renovationCost: selectedRenovation.capex,
        });
      })
    : null;

  const rentInputProvenance = computeRentInputProvenance({
    neighborhood: property.neighborhood,
    rentPerM2LongTerm: selections.rentPerM2LongTerm,
    rentPerM2ShortTerm: selections.rentPerM2ShortTerm,
    rentalStrategy: selections.rentalStrategy,
    fromActualCurrentRent: selections.rentPerM2FromActualCurrentRent,
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
    rentalStrategies,
    scenarioOutcomes,
    rentInputProvenance,
    listingFieldProvenance: input.listingFieldProvenance ?? EMPTY_LISTING_FIELD_PROVENANCE,
  };
}
