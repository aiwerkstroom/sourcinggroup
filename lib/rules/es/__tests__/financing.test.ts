import { describe, expect, it } from "vitest";
import {
  amortizationSchedule,
  annualAnnuityDebtService,
  annualInterestOnly,
  clampLtv,
  derivedAllInInterestRate,
  financingStrategyTable,
  selectFinancing,
  selectInterestRate,
} from "../financing";
import { FINANCING_STRATEGIES, NON_RESIDENT_INTEREST_SPREAD } from "../parameters";
import { referenceCase } from "./referencecase";

// Golden values: corrected TSG_Model_v3.xlsx.
describe("annuity debt service (Excel PMT parity)", () => {
  it("replicates PMT for the three scenario rates (L96/N96/P96)", () => {
    expect(annualAnnuityDebtService(0.047, 15, 247500)).toBeCloseTo(23025.0534114773, 8);
    expect(annualAnnuityDebtService(0.042, 15, 247500)).toBeCloseTo(22267.5851768972, 8);
    expect(annualAnnuityDebtService(0.0395, 15, 247500)).toBeCloseTo(21894.3888519706, 8);
  });

  it("handles a zero interest rate as linear repayment", () => {
    expect(annualAnnuityDebtService(0, 15, 180000)).toBeCloseTo(12000, 9);
  });

  it("computes interest-only debt service (L94/N94/P94)", () => {
    expect(annualInterestOnly(0.047, 247500)).toBeCloseTo(11632.5, 9);
    expect(annualInterestOnly(0.042, 247500)).toBeCloseTo(10395, 9);
    expect(annualInterestOnly(0.0395, 247500)).toBeCloseTo(9776.25, 9);
  });
});

// Golden values: independent recomputation of the monthly amortization
// schedule (MODEL_SPEC_FASE1B §4/§8 - no Excel counterpart for phase 1b).
describe("amortization schedule (interest/principal split per year)", () => {
  it("splits year 1/2/10 for the base scenario (4.2%, 15y, 247500)", () => {
    const years = amortizationSchedule({
      annualRate: 0.042,
      termYears: 15,
      principal: 247500,
      yearsToProject: 10,
    });
    expect(years).toHaveLength(10);
    expect(years[0]!.openingBalance).toBe(247500);
    expect(years[0]!.interestPaid).toBeCloseTo(10163.765235, 5);
    expect(years[0]!.principalPaid).toBeCloseTo(12103.819942, 5);
    expect(years[0]!.closingBalance).toBeCloseTo(235396.180058, 4);
    expect(years[1]!.interestPaid).toBeCloseTo(9645.503785, 5);
    expect(years[1]!.principalPaid).toBeCloseTo(12622.081392, 5);
    expect(years[9]!.interestPaid).toBeCloseTo(4615.372495, 5);
    expect(years[9]!.principalPaid).toBeCloseTo(17652.212682, 5);
    expect(years[9]!.closingBalance).toBeCloseTo(100266.961333, 4);
  });

  it("declines every year: interest down, principal up (annuity is flat)", () => {
    const years = amortizationSchedule({
      annualRate: 0.042,
      termYears: 15,
      principal: 247500,
      yearsToProject: 10,
    });
    for (let i = 1; i < years.length; i++) {
      expect(years[i]!.interestPaid).toBeLessThan(years[i - 1]!.interestPaid);
      expect(years[i]!.principalPaid).toBeGreaterThan(years[i - 1]!.principalPaid);
      expect(years[i]!.openingBalance).toBeCloseTo(years[i - 1]!.closingBalance, 6);
    }
  });

  it("pays the loan off at the end of the term and carries zero after that", () => {
    const years = amortizationSchedule({
      annualRate: 0.042,
      termYears: 15,
      principal: 247500,
      yearsToProject: 16,
    });
    expect(years[14]!.closingBalance).toBeCloseTo(0, 6);
    expect(years[15]!.interestPaid).toBe(0);
    expect(years[15]!.principalPaid).toBe(0);
    expect(years[15]!.closingBalance).toBe(0);
  });

  it("sums interest+principal back to the annuity payment while the loan is active", () => {
    const years = amortizationSchedule({
      annualRate: 0.042,
      termYears: 15,
      principal: 247500,
      yearsToProject: 5,
    });
    const annuity = annualAnnuityDebtService(0.042, 15, 247500);
    for (const y of years) {
      expect(y.interestPaid + y.principalPaid).toBeCloseTo(annuity, 6);
    }
  });
});

