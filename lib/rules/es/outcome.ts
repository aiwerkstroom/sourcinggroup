/**
 * Assembles the full per-scenario outcome (MODEL_SPEC_FASE1B §7): the
 * datastructure the resultaatpagina and the PDF are built on. This module
 * does no new financial math of its own - it composes the projection
 * (§4), the exit (§5) and the IRR (§6) that the caller already computed,
 * plus two checks that were missing before:
 *
 * - equity fit: does the deal's required equity (AcquisitionCosts.
 *   equityRequired) fit the investor's stated available capital
 *   (PropertyInput.ownMoney)? In the reference case it does not
 *   (€ 197.990 required vs. € 115.000 available) - a gap that a
 *   threshold-only cashflow/DSCR view never surfaces.
 * - return requirement: does the scenario's IRR clear the investor's
 *   hurdle rate (InvestorConstraints.minRoiTarget, falling back to
 *   DEFAULT_MIN_REQUIRED_RETURN)? This is the check MODEL_SPEC.md §10
 *   flagged as "not tested yet" for phase 1.
 *
 * A deal can fail every operating threshold (negative cashflow, DSCR < 1)
 * and still clear its hurdle rate on IRR alone, because the return comes
 * from equity paid down and appreciation realised at sale, not from
 * operating cashflow. This structure reports both views side by side
 * instead of collapsing to a single pass/fail.
 */

import { propertyValueIndex } from "./indexation";
import {
  BANK_FEE,
  BASE_OCCUPANCY_LONG_TERM,
  BASE_OCCUPANCY_SHORT_TERM,
  DEFAULT_BUILDING_SHARE_OF_VALUE,
  DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO,
  DEFAULT_MIN_REQUIRED_RETURN,
  DEFAULT_RENOVATION_IMPROVEMENT_SHARE,
  DEFAULT_USABLE_TO_BUILT_AREA_RATIO,
  DEPRECIATION_SCENARIO_FACTORS,
  MAINTENANCE_RATE,
  RENOVATION_STRATEGIES,
} from "./parameters";
import type {
  EquityFitCheck,
  ExitResult,
  IrrResult,
  Parameter,
  ProjectionYear,
  RentalStrategy,
  RenovationStrategyId,
  ReturnRequirementCheck,
  ScenarioId,
  ScenarioOutcome,
  ScenarioProjectionYear,
} from "./types";

/**
 * The PLACEHOLDER-provenance parameters one scenario outcome's calculation
 * chain actually draws on, given its selections - not every PLACEHOLDER in
 * parameters.ts. Traced against the modules that build a ScenarioOutcome:
 *
 * - MAINTENANCE_RATE (scenarios.ts) and BANK_FEE (operating.ts,
 *   acquisition.ts) apply to every outcome unconditionally.
 * - BASE_OCCUPANCY_LONG_TERM/SHORT_TERM (income.ts) apply only for the
 *   strategy actually selected - both for hybrid, one for longTerm/shortTerm.
 * - The selected renovation strategy's five PLACEHOLDER fields
 *   (RENOVATION_STRATEGIES[id]) - the two strategies NOT selected never
 *   entered this outcome's numbers.
 * - DEPRECIATION_SCENARIO_FACTORS[scenario] (projection.ts) - only this
 *   scenario's own factor.
 * - DEFAULT_BUILDING_SHARE_OF_VALUE (projection.ts) and
 *   DEFAULT_RENOVATION_IMPROVEMENT_SHARE (exit.ts) only when the caller did
 *   not override them with a property-specific figure.
 * - DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO (operating.ts) only when the
 *   caller did not supply PropertyInput.cadastralValue - a real cadastral
 *   value replaces both this IBI-base approximation and, if the caller
 *   wires it through, the DEFAULT_BUILDING_SHARE_OF_VALUE depreciation
 *   fallback above (MODEL_SPEC.md §16).
 * - DEFAULT_USABLE_TO_BUILT_AREA_RATIO (engine.ts) only when the caller
 *   did not supply PropertyInput.usableAreaM2 directly - the rent estimate
 *   this outcome was built from then rests on a derived, not measured,
 *   usable area (MODEL_SPEC.md §17).
 * - DEFAULT_MIN_REQUIRED_RETURN (this module) only when the investor did
 *   not state a minRoiTarget.
 */
function collectPlaceholders(args: {
  scenario: ScenarioId;
  rentalStrategy: RentalStrategy;
  renovationStrategy: RenovationStrategyId;
  buildingShareOfValueProvided: boolean;
  renovationImprovementShareProvided: boolean;
  minRequiredReturnProvided: boolean;
  cadastralValueProvided: boolean;
  usableAreaM2Provided: boolean;
}): Parameter<unknown>[] {
  const placeholders: Parameter<unknown>[] = [MAINTENANCE_RATE, BANK_FEE];

  if (args.rentalStrategy === "longTerm" || args.rentalStrategy === "hybrid") {
    placeholders.push(BASE_OCCUPANCY_LONG_TERM);
  }
  if (args.rentalStrategy === "shortTerm" || args.rentalStrategy === "hybrid") {
    placeholders.push(BASE_OCCUPANCY_SHORT_TERM);
  }

  const renovation = RENOVATION_STRATEGIES[args.renovationStrategy];
  placeholders.push(
    renovation.capex,
    renovation.rentMultiplier,
    renovation.maintenanceFactor,
    renovation.utilitiesEfficiency,
    renovation.timeToRentMonths,
  );

  placeholders.push(DEPRECIATION_SCENARIO_FACTORS[args.scenario]);

  if (!args.buildingShareOfValueProvided) {
    placeholders.push(DEFAULT_BUILDING_SHARE_OF_VALUE);
  }
  if (!args.renovationImprovementShareProvided) {
    placeholders.push(DEFAULT_RENOVATION_IMPROVEMENT_SHARE);
  }
  if (!args.cadastralValueProvided) {
    placeholders.push(DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO);
  }
  if (!args.usableAreaM2Provided) {
    placeholders.push(DEFAULT_USABLE_TO_BUILT_AREA_RATIO);
  }
  if (!args.minRequiredReturnProvided) {
    placeholders.push(DEFAULT_MIN_REQUIRED_RETURN);
  }

  return placeholders;
}

