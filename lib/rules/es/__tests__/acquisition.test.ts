import { describe, expect, it } from "vitest";
import { acquisitionCosts } from "../acquisition";
import { renovationStrategyTable, selectRenovation } from "../renovation";
import { fixedOperatingCosts, utilitiesBaseAnnual } from "../operating";
import { referenceCase } from "./referencecase";

// Golden values: corrected TSG_Model_v2.xlsx, Costs & Income!B125:D179.
describe("acquisition costs (reference case)", () => {
  const acq = acquisitionCosts({
    purchasePrice: 330000,
    renovationCosts: 55000,
    mortgageAmount: 247500,
    constraints: referenceCase.constraints,
  });

  it("computes each cost line (D131-D143)", () => {
    expect(acq.transferTaxITP).toBeCloseTo(33000, 9);
    expect(acq.stampDutyAJD).toBeCloseTo(4950, 9);
    expect(acq.notaryFee).toBeCloseTo(1650, 9);
    expect(acq.registrationFee).toBeCloseTo(990, 9);
    expect(acq.legalAdvice).toBeCloseTo(3300, 9);
    expect(acq.agencyFees).toBeCloseTo(16500, 9);
    expect(acq.bankFee).toBe(100);
  });

  it("computes total acquisition costs 445490 (D145)", () => {
    expect(acq.total).toBeCloseTo(445490, 9);
  });

  it("computes equity required 197990 (D153)", () => {
    expect(acq.equityRequired).toBeCloseTo(197990, 9);
  });

  it("passes both budget checks (H149/H151)", () => {
    expect(acq.withinTotalBudget).toBe(true);
    expect(acq.renovationWithinBudget).toBe(true);
  });
});

describe("renovation strategies (Costs & Income!B66:H84)", () => {
  const table = renovationStrategyTable({ maxRenovationBudget: 60000 });

  it("checks capex against the max renovation budget: Yes / Yes / No (D72/F72/H72)", () => {
    expect(table.map((s) => s.withinMaxRenovationBudget)).toEqual([true, true, false]);
  });

  it("selects the Light strategy with neutral multipliers", () => {
    const light = selectRenovation("light", { maxRenovationBudget: 60000 });
    expect(light.capex).toBe(55000);
    expect(light.rentMultiplier).toBe(1);
    expect(light.maintenanceFactor).toBe(1);
    expect(light.utilitiesEfficiency).toBe(1);
  });
});

describe("operating cost blocks", () => {
  it("computes the utilities base: 21.5 €/m² x 133 = 2859.5 (H60)", () => {
    expect(utilitiesBaseAnnual(133)).toBeCloseTo(2859.5, 9);
  });

  it("computes fixed operating costs (D159-D167)", () => {
    const fixed = fixedOperatingCosts({
      purchasePrice: 330000,
      mortgageAmount: 247500,
      effectiveInterestRate: 0.042,
    });
    expect(fixed.propertyTaxIBI).toBeCloseTo(1320, 9);
    expect(fixed.insurance).toBe(1030);
    expect(fixed.bankAccountFee).toBe(100);
    expect(fixed.mortgageInterest).toBeCloseTo(10395, 9);
    expect(fixed.total).toBeCloseTo(12845, 9);
  });
});
