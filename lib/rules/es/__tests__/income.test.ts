import { describe, expect, it } from "vitest";
import { baseMonthlyRent, buildIncomeModel, hybridGrossIncome, incomeLine } from "../income";

// Golden values: corrected TSG_Model_v3.xlsx, Costs & Income!J4:N38.
describe("income model (Excel golden values)", () => {
  it("computes base monthly rent LT: 17 €/m² x 133 m² = 2261 (L10)", () => {
    expect(baseMonthlyRent(17, 133)).toBe(2261);
  });

  it("computes base monthly rent ST: 36 €/m² x 133 m² = 4788 (N10)", () => {
    expect(baseMonthlyRent(36, 133)).toBe(4788);
  });

  it("builds the long-term income line (L10-L20)", () => {
    const line = incomeLine(17, 133, 0.9, 1);
    expect(line.baseAnnualRent).toBe(27132);
    expect(line.annualIncomeAtOccupancy).toBeCloseTo(24418.8, 9);
    expect(line.adjustedAnnualIncome).toBeCloseTo(24418.8, 9);
  });

  it("builds the short-term income line (N10-N20)", () => {
    const line = incomeLine(36, 133, 0.6, 1);
    expect(line.baseAnnualRent).toBe(57456);
    expect(line.annualIncomeAtOccupancy).toBeCloseTo(34473.6, 9);
  });

  it("computes hybrid gross income 60/40: 28440.72 (L38)", () => {
    expect(hybridGrossIncome(24418.8, 34473.6)).toBeCloseTo(28440.72, 9);
  });

  it("selects the gross income for the chosen rental strategy", () => {
    const base = {
      rentPerM2LongTerm: 17,
      rentPerM2ShortTerm: 36,
      livingAreaM2: 133,
      rentMultiplier: 1,
    };
    expect(
      buildIncomeModel({ ...base, rentalStrategy: "hybrid" }).selectedGrossAnnualIncome,
    ).toBeCloseTo(28440.72, 9);
    expect(
      buildIncomeModel({ ...base, rentalStrategy: "longTerm" }).selectedGrossAnnualIncome,
    ).toBeCloseTo(24418.8, 9);
    expect(
      buildIncomeModel({ ...base, rentalStrategy: "shortTerm" }).selectedGrossAnnualIncome,
    ).toBeCloseTo(34473.6, 9);
  });

  it("applies the renovation rent multiplier", () => {
    const line = incomeLine(17, 133, 0.9, 1.1);
    expect(line.adjustedAnnualIncome).toBeCloseTo(24418.8 * 1.1, 9);
  });
});
