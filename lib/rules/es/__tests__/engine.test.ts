import { describe, expect, it } from "vitest";
import { runEngine } from "../engine";
import { referenceCase } from "./referencecase";

/**
 * Golden test: full engine run against the corrected TSG_Model_v3.xlsx
 * for the reference case (MODEL_SPEC.md §11). v3 corrections: signed
 * optimistic interest delta (-0.25%) and fixed costs (IBI + insurance +
 * bank fee = 2450/yr) included in NOI and total opex.
 *
 * MODEL_SPEC.md §15 adds a fourth fixed cost beyond the Excel: gastos de
 * comunidad, a mandatory PropertyInput.communityFeesAnnual with no
 * default. The reference case's fixture (€ 900/yr - not sourced for this
 * building, chosen only to exercise the formula) is included from here
 * on, so the figures below are "Excel parity + € 900/yr community fees",
 * not pure Excel parity; acquisition.test.ts keeps a communityFeesAnnual:
 * 0 case for the untouched Excel baseline.
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

  it("includes the fixed costs 3350/yr in every scenario (v3 2450 + 900 gastos de comunidad)", () => {
    expect(result.scenarios.map((s) => s.fixedCosts)).toEqual([3350, 3350, 3350]);
  });

  it("NOI incl. fixed costs matches (L86/N86/P86), lowered by the € 900 community fee", () => {
    expect(conservative!.noi).toBeCloseTo(13431.540468, 7);
    expect(base!.noi).toBeCloseTo(18533.9264, 7);
    expect(optimistic!.noi).toBeCloseTo(23959.054122, 7);
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
    expect(optimistic!.annualDebtService).toBeCloseTo(21894.3888519706, 7);
  });

  it("total opex incl. fixed costs and amortising debt service (L98/N98/P98)", () => {
    expect(conservative!.totalOpexInclDebtService).toBeCloseTo(32630.4961434773, 7);
    expect(base!.totalOpexInclDebtService).toBeCloseTo(32174.3787768972, 7);
    expect(optimistic!.totalOpexInclDebtService).toBeCloseTo(32348.6059299706, 7);
  });

  it("annual and monthly cashflow match (L102-P104)", () => {
    expect(conservative!.annualCashflow).toBeCloseTo(-9593.51294347732, 7);
    expect(base!.annualCashflow).toBeCloseTo(-3733.65877689723, 7);
    expect(optimistic!.annualCashflow).toBeCloseTo(2064.66527002944, 7);
    expect(conservative!.monthlyCashflow).toBeCloseTo(-799.459411956443, 8);
    expect(base!.monthlyCashflow).toBeCloseTo(-311.138231408102, 8);
    expect(optimistic!.monthlyCashflow).toBeCloseTo(172.05543916912, 8);
  });

  it("min monthly cashflow check: No / No / No (L106-P106)", () => {
    expect(result.scenarios.map((s) => s.meetsMinMonthlyCashflow)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("DSCR matches the corrected formula NOI / annuity (L108-P108)", () => {
    expect(conservative!.dscr).toBeCloseTo(0.5833445954702777, 10);
    expect(base!.dscr).toBeCloseTo(0.8323276301747033, 10);
    expect(optimistic!.dscr).toBeCloseTo(1.0943011144996524, 10);
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

  it("fixed operating costs match (D159-D167), plus gastos de comunidad (§15, no Excel line)", () => {
    expect(result.fixedOperatingCosts.propertyTaxIBI).toBeCloseTo(1320, 9);
    expect(result.fixedOperatingCosts.insurance).toBe(1030);
    expect(result.fixedOperatingCosts.communityFees).toBe(900);
    expect(result.fixedOperatingCosts.mortgageInterest).toBeCloseTo(10395, 9);
    expect(result.fixedOperatingCosts.total).toBeCloseTo(13745, 9);
  });

  it("selected financing matches (D119-D124, D149)", () => {
    expect(result.selectedFinancing.ltv).toBe(0.75);
    expect(result.selectedFinancing.interestRate).toBe(0.032);
    expect(result.selectedFinancing.loanTermYears).toBe(15);
    expect(result.selectedFinancing.nonResidentSpread).toBe(0.01);
    expect(result.selectedFinancing.mortgageAmount).toBe(247500);
  });

  it("tax calculator matches Reference Info (M63/N63/O63, I47-I54), deductibleCosts +900 for gastos de comunidad", () => {
    const [cons, b, opt] = result.tax.scenarios;
    expect(cons!.deductibleCosts).toBeCloseTo(25537.292732, 6);
    expect(b!.deductibleCosts).toBeCloseTo(25362.2936, 6);
    // Optimistic interest-only dropped to 9776.25 with the signed delta (v3).
    expect(opt!.deductibleCosts).toBeCloseTo(25750.742078, 6);
    expect(result.tax.grossRentalIncomeBase).toBeCloseTo(28440.72, 8);
    expect(result.tax.taxableIncomeBase).toBeCloseTo(3078.4264, 6);
    expect(result.tax.taxDueBase).toBeCloseTo(584.901016, 6);
  });

  it("non-EU rate is 24% (I51/I54)", () => {
    const nonEu = runEngine({
      ...referenceCase,
      selections: { ...referenceCase.selections, euResident: false },
    });
    expect(nonEu.tax.taxRate).toBe(0.24);
    expect(nonEu.tax.taxDueBase).toBeCloseTo(738.822336, 6);
  });
});
