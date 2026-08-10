import { describe, expect, it } from "vitest";
import { runEngine } from "../engine";
import { referenceCase } from "./referencecase";

/**
 * Golden test: full engine run against the corrected TSG_Model_v3.xlsx
 * for the reference case (MODEL_SPEC.md §11). v3 corrections: signed
 * optimistic interest delta (-0.25%) and fixed costs (IBI + insurance +
 * bank fee = 2450/yr) included in NOI and total opex.
 */
describe("reference case Avenida Primado Reig 19 (Excel parity)", () => {
  const result = runEngine(referenceCase);
  const [conservative, base, optimistic] = result.scenarios;

  it("income model matches (L10-L38)", () => {
    expect(result.income.longTerm.baseMonthlyRent).toBe(2261);
    expect(result.income.shortTerm.baseMonthlyRent).toBe(4788);
    expect(result.income.longTerm.adjustedAnnualIncome).toBeCloseTo(24418.8, 9);
    expect(result.income.shortTerm.adjustedAnnualIncome).toBeCloseTo(34473.6, 9);
    expect(result.income.hybridGrossAnnualIncome).toBeCloseTo(28440.72, 9);
    expect(result.income.selectedGrossAnnualIncome).toBeCloseTo(28440.72, 9);
  });

  it("scenario gross income matches (L74/N74/P74)", () => {
    expect(conservative!.grossIncome).toBeCloseTo(23036.9832, 8);
    expect(base!.grossIncome).toBeCloseTo(28440.72, 8);
    expect(optimistic!.grossIncome).toBeCloseTo(34413.2712, 8);
  });

  it("property management matches (L78/N78/P78)", () => {
    expect(conservative!.propertyManagement).toBeCloseTo(1842.958656, 8);
    expect(base!.propertyManagement).toBeCloseTo(2275.2576, 8);
    expect(optimistic!.propertyManagement).toBeCloseTo(2753.061696, 8);
  });

  it("maintenance matches, incl. the corrected optimistic multiplier (L80/N80/P80)", () => {
    expect(conservative!.maintenance).toBeCloseTo(1267.034076, 8);
    expect(base!.maintenance).toBeCloseTo(1422.036, 8);
    expect(optimistic!.maintenance).toBeCloseTo(1634.630382, 8);
  });

  it("utilities match (L84/N84/P84)", () => {
    expect(result.utilitiesBaseAnnual).toBeCloseTo(2859.5, 9);
    expect(conservative!.utilities).toBeCloseTo(3145.45, 8);
    expect(base!.utilities).toBeCloseTo(2859.5, 8);
    expect(optimistic!.utilities).toBeCloseTo(2716.525, 8);
  });

  it("includes the fixed costs 2450/yr in every scenario (v3)", () => {
    expect(result.scenarios.map((s) => s.fixedCosts)).toEqual([2450, 2450, 2450]);
  });

  it("NOI incl. fixed costs matches (L86/N86/P86)", () => {
    expect(conservative!.noi).toBeCloseTo(14331.540468, 7);
    expect(base!.noi).toBeCloseTo(19433.9264, 7);
    expect(optimistic!.noi).toBeCloseTo(24859.054122, 7);
  });

  it("scenario interest rates include the signed delta + non-resident spread (L90/N90/P90)", () => {
    expect(conservative!.interestRate).toBeCloseTo(0.047, 12);
    expect(base!.interestRate).toBeCloseTo(0.042, 12);
    expect(optimistic!.interestRate).toBeCloseTo(0.0395, 12);
  });

  it("debt service matches Excel PMT (L94-P96)", () => {
    expect(base!.annualInterestOnly).toBeCloseTo(10395, 8);
    expect(optimistic!.annualInterestOnly).toBeCloseTo(9776.25, 8);
    expect(conservative!.annualDebtService).toBeCloseTo(23025.0534114773, 7);
    expect(base!.annualDebtService).toBeCloseTo(22267.5851768972, 7);
    expect(optimistic!.annualDebtService).toBeCloseTo(21894.3888519704, 7);
  });

  it("total opex incl. fixed costs and amortising debt service (L98/N98/P98)", () => {
    expect(conservative!.totalOpexInclDebtService).toBeCloseTo(31730.4961434777, 7);
    expect(base!.totalOpexInclDebtService).toBeCloseTo(31274.3787768970, 7);
    expect(optimistic!.totalOpexInclDebtService).toBeCloseTo(31448.6059299704, 7);
  });

  it("annual and monthly cashflow match (L102-P104)", () => {
    expect(conservative!.annualCashflow).toBeCloseTo(-8693.51294347771, 7);
    expect(base!.annualCashflow).toBeCloseTo(-2833.65877689696, 7);
    expect(optimistic!.annualCashflow).toBeCloseTo(2964.66527002957, 7);
    expect(conservative!.monthlyCashflow).toBeCloseTo(-724.459411956476, 8);
    expect(base!.monthlyCashflow).toBeCloseTo(-236.13823140808, 8);
    expect(optimistic!.monthlyCashflow).toBeCloseTo(247.055439169131, 8);
  });

  it("min monthly cashflow check: No / No / No (L106-P106)", () => {
    expect(result.scenarios.map((s) => s.meetsMinMonthlyCashflow)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("DSCR matches the corrected formula NOI / annuity (L108-P108)", () => {
    expect(conservative!.dscr).toBeCloseTo(0.622432452680258, 10);
    expect(base!.dscr).toBeCloseTo(0.872745124611135, 10);
    expect(optimistic!.dscr).toBeCloseTo(1.13540753706687, 10);
  });

  it("DSCR verdict: NO / NO / Yes (L110-P110)", () => {
    expect(result.scenarios.map((s) => s.dscrVerdict)).toEqual(["no", "no", "yes"]);
  });

  it("acquisition and budget compliance match (D145-D153, H149/H151)", () => {
    expect(result.acquisition.total).toBeCloseTo(445490, 9);
    expect(result.acquisition.mortgageAmount).toBe(247500);
    expect(result.acquisition.equityRequired).toBeCloseTo(197990, 9);
    expect(result.acquisition.withinTotalBudget).toBe(true);
    expect(result.acquisition.renovationWithinBudget).toBe(true);
  });

  it("fixed operating costs match (D159-D167)", () => {
    expect(result.fixedOperatingCosts.propertyTaxIBI).toBeCloseTo(1320, 9);
    expect(result.fixedOperatingCosts.insurance).toBe(1030);
    expect(result.fixedOperatingCosts.mortgageInterest).toBeCloseTo(10395, 9);
    expect(result.fixedOperatingCosts.total).toBeCloseTo(12845, 9);
  });

  it("selected financing matches (D119-D124, D149)", () => {
    expect(result.selectedFinancing.ltv).toBe(0.75);
    expect(result.selectedFinancing.interestRate).toBe(0.032);
    expect(result.selectedFinancing.loanTermYears).toBe(15);
    expect(result.selectedFinancing.nonResidentSpread).toBe(0.01);
    expect(result.selectedFinancing.mortgageAmount).toBe(247500);
  });

  it("tax calculator matches Reference Info (M63/N63/O63, I47-I54)", () => {
    const [cons, b, opt] = result.tax.scenarios;
    expect(cons!.deductibleCosts).toBeCloseTo(24637.292732, 6);
    expect(b!.deductibleCosts).toBeCloseTo(24462.2936, 6);
    // Optimistic interest-only dropped to 9776.25 with the signed delta (v3).
    expect(opt!.deductibleCosts).toBeCloseTo(24850.742078, 6);
    expect(result.tax.grossRentalIncomeBase).toBeCloseTo(28440.72, 8);
    expect(result.tax.taxableIncomeBase).toBeCloseTo(3978.4264, 6);
    expect(result.tax.taxDueBase).toBeCloseTo(755.901016, 6);
  });

  it("non-EU rate is 24% (I51/I54)", () => {
    const nonEu = runEngine({
      ...referenceCase,
      selections: { ...referenceCase.selections, euResident: false },
    });
    expect(nonEu.tax.taxRate).toBe(0.24);
    expect(nonEu.tax.taxDueBase).toBeCloseTo(954.822336, 6);
  });
});
