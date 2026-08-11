import { describe, expect, it } from "vitest";
import { runEngine } from "../engine";
import { computeExit } from "../exit";
import { DEFAULT_RENOVATION_IMPROVEMENT_SHARE } from "../parameters";
import { buildProjectionYears } from "../projection";
import type { ExitAssumptions, ScenarioId } from "../types";
import { referenceCase } from "./referencecase";

/**
 * Golden values: independent recomputation in Python (MODEL_SPEC_FASE1B §8
 * - no Excel counterpart exists for phase 1b). Ten-year holding period,
 * all three scenarios of the reference case Avenida Primado Reig 19.
 *
 * The commission rate and plusvalía below are arbitrary TEST FIXTURE
 * values chosen only to exercise the formula - they are not defaults and
 * must never be read as recommendations (MODEL_SPEC_FASE1B §5: both are
 * required, sourceless inputs with no default anywhere in the engine).
 */
const testAssumptions: ExitAssumptions = {
  sellingCommissionRate: 0.04,
  municipalCapitalGainsTax: 3500,
};

describe("exit (reference case, 10-year holding period)", () => {
  const engineResult = runEngine(referenceCase);

  function exitFor(scenario: ScenarioId) {
    const scenarioResult = engineResult.scenarios.find((s) => s.id === scenario)!;
    const years = buildProjectionYears({
      years: 10,
      scenario,
      scenarioResult,
      purchasePrice: referenceCase.property.purchasePrice,
      financing: engineResult.selectedFinancing,
      fixedCosts: engineResult.fixedOperatingCosts,
      euResident: true,
      renovation: engineResult.selectedRenovation,
    });
    return computeExit({
      scenario,
      years,
      purchasePrice: referenceCase.property.purchasePrice,
      acquisition: engineResult.acquisition,
      renovation: engineResult.selectedRenovation,
      assumptions: testAssumptions,
    });
  }

  it("computes the acquisition value for CGT from ITP/AJD/notary/registration/legal, +0 mejora, minus cumulative depreciation", () => {
    // 330000 + 33000 + 4950 + 1650 + 990 + 3300 = 373890, +0 mejora (default
    // share 0), - 69300 cumulative depreciation (6930/year x 10 years, the
    // same figure §4's tax layer actually deducted) = 304590.
    const result = exitFor("base");
    expect(result.renovationImprovementValue).toBe(0);
    expect(result.cumulativeDepreciation).toBeCloseTo(69300, 6);
    expect(result.acquisitionValueForCapitalGainsTax).toBeCloseTo(304590, 6);
  });

  it("defaults renovationImprovementShare to 0: no renovation cost raises the acquisition value without justification", () => {
    expect(DEFAULT_RENOVATION_IMPROVEMENT_SHARE.value).toBe(0);
  });

  it("accepts an explicit renovationImprovementShare, raising the acquisition value and lowering the taxable gain", () => {
    const scenarioResult = engineResult.scenarios.find((s) => s.id === "base")!;
    const years = buildProjectionYears({
      years: 10,
      scenario: "base",
      scenarioResult,
      purchasePrice: referenceCase.property.purchasePrice,
      financing: engineResult.selectedFinancing,
      fixedCosts: engineResult.fixedOperatingCosts,
      euResident: true,
      renovation: engineResult.selectedRenovation,
    });
    const result = computeExit({
      scenario: "base",
      years,
      purchasePrice: referenceCase.property.purchasePrice,
      acquisition: engineResult.acquisition,
      renovation: engineResult.selectedRenovation,
      assumptions: testAssumptions,
      renovationImprovementShare: 0.5,
    });
    // 55000 (light strategy capex) x 0.5 = 27500 mejora; 373890 + 27500 -
    // 69300 cumulative depreciation = 332090.
    expect(result.renovationImprovementValue).toBeCloseTo(27500, 6);
    expect(result.acquisitionValueForCapitalGainsTax).toBeCloseTo(332090, 6);
    expect(result.transferValueForCapitalGainsTax).toBeCloseTo(512533.8177630936, 4);
    expect(result.capitalGain).toBeCloseTo(180443.81776309363, 4);
    expect(result.capitalGainsTax).toBeCloseTo(34284.32537498779, 4);
    expect(result.netSaleProceeds).toBeCloseTo(377982.53105510585, 4);
  });

  const golden: Record<
    ScenarioId,
    {
      sellingPrice: number;
      sellingCommission: number;
      transferValueForCapitalGainsTax: number;
      capitalGain: number;
      capitalGainsTax: number;
      mortgageBalanceAtExit: number;
      netSaleProceeds: number;
      nonResidentWithholdingAdvance: number;
    }
  > = {
    conservative: {
      sellingPrice: 488480.61402305367,
      sellingCommission: 19539.224560922146,
      transferValueForCapitalGainsTax: 465441.38946213154,
      capitalGain: 156693.38946213154,
      capitalGainsTax: 29771.74399780499,
      mortgageBalanceAtExit: 102420.428129,
      netSaleProceeds: 333249.21733532654,
      nonResidentWithholdingAdvance: 14654.418420691609,
    },
    base: {
      sellingPrice: 537535.2268365559,
      sellingCommission: 21501.409073462237,
      transferValueForCapitalGainsTax: 512533.8177630936,
      capitalGain: 207943.81776309363,
      capitalGainsTax: 39509.32537498779,
      mortgageBalanceAtExit: 100266.961333,
      netSaleProceeds: 372757.53105510585,
      nonResidentWithholdingAdvance: 16126.056805096676,
    },
    optimistic: {
      sellingPrice: 590979.739859142,
      sellingCommission: 23639.189594365682,
      transferValueForCapitalGainsTax: 563840.5502647763,
      capitalGain: 262022.55026477634,
      capitalGainsTax: 49784.28455030751,
      mortgageBalanceAtExit: 99191.89344,
      netSaleProceeds: 414864.3722744688,
      nonResidentWithholdingAdvance: 17729.39219577426,
    },
  };

  (Object.keys(golden) as ScenarioId[]).forEach((scenario) => {
    it(`${scenario}: matches the independent doorrekening`, () => {
      const result = exitFor(scenario);
      const expected = golden[scenario];
      expect(result.holdingYears).toBe(10);
      expect(result.sellingPrice).toBeCloseTo(expected.sellingPrice, 4);
      expect(result.sellingCommission).toBeCloseTo(expected.sellingCommission, 4);
      expect(result.transferValueForCapitalGainsTax).toBeCloseTo(
        expected.transferValueForCapitalGainsTax,
        4,
      );
      expect(result.capitalGain).toBeCloseTo(expected.capitalGain, 4);
      expect(result.capitalGainsTax).toBeCloseTo(expected.capitalGainsTax, 4);
      expect(result.mortgageBalanceAtExit).toBeCloseTo(expected.mortgageBalanceAtExit, 4);
      expect(result.netSaleProceeds).toBeCloseTo(expected.netSaleProceeds, 4);
      expect(result.nonResidentWithholdingAdvance).toBeCloseTo(
        expected.nonResidentWithholdingAdvance,
        4,
      );
    });
  });

  it("sale price uses the scenario's own value growth, compounded over the holding period", () => {
    // 330000 x 1.05^10 (base) vs x 1.04^10 (conservative): higher scenario
    // growth must produce a strictly higher sale price for the same years.
    const conservative = exitFor("conservative");
    const base = exitFor("base");
    const optimistic = exitFor("optimistic");
    expect(base.sellingPrice).toBeGreaterThan(conservative.sellingPrice);
    expect(optimistic.sellingPrice).toBeGreaterThan(base.sellingPrice);
  });

  it("does not subtract the non-resident withholding from net sale proceeds", () => {
    // MODEL_SPEC_FASE1B §5: the 3% withholding is an advance on the CGT,
    // settled via Modelo 210 - not a cost. Net proceeds = sale price -
    // commission - plusvalía - CGT - mortgage balance, nothing more.
    const result = exitFor("base");
    const manualNet =
      result.sellingPrice -
      result.sellingCommission -
      result.municipalCapitalGainsTax -
      result.capitalGainsTax -
      result.mortgageBalanceAtExit;
    expect(result.netSaleProceeds).toBeCloseTo(manualNet, 6);
    expect(result.netSaleProceeds).not.toBeCloseTo(
      manualNet - result.nonResidentWithholdingAdvance,
      2,
    );
  });

  it("clamps capital gains tax at zero on a loss, instead of reporting a negative tax", () => {
    const scenarioResult = engineResult.scenarios.find((s) => s.id === "base")!;
    const years = buildProjectionYears({
      years: 1,
      scenario: "base",
      scenarioResult,
      purchasePrice: referenceCase.property.purchasePrice,
      financing: engineResult.selectedFinancing,
      fixedCosts: engineResult.fixedOperatingCosts,
      euResident: true,
      renovation: engineResult.selectedRenovation,
    });
    // Force a loss with inflated (fictional) acquisition costs, independent
    // of the sale price - real acquisition costs never dominate like this.
    const result = computeExit({
      scenario: "base",
      years,
      purchasePrice: referenceCase.property.purchasePrice,
      acquisition: { ...engineResult.acquisition, legalAdvice: 250000 },
      renovation: engineResult.selectedRenovation,
      assumptions: testAssumptions,
    });
    expect(result.capitalGain).toBeLessThan(0);
    expect(result.capitalGainsTax).toBe(0);
  });

  it("sums cumulativeDepreciation directly from the projection's own per-year track, not a second calculation", () => {
    const scenarioResult = engineResult.scenarios.find((s) => s.id === "base")!;
    const years = buildProjectionYears({
      years: 10,
      scenario: "base",
      scenarioResult,
      purchasePrice: referenceCase.property.purchasePrice,
      financing: engineResult.selectedFinancing,
      fixedCosts: engineResult.fixedOperatingCosts,
      euResident: true,
      renovation: engineResult.selectedRenovation,
    });
    const manualSum = years.reduce((sum, y) => sum + y.depreciation, 0);
    const result = computeExit({
      scenario: "base",
      years,
      purchasePrice: referenceCase.property.purchasePrice,
      acquisition: engineResult.acquisition,
      renovation: engineResult.selectedRenovation,
      assumptions: testAssumptions,
    });
    expect(result.cumulativeDepreciation).toBeCloseTo(manualSum, 9);
  });

  it("shortens the holding period when fewer projection years are passed in", () => {
    const scenarioResult = engineResult.scenarios.find((s) => s.id === "base")!;
    const years = buildProjectionYears({
      years: 5,
      scenario: "base",
      scenarioResult,
      purchasePrice: referenceCase.property.purchasePrice,
      financing: engineResult.selectedFinancing,
      fixedCosts: engineResult.fixedOperatingCosts,
      euResident: true,
      renovation: engineResult.selectedRenovation,
    });
    const result = computeExit({
      scenario: "base",
      years,
      purchasePrice: referenceCase.property.purchasePrice,
      acquisition: engineResult.acquisition,
      renovation: engineResult.selectedRenovation,
      assumptions: testAssumptions,
    });
    expect(result.holdingYears).toBe(5);
    // 6930/year x 5 years = 34650, not the 10-year figure of 69300.
    expect(result.cumulativeDepreciation).toBeCloseTo(34650, 6);
  });

  it("rejects an empty projection instead of computing an exit for a zero-year holding period", () => {
    expect(() =>
      computeExit({
        scenario: "base",
        years: [],
        purchasePrice: referenceCase.property.purchasePrice,
        acquisition: engineResult.acquisition,
        renovation: engineResult.selectedRenovation,
        assumptions: testAssumptions,
      }),
    ).toThrow(/at least one projection year/);
  });
});