describe("LTV selection (Excel D119)", () => {
  const bounds = { minLtv: 0.6, maxLtv: 0.75 };
  it("uses the strategy LTV when no preference is given", () => {
    expect(clampLtv(bounds, 0.75)).toBe(0.75);
  });
  it("clamps a preferred LTV above the max", () => {
    expect(clampLtv({ ...bounds, preferredLtv: 0.8 }, 0.75)).toBe(0.75);
  });
  it("clamps a preferred LTV below the min", () => {
    expect(clampLtv({ ...bounds, preferredLtv: 0.5 }, 0.75)).toBe(0.6);
  });
  it("keeps a preferred LTV inside the bounds", () => {
    expect(clampLtv({ ...bounds, preferredLtv: 0.65 }, 0.75)).toBe(0.65);
  });
});

describe("interest rate selection (Excel D123)", () => {
  it("uses the selected strategy rate without a preferred LTV", () => {
    expect(selectInterestRate(undefined, "high")).toBe(0.032);
    expect(selectInterestRate(undefined, "low")).toBe(0.025);
  });
  it("maps a preferred LTV to the first strategy that covers it", () => {
    expect(selectInterestRate(0.6, "high")).toBe(0.025);
    expect(selectInterestRate(0.65, "high")).toBe(0.0285);
    expect(selectInterestRate(0.75, "low")).toBe(0.032);
  });
});

describe("financing strategy table (Excel B101:H112)", () => {
  const table = financingStrategyTable(330000, referenceCase.constraints);
  it("checks monthly debt against the limit: Yes / No / No (D112/F112/H112)", () => {
    expect(table.map((s) => s.monthlyDebtWithinLimit)).toEqual([true, false, false]);
  });
  it("computes monthly debt service per strategy", () => {
    const monthly = table.map((s) => s.monthlyDebtService);
    expect(monthly[0]).toBeCloseTo(888.26, 2);
    expect(monthly[1]).toBeCloseTo(1263.84, 2);
    expect(monthly[2]).toBeCloseTo(1733.1, 2);
  });
  it("marks all strategy LTVs as within the allowed range (B108)", () => {
    expect(table.every((s) => s.withinAllowedLtv)).toBe(true);
  });
});

describe("selected financing (reference case)", () => {
  const sel = selectFinancing({
    purchasePrice: 330000,
    constraints: referenceCase.constraints,
    strategy: "high",
    residency: "nonResident",
  });
  it("selects LTV 0.75, 15 years, 3.2% + 1% spread", () => {
    expect(sel.ltv).toBe(0.75);
    expect(sel.loanTermYears).toBe(15);
    expect(sel.interestRate).toBe(0.032);
    expect(sel.nonResidentSpread).toBe(0.01);
  });
  it("computes the mortgage amount 247500 (D149)", () => {
    expect(sel.mortgageAmount).toBe(247500);
  });
  it("drops the spread for residents", () => {
    const resident = selectFinancing({
      purchasePrice: 330000,
      constraints: referenceCase.constraints,
      strategy: "high",
      residency: "resident",
    });
    expect(resident.nonResidentSpread).toBe(0);
  });
});

/**
 * Fase C stap 3: the customer's own bank offer. The rate half carries the
 * one detail that is easy to get wrong and expensive if you do - a quoted
 * rate is all-in, so the non-resident spread must not be added on top of
 * it.
 */
