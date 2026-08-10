/**
 * Financing: strategy table, LTV clamp, rate/term selection and debt service.
 * Replicates Costs & Income!B99:H112 and D115:D124.
 */

import {
  FINANCING_STRATEGIES,
  NON_RESIDENT_INTEREST_SPREAD,
} from "./parameters";
import type {
  FinancingStrategyId,
  FinancingStrategyResult,
  InvestorConstraints,
  Residency,
  SelectedFinancing,
} from "./types";

const MONTHS_PER_YEAR = 12;

/**
 * Annual annuity debt service, replicating Excel
 * PMT(rate/12, years*12, -principal) * 12 (L96).
 */
export function annualAnnuityDebtService(
  annualRate: number,
  termYears: number,
  principal: number,
): number {
  const r = annualRate / MONTHS_PER_YEAR;
  const n = termYears * MONTHS_PER_YEAR;
  if (r === 0) return (principal / n) * MONTHS_PER_YEAR;
  return ((principal * r) / (1 - (1 + r) ** -n)) * MONTHS_PER_YEAR;
}

/** Annual interest-only debt service (L94). */
export function annualInterestOnly(annualRate: number, principal: number): number {
  return principal * annualRate;
}

/** Selected LTV: MAX(minLtv, MIN(maxLtv, preferredLtv ?? strategy LTV)) - Excel D119. */
export function clampLtv(
  constraints: Pick<InvestorConstraints, "minLtv" | "maxLtv" | "preferredLtv">,
  strategyLtv: number,
): number {
  const wanted = constraints.preferredLtv ?? strategyLtv;
  return Math.max(constraints.minLtv, Math.min(constraints.maxLtv, wanted));
}

/**
 * Selected interest rate - Excel D123: with a preferred LTV, take the rate
 * of the first strategy whose LTV covers it; otherwise the rate of the
 * selected strategy.
 */
export function selectInterestRate(
  preferredLtv: number | undefined,
  strategy: FinancingStrategyId,
): number {
  if (preferredLtv !== undefined) {
    if (preferredLtv <= FINANCING_STRATEGIES.low.ltv) return FINANCING_STRATEGIES.low.interestRate;
    if (preferredLtv <= FINANCING_STRATEGIES.medium.ltv) return FINANCING_STRATEGIES.medium.interestRate;
    return FINANCING_STRATEGIES.high.interestRate;
  }
  return FINANCING_STRATEGIES[strategy].interestRate;
}

/** Per-strategy compliance table (B101:H112). */
export function financingStrategyTable(
  purchasePrice: number,
  constraints: InvestorConstraints,
): FinancingStrategyResult[] {
  return (Object.keys(FINANCING_STRATEGIES) as FinancingStrategyId[]).map((id) => {
    const s = FINANCING_STRATEGIES[id];
    const monthly =
      annualAnnuityDebtService(s.interestRate, s.loanTermYears, purchasePrice * s.ltv) /
      MONTHS_PER_YEAR;
    return {
      id,
      label: s.label,
      ltv: s.ltv,
      loanTermYears: s.loanTermYears,
      interestRate: s.interestRate,
      loanType: s.loanType,
      withinAllowedLtv: s.ltv >= constraints.minLtv && s.ltv <= constraints.maxLtv,
      monthlyDebtService: monthly,
      monthlyDebtWithinLimit: monthly <= constraints.maxMonthlyDebt,
    };
  });
}

export function selectFinancing(args: {
  purchasePrice: number;
  constraints: InvestorConstraints;
  strategy: FinancingStrategyId;
  residency: Residency;
}): SelectedFinancing {
  const strategyDef = FINANCING_STRATEGIES[args.strategy];
  const ltv = clampLtv(args.constraints, strategyDef.ltv);
  const interestRate = selectInterestRate(args.constraints.preferredLtv, args.strategy);
  const nonResidentSpread =
    args.residency === "nonResident" ? NON_RESIDENT_INTEREST_SPREAD : 0;
  return {
    strategy: args.strategy,
    ltv,
    loanTermYears: strategyDef.loanTermYears,
    interestRate,
    nonResidentSpread,
    mortgageAmount: args.purchasePrice * ltv,
  };
}
