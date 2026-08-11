/**
 * Scenario layer: conservative / base / optimistic.
 * Replicates Costs & Income!J60:P110 (corrected formulas, see Changelog):
 * - maintenance uses the maintenance-inflation multiplier (P80 fix)
 * - total opex uses the amortising debt service (L98/N98/P98 fix)
 * - DSCR divides NOI by the amortising debt service only (L108 fix)
 * - fixed costs (IBI + insurance + bank fee) are part of NOI and total
 *   opex (v3 fix)
 */

import {
  MAINTENANCE_RATE,
  PROPERTY_MANAGEMENT_FEE,
  SCENARIOS,
  SCENARIO_ORDER,
} from "./parameters";
import { annualAnnuityDebtService, annualInterestOnly } from "./financing";
import type {
  InvestorConstraints,
  RenovationStrategyResult,
  ScenarioResult,
  SelectedFinancing,
} from "./types";

const MONTHS_PER_YEAR = 12;

export function dscrVerdict(dscr: number): "yes" | "breakEven" | "no" {
  if (dscr < 1) return "no";
  if (dscr === 1) return "breakEven";
  return "yes";
}

export function runScenarios(args: {
  /** Gross annual income for the selected rental strategy (L38). */
  grossAnnualIncome: number;
  utilitiesBaseAnnual: number;
  /** Fixed annual costs excl. debt: IBI + insurance + bank account fee. */
  fixedAnnualCosts: number;
  renovation: Pick<
    RenovationStrategyResult,
    "maintenanceFactor" | "utilitiesEfficiency"
  >;
  financing: SelectedFinancing;
  constraints: Pick<InvestorConstraints, "minMonthlyCashflow">;
}): ScenarioResult[] {
  return SCENARIO_ORDER.map((id) => {
    const s = SCENARIOS[id];
    const rentLevelMultiplier = s.rentLevelMultiplier.value;
    const occupancyMultiplier = s.occupancyMultiplier.value;
    const interestRateDelta = s.interestRateDelta.value;
    const utilitiesMultiplier = s.utilitiesMultiplier.value;
    const maintenanceInflationMultiplier = s.maintenanceInflationMultiplier.value;
    // L74: hybrid gross x rent level x occupancy multiplier
    const grossIncome = args.grossAnnualIncome * rentLevelMultiplier * occupancyMultiplier;
    // L78: gross x property management fee
    const propertyManagement = grossIncome * PROPERTY_MANAGEMENT_FEE.value;
    // L80: gross x maintenance rate x renovation maintenance factor x inflation multiplier
    const maintenance =
      grossIncome *
      MAINTENANCE_RATE.value *
      args.renovation.maintenanceFactor *
      maintenanceInflationMultiplier;
    // L84: utilities base x renovation efficiency x scenario multiplier
    const utilities =
      args.utilitiesBaseAnnual * args.renovation.utilitiesEfficiency * utilitiesMultiplier;
    // L86: NOI, incl. fixed costs since v3
    const fixedCosts = args.fixedAnnualCosts;
    const noi =
      grossIncome - (propertyManagement + maintenance + utilities + fixedCosts);
    // L90: selected rate + scenario delta + non-resident spread
    const interestRate =
      args.financing.interestRate + interestRateDelta + args.financing.nonResidentSpread;
    // L94 / L96
    const interestOnly = annualInterestOnly(interestRate, args.financing.mortgageAmount);
    const debtService = annualAnnuityDebtService(
      interestRate,
      args.financing.loanTermYears,
      args.financing.mortgageAmount,
    );
    // L98: income-linked opex + fixed costs + amortising debt service
    const totalOpex =
      propertyManagement + maintenance + utilities + fixedCosts + debtService;
    // L102 / L104
    const annualCashflow = grossIncome - totalOpex;
    const monthlyCashflow = annualCashflow / MONTHS_PER_YEAR;
    // L108
    const dscr = noi / debtService;
    return {
      id,
      rentLevelMultiplier,
      occupancyMultiplier,
      interestRateDelta,
      utilitiesMultiplier,
      maintenanceInflationMultiplier,
      grossIncome,
      propertyManagement,
      maintenance,
      utilities,
      fixedCosts,
      noi,
      interestRate,
      annualInterestOnly: interestOnly,
      annualDebtService: debtService,
      totalOpexInclDebtService: totalOpex,
      annualCashflow,
      monthlyCashflow,
      meetsMinMonthlyCashflow: monthlyCashflow >= args.constraints.minMonthlyCashflow,
      dscr,
      dscrVerdict: dscrVerdict(dscr),
    };
  });
}