describe("selectFinancing - the customer's own rate and term (fase C stap 3)", () => {
  const base = {
    purchasePrice: 330_000,
    constraints: {
      totalBudget: 450_000,
      maxRenovationBudget: 60_000,
      minLtv: 0.6,
      maxLtv: 0.75,
      riskTolerance: "medium" as const,
      minRoiTarget: 0.04,
      minMonthlyCashflow: 500,
      maxMonthlyDebt: 1_000,
    },
    strategy: "high" as const,
    residency: "nonResident" as const,
  };

  it("uses the tier's own rate and term when nothing is supplied", () => {
    const f = selectFinancing(base);
    expect(f.interestRate).toBe(FINANCING_STRATEGIES.high.interestRate.value);
    expect(f.loanTermYears).toBe(FINANCING_STRATEGIES.high.loanTermYears.value);
    expect(f.nonResidentSpread).toBe(NON_RESIDENT_INTEREST_SPREAD.value);
  });

  it("treats a supplied rate as all-in: the non-resident spread is not added on top", () => {
    // The double-count this guards: a bank quoting a non-resident has
    // already priced the surcharge in, so adding it again would turn a
    // 3.6% offer into an effective 4.6%.
    const f = selectFinancing({ ...base, interestRateOverride: 0.036 });
    expect(f.interestRate).toBe(0.036);
    expect(f.nonResidentSpread).toBe(0);
    // Everything downstream reads interestRate + nonResidentSpread.
    expect(f.interestRate + f.nonResidentSpread).toBeCloseTo(0.036, 12);
  });

  it("a supplied term replaces the tier's, and does not disturb the rate", () => {
    const f = selectFinancing({ ...base, loanTermYearsOverride: 25 });
    expect(f.loanTermYears).toBe(25);
    expect(f.interestRate).toBe(FINANCING_STRATEGIES.high.interestRate.value);
    expect(f.nonResidentSpread).toBe(NON_RESIDENT_INTEREST_SPREAD.value);
  });

  it("the two overrides are independent", () => {
    const both = selectFinancing({
      ...base,
      interestRateOverride: 0.036,
      loanTermYearsOverride: 25,
    });
    expect(both.interestRate + both.nonResidentSpread).toBeCloseTo(0.036, 12);
    expect(both.loanTermYears).toBe(25);
  });

  it("never touches the LTV or the mortgage amount - those are a separate question", () => {
    const plain = selectFinancing(base);
    const overridden = selectFinancing({
      ...base,
      interestRateOverride: 0.01,
      loanTermYearsOverride: 40,
    });
    expect(overridden.ltv).toBe(plain.ltv);
    expect(overridden.mortgageAmount).toBe(plain.mortgageAmount);
    expect(overridden.strategy).toBe(plain.strategy);
  });

  it("a resident gets no spread either way, so an override changes only the rate", () => {
    const resident = selectFinancing({ ...base, residency: "resident" });
    expect(resident.nonResidentSpread).toBe(0);
    const overridden = selectFinancing({
      ...base,
      residency: "resident",
      interestRateOverride: 0.03,
    });
    expect(overridden.interestRate).toBe(0.03);
    expect(overridden.nonResidentSpread).toBe(0);
  });

  it("derivedAllInInterestRate() is what a customer's own figure is comparable to", () => {
    // The rate shown in the wizard and carried as the provenance's
    // derivedValue: base plus spread, not the base rate on its own.
    const allIn = derivedAllInInterestRate({
      preferredLtv: 0.75,
      strategy: "high",
      residency: "nonResident",
    });
    expect(allIn).toBeCloseTo(
      FINANCING_STRATEGIES.high.interestRate.value + NON_RESIDENT_INTEREST_SPREAD.value,
      12,
    );
    expect(
      derivedAllInInterestRate({ preferredLtv: 0.75, strategy: "high", residency: "resident" }),
    ).toBe(FINANCING_STRATEGIES.high.interestRate.value);
  });
});
