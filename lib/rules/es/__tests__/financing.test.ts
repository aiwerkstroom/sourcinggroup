import { describe, expect, it } from "vitest";
import {
  annualAnnuityDebtService,
  annualInterestOnly,
  clampLtv,
  financingStrategyTable,
  selectFinancing,
  selectInterestRate,
} from "../financing";
import { referenceCase } from "./referencecase";

// Golden values: corrected TSG_Model_v2.xlsx.
describe("annuity debt service (Excel PMT parity)", () => {
  it("replicates PMT for the three scenario rates (L96/N96/P96)", () => {
    expect(annualAnnuityDebtService(0.047, 15, 247500)).toBeCloseTo(23025.0534114773, 8);
    expect(annualAnnuityDebtService(0.042, 15, 247500)).toBeCloseTo(22267.5851768972, 8);
    expect(annualAnnuityDebtService(0.0445, 15, 247500)).toBeCloseTo(22644.4796491766, 8);
  });

  it("handles a zero interest rate as linear repayment", () => {
    expect(annualAnnuityDebtService(0, 15, 180000)).toBeCloseTo(12000, 9);
  });

  it("computes interest-only debt service (L94/N94/P94)", () => {
    expect(annualInterestOnly(0.047, 247500)).toBeCloseTo(11632.5, 9);
    expect(annualInterestOnly(0.042, 247500)).toBeCloseTo(10395, 9);
    expect(annualInterestOnly(0.0445, 247500)).toBeCloseTo(11013.75, 9);
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