export function buildScenarioOutcome(args: {
  scenario: ScenarioId;
  purchasePrice: number;
  years: ProjectionYear[];
  exit: ExitResult;
  irr: IrrResult;
  equityRequired: number;
  /** PropertyInput.ownMoney - the investor's stated available capital; undefined when not provided. */
  equityAvailable: number | undefined;
  /** InvestorConstraints.minRoiTarget when stated; falls back to DEFAULT_MIN_REQUIRED_RETURN (0) otherwise. */
  minRequiredReturn?: number;
  /** The rental strategy actually used for this outcome's income (income.ts) - determines which occupancy PLACEHOLDER(s) apply. */
  rentalStrategy: RentalStrategy;
  /** The renovation strategy actually used - determines which RENOVATION_STRATEGIES PLACEHOLDER group applies. */
  renovationStrategy: RenovationStrategyId;
  /** True when the caller passed an explicit buildingShareOfValue OR a cadastralValue to buildProjectionYears (projection.ts) instead of relying on DEFAULT_BUILDING_SHARE_OF_VALUE. */
  buildingShareOfValueProvided?: boolean;
  /** True when the caller passed an explicit renovationImprovementShare to computeExit (exit.ts) instead of relying on DEFAULT_RENOVATION_IMPROVEMENT_SHARE. */
  renovationImprovementShareProvided?: boolean;
  /** True when the caller passed PropertyInput.cadastralValue through to fixedOperatingCosts (operating.ts) instead of relying on DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO for the IBI base. */
  cadastralValueProvided?: boolean;
  /** True when the caller passed PropertyInput.usableAreaM2 directly to buildIncomeModel (income.ts, via engine.ts) instead of relying on DEFAULT_USABLE_TO_BUILT_AREA_RATIO to derive it from builtAreaM2. */
  usableAreaM2Provided?: boolean;
}): ScenarioOutcome {
  if (args.years.length === 0) {
    throw new Error("buildScenarioOutcome needs at least one projection year");
  }

  let cumulativeCashflow = 0;
  let paybackYear: number | null = null;
  const years: ScenarioProjectionYear[] = args.years.map((y) => {
    cumulativeCashflow += y.cashflowAfterTax;
    if (paybackYear === null && cumulativeCashflow >= args.equityRequired) {
      paybackYear = y.yearNumber;
    }
    const propertyValue =
      args.purchasePrice * propertyValueIndex(args.scenario, y.yearNumber);
    return {
      yearNumber: y.yearNumber,
      calendarYear: y.calendarYear,
      cashflowAfterTax: y.cashflowAfterTax,
      cumulativeCashflow,
      propertyValue,
      mortgageBalance: y.mortgageBalance,
      equityBuilt: propertyValue - y.mortgageBalance,
    };
  });

  // Total profit over the whole holding period, undiscounted: operating
  // cashflow plus the sale, minus what was put in. Reuses the same
  // per-year totals as the IRR cashflow series rather than a second sum.
  const totalOperatingCashflow = args.years.reduce((sum, y) => sum + y.cashflowAfterTax, 0);
  const totalProfit = totalOperatingCashflow + args.exit.netSaleProceeds - args.equityRequired;
  const totalReturn = totalProfit / args.equityRequired;

  const equityFit: EquityFitCheck = {
    equityRequired: args.equityRequired,
    equityAvailable: args.equityAvailable,
    fitsWithinAvailableEquity:
      args.equityAvailable === undefined ? null : args.equityRequired <= args.equityAvailable,
  };

  const minRequiredReturn = args.minRequiredReturn ?? DEFAULT_MIN_REQUIRED_RETURN.value;
  const returnRequirement: ReturnRequirementCheck = {
    minRequiredReturn,
    meetsMinRequiredReturn: args.irr.defined ? args.irr.irr >= minRequiredReturn : null,
  };

  const placeholdersUsed = collectPlaceholders({
    scenario: args.scenario,
    rentalStrategy: args.rentalStrategy,
    renovationStrategy: args.renovationStrategy,
    buildingShareOfValueProvided: args.buildingShareOfValueProvided ?? false,
    renovationImprovementShareProvided: args.renovationImprovementShareProvided ?? false,
    minRequiredReturnProvided: args.minRequiredReturn !== undefined,
    cadastralValueProvided: args.cadastralValueProvided ?? false,
    usableAreaM2Provided: args.usableAreaM2Provided ?? false,
  });

  return {
    scenario: args.scenario,
    years,
    exit: args.exit,
    irr: args.irr,
    totalReturn,
    paybackYear,
    equityFit,
    returnRequirement,
    placeholdersUsed,
  };
}
