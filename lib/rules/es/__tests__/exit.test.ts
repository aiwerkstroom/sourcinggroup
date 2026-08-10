import { describe, expect, it } from "vitest";
import { runEngine } from "../engine";
import { computeExit } from "../exit";
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
      finalYear: years[years.length - 1]!,
      purchasePrice: referenceCase.property.purchasePrice,
      acquisition: engineResult.acquisition,
      assumptions: testAssumptions,
    });
  }

  it("computes the acquisition value for CGT from ITP/AJD/notary/registration/legal only (not agency fees or bank fee)", () => {
    // 330000 + 33000 + 4950 + 1650 + 990 + 3300 = 373890.
    const result = exitFor("base");
    expect(result.acquisitionValueForCapitalGainsTax).toBeCloseTo(373890, 6);
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
      capitalGain: 91551.38946213154,
      capitalGainsTax: 17394.763997804992,
      mortgageBalanceAtExit: 102420.428129,
      netSaleProceeds: 345626.1973353265,
      nonResidentWithholdingAdvance: 14654.418420691609,
    },
    base: {
      sellingPrice: 537535.2268365559,
      sellingCommission: 21501.409073462237,
      transferValueForCapitalGainsTax: 512533.8177630936,
      capitalGain: 138643.81776309363,
      capitalGainsTax: 26342.325374987788,
      mortgageBalanceAtExit: 100266.961333,
      netSaleProceeds: 385924.53105510585,
      nonResidentWithholdingAdvance: 16126.056805096676,
    },
    optimistic: {
      sellingPrice: 590979.739859142,
      sellingCommission: 23639.189594365682,
      transferValueForCapitalGainsTax: 563840.5502647763,
      capitalGain: 189950.55026477634,
      capitalGainsTax: 36090.60455030751,
      mortgageBalanceAtExit: 99191.89344,
      netSaleProceeds: 428558.0522744688,
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
      finalYear: years[0]!,
      purchasePrice: referenceCase.property.purchasePrice,
      acquisition: { ...engineResult.acquisition, legalAdvice: 250000 },
      assumptions: testAssumptions,
    });
    expect(result.capitalGain).toBeLessThan(0);
    expect(result.capitalGainsTax).toBe(0);
  });
});
