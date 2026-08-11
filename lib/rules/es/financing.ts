/**
 * Financing: strategy table, LTV clamp, rate/term selection and debt service.
 * Replicates Costs & Income!B99:H112 and D115:D124.
 */

import {
  FINANCING_STRATEGIES,
  NON_RESIDENT_INTEREST_SPREAD,
} from "./parameters";
import type {
  AmortizationYear,
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
    if (preferredLtv <= FINANCING_STRATEGIES.low.ltv.value) return FINANCING_STRATEGIES.low.interestRate.value;
    if (preferredLtv <= FINANCING_STRATEGIES.medium.ltv.value) return FINANCING_STRATEGIES.medium.interestRate.value;
    return FINANCING_STRATEGIES.high.interestRate.value;
  }
  return FINANCING_STRATEGIES[strategy].interestRate.value;
}

/** Per-strategy compliance table (B101:H112). */
export function financingStrategyTable(
  purchasePrice: number,
  constraints: InvestorConstraints,
): FinancingStrategyResult[] {
  return (Object.keys(FINANCING_STRATEGIES) as FinancingStrategyId[]).map((id) => {
    const s = FINANCING_STRATEGIES[id];
    const ltv = s.ltv.value;
    const loanTermYears = s.loanTermYears.value;
    const interestRate = s.interestRate.value;
    const monthly =
      annualAnnuityDebtService(interestRate, loanTermYears, purchasePrice * ltv) /
      MONTHS_PER_YEAR;
    return {
      id,
      label: s.label,
      ltv,
      loanTermYears,
      interestRate,
      loanType: s.loanType,
      withinAllowedLtv: ltv >= constraints.minLtv && ltv <= constraints.maxLtv,
      monthlyDebtService: monthly,
      monthlyDebtWithinLimit: monthly <= constraints.maxMonthlyDebt,
    };
  });
}

/**
 * Yearly interest/principal split of a fixed-rate annuity, computed from
 * the underlying monthly schedule and aggregated to calendar years
 * (MODEL_SPEC_FASE1B §4: "rente en aflossing moeten per jaar gesplitst
 * worden, niet als één annuïteitsbedrag behandeld" - because only the
 * interest portion is deductible and it declines every year).
 *
 * The monthly payment is constant for the loan's life; once `yearsToProject`
 * exceeds the loan term the balance is 0 and later years carry no interest
 * or principal (the loan is paid off, not extended).
 */
export function amortizationSchedule(args: {
  annualRate: number;
  termYears: number;
  principal: number;
  yearsToProject: number;
}): AmortizationYear[] {
  const r = args.annualRate / MONTHS_PER_YEAR;
  const totalMonths = args.termYears * MONTHS_PER_YEAR;
  const monthlyPayment =
    r === 0
      ? args.principal / totalMonths
      : (args.principal * r) / (1 - (1 + r) ** -totalMonths);

  const years: AmortizationYear[] = [];
  let balance = args.principal;
  for (let yearNumber = 1; yearNumber <= args.yearsToProject; yearNumber++) {
    const openingBalance = balance;
    let interestPaid = 0;
    let principalPaid = 0;
    for (let m = 0; m < MONTHS_PER_YEAR; m++) {
      const monthIndex = (yearNumber - 1) * MONTHS_PER_YEAR + m;
      if (monthIndex >= totalMonths || balance <= 0) break;
      const interest = balance * r;
      const principal = monthlyPayment - interest;
      balance = Math.max(0, balance - principal);
      // The PMT-derived payment zeroes the balance exactly in theory; clear
      // sub-cent floating point residue so a paid-off loan reads as 0, not
      // as a lingering fraction of a euro-cent.
      if (balance < 1e-6) balance = 0;
      interestPaid += interest;
      principalPaid += principal;
    }
    years.push({
      yearNumber,
      openingBalance,
      interestPaid,
      principalPaid,
      closingBalance: balance,
    });
  }
  return years;
}

export function selectFinancing(args: {
  purchasePrice: number;
  constraints: InvestorConstraints;
  strategy: FinancingStrategyId;
  residency: Residency;
}): SelectedFinancing {
  const strategyDef = FINANCING_STRATEGIES[args.strategy];
  const ltv = clampLtv(args.constraints, strategyDef.ltv.value);
  const interestRate = selectInterestRate(args.constraints.preferredLtv, args.strategy);
  const nonResidentSpread =
    args.residency === "nonResident" ? NON_RESIDENT_INTEREST_SPREAD.value : 0;
  return {
    strategy: args.strategy,
    ltv,
    loanTermYears: strategyDef.loanTermYears.value,
    interestRate,
    nonResidentSpread,
    mortgageAmount: args.purchasePrice * ltv,
  };
}
