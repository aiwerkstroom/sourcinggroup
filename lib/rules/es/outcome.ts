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
import { DEFAULT_MIN_REQUIRED_RETURN } from "./parameters";
import type {
  EquityFitCheck,
  ExitResult,
  IrrResult,
  ProjectionYear,
  ReturnRequirementCheck,
  ScenarioId,
  ScenarioOutcome,
  ScenarioProjectionYear,
} from "./types";

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

  return {
    scenario: args.scenario,
    years,
    exit: args.exit,
    irr: args.irr,
    totalReturn,
    paybackYear,
    equityFit,
    returnRequirement,
  };
}
