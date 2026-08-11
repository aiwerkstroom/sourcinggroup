import { describe, expect, it } from "vitest";
import { computeExit } from "../exit";
import { runEngine } from "../engine";
import { computeScenarioIrr } from "../irr";
import { buildScenarioOutcome } from "../outcome";
import { buildProjectionYears } from "../projection";
import type { ExitAssumptions, ScenarioId } from "../types";
import { referenceCase } from "./referencecase";

/**
 * Golden values: independent recomputation in Python (MODEL_SPEC_FASE1B §8
 * - no Excel counterpart exists for phase 1b), reusing the same per-year
 * figures already locked down in projection.test.ts, exit.test.ts and
 * irr.test.ts. Ten-year holding period, reference case Avenida Primado
 * Reig 19. Recomputed for MODEL_SPEC.md §15's gastos de comunidad
 * (€ 900/yr fixture, CPI-indexed) - every year's cashflowAfterTax is
 * lower than before, so totalReturn is lower too, though the ranking and
 * "payback is always null" conclusions are unaffected.
 */
const testAssumptions: ExitAssumptions = {
  sellingCommissionRate: 0.04,
  municipalCapitalGainsTax: 3500,
};

describe("scenario outcome (reference case, 10-year holding period)", () => {
  const engineResult = runEngine(referenceCase);

  function outcomeFor(scenario: ScenarioId) {
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
    const exit = computeExit({
      scenario,
      years,
      purchasePrice: referenceCase.property.purchasePrice,
      acquisition: engineResult.acquisition,
      renovation: engineResult.selectedRenovation,
      assumptions: testAssumptions,
    });
    const irr = computeScenarioIrr({
      equityInvested: engineResult.acquisition.equityRequired,
      years,
      exit,
    });
    return buildScenarioOutcome({
      scenario,
      purchasePrice: referenceCase.property.purchasePrice,
      years,
      exit,
      irr,
      equityRequired: engineResult.acquisition.equityRequired,
      equityAvailable: referenceCase.property.ownMoney,
      minRequiredReturn: referenceCase.constraints.minRoiTarget,
      rentalStrategy: referenceCase.selections.rentalStrategy,
      renovationStrategy: referenceCase.selections.renovationStrategy,
    });
  }

  it("year series: cumulative cashflow, property value and equity built (base scenario)", () => {
    const outcome = outcomeFor("base");
    expect(outcome.years).toHaveLength(10);

    const y1 = outcome.years[0]!;
    expect(y1.cashflowAfterTax).toBeCloseTo(-8094.569177, 4);
    expect(y1.cumulativeCashflow).toBeCloseTo(-8094.569177, 4);
    // 330000 x 1.05^1 = 346500.
    expect(y1.propertyValue).toBeCloseTo(346500, 4);
    expect(y1.mortgageBalance).toBeCloseTo(235396.180058, 4);
    expect(y1.equityBuilt).toBeCloseTo(346500 - 235396.180058, 4);

    const y10 = outcome.years[9]!;
    // Cumulative operating cashflow after 10 years: -22406.542135 (never
    // recoups the 197990 equity - see the payback test below).
    expect(y10.cumulativeCashflow).toBeCloseTo(-22406.542135, 3);
    // 330000 x 1.05^10.
    expect(y10.propertyValue).toBeCloseTo(330000 * 1.05 ** 10, 4);
  });

  const goldenTotals: Record<
    ScenarioId,
    { totalReturn: number; paybackYear: null }
  > = {
    conservative: { totalReturn: 0.286934, paybackYear: null },
    base: { totalReturn: 0.769539, paybackYear: null },
    optimistic: { totalReturn: 1.259109, paybackYear: null },
  };

  (Object.keys(goldenTotals) as ScenarioId[]).forEach((scenario) => {
    it(`${scenario}: total return and payback year match the independent doorrekening`, () => {
      const outcome = outcomeFor(scenario);
      const expected = goldenTotals[scenario];
      expect(outcome.totalReturn).toBeCloseTo(expected.totalReturn, 4);
      expect(outcome.paybackYear).toBe(expected.paybackYear);
    });
  });

  it("payback is null in every scenario: this deal only recoups via the sale, never via 10 years of rent alone", () => {
    // Even optimistic's cumulative operating cashflow after 10 years
    // (32416.65) is far short of the 197990 equity invested - the return
    // comes from the exit, not from carrying the property.
    (["conservative", "base", "optimistic"] as ScenarioId[]).forEach((scenario) => {
      expect(outcomeFor(scenario).paybackYear).toBeNull();
    });
  });

  it("equity fit check: the reference case needs more equity than the investor has available", () => {
    // Excel-verified equityRequired 197990 (MODEL_SPEC.md §11) vs.
    // Property Input ownMoney 115000 (§11: "eigen geld"). This check did
    // not exist before this correction.
    const outcome = outcomeFor("base");
    expect(outcome.equityFit.equityRequired).toBeCloseTo(197990, 6);
    expect(outcome.equityFit.equityAvailable).toBe(115000);
    expect(outcome.equityFit.fitsWithinAvailableEquity).toBe(false);
  });

  it("equity fit check reports null (not false) when available equity is unknown", () => {
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
    const exit = computeExit({
      scenario: "base",
      years,
      purchasePrice: referenceCase.property.purchasePrice,
      acquisition: engineResult.acquisition,
      renovation: engineResult.selectedRenovation,
      assumptions: testAssumptions,
    });
    const irr = computeScenarioIrr({
      equityInvested: engineResult.acquisition.equityRequired,
      years,
      exit,
    });
    const outcome = buildScenarioOutcome({
      scenario: "base",
      purchasePrice: referenceCase.property.purchasePrice,
      years,
      exit,
      irr,
      equityRequired: engineResult.acquisition.equityRequired,
      equityAvailable: undefined,
      rentalStrategy: referenceCase.selections.rentalStrategy,
      renovationStrategy: referenceCase.selections.renovationStrategy,
    });
    expect(outcome.equityFit.fitsWithinAvailableEquity).toBeNull();
  });

  it("return requirement check: uses the investor's 4% minRoiTarget, not the 0% default", () => {
    expect(referenceCase.constraints.minRoiTarget).toBe(0.04);
    const conservative = outcomeFor("conservative");
    const base = outcomeFor("base");
    const optimistic = outcomeFor("optimistic");
    expect(conservative.returnRequirement.minRequiredReturn).toBe(0.04);
    // Conservative's IRR (2.18%) misses the 4% hurdle even though it is
    // a defined, positive return.
    expect(conservative.returnRequirement.meetsMinRequiredReturn).toBe(false);
    expect(base.returnRequirement.meetsMinRequiredReturn).toBe(true);
    expect(optimistic.returnRequirement.meetsMinRequiredReturn).toBe(true);
  });

  it("falls back to DEFAULT_MIN_REQUIRED_RETURN (0%) when no hurdle rate is given", () => {
    const scenarioResult = engineResult.scenarios.find((s) => s.id === "conservative")!;
    const years = buildProjectionYears({
      years: 10,
      scenario: "conservative",
      scenarioResult,
      purchasePrice: referenceCase.property.purchasePrice,
      financing: engineResult.selectedFinancing,
      fixedCosts: engineResult.fixedOperatingCosts,
      euResident: true,
      renovation: engineResult.selectedRenovation,
    });
    const exit = computeExit({
      scenario: "conservative",
      years,
      purchasePrice: referenceCase.property.purchasePrice,
      acquisition: engineResult.acquisition,
      renovation: engineResult.selectedRenovation,
      assumptions: testAssumptions,
    });
    const irr = computeScenarioIrr({
      equityInvested: engineResult.acquisition.equityRequired,
      years,
      exit,
    });
    const outcome = buildScenarioOutcome({
      scenario: "conservative",
      purchasePrice: referenceCase.property.purchasePrice,
      years,
      exit,
      irr,
      equityRequired: engineResult.acquisition.equityRequired,
      equityAvailable: referenceCase.property.ownMoney,
      // minRequiredReturn omitted deliberately.
      rentalStrategy: referenceCase.selections.rentalStrategy,
      renovationStrategy: referenceCase.selections.renovationStrategy,
    });
    expect(outcome.returnRequirement.minRequiredReturn).toBe(0);
    // Conservative's positive 2.18% IRR now clears the weaker 0% default.
    expect(outcome.returnRequirement.meetsMinRequiredReturn).toBe(true);
    // DEFAULT_MIN_REQUIRED_RETURN joins placeholdersUsed only when the
    // hurdle rate was not supplied - unlike outcomeFor(), which always
    // passes referenceCase.constraints.minRoiTarget.
    expect(outcome.placeholdersUsed.map((p) => p.name)).toContain(
      "DEFAULT_MIN_REQUIRED_RETURN",
    );
  });

  it("return requirement is null (not false) when the IRR itself is not defined", () => {
    const scenarioResult = engineResult.scenarios.find((s) => s.id === "conservative")!;
    const years = buildProjectionYears({
      years: 1,
      scenario: "conservative",
      scenarioResult,
      purchasePrice: referenceCase.property.purchasePrice,
      financing: engineResult.selectedFinancing,
      fixedCosts: engineResult.fixedOperatingCosts,
      euResident: true,
      renovation: engineResult.selectedRenovation,
    });
    // A single-year, all-negative-cashflow, no-exit series has zero sign
    // changes: no rate can zero its NPV.
    const irr = { defined: false as const, reason: "synthetic: no sign change" };
    const outcome = buildScenarioOutcome({
      scenario: "conservative",
      purchasePrice: referenceCase.property.purchasePrice,
      years,
      exit: {
        scenario: "conservative",
        holdingYears: 1,
        sellingPrice: 0,
        sellingCommission: 0,
        municipalCapitalGainsTax: 0,
        transferValueForCapitalGainsTax: 0,
        renovationImprovementValue: 0,
        cumulativeDepreciation: 0,
        acquisitionValueForCapitalGainsTax: 0,
        capitalGain: 0,
        capitalGainsTax: 0,
        mortgageBalanceAtExit: 0,
        netSaleProceeds: 0,
        nonResidentWithholdingAdvance: 0,
      },
      irr,
      equityRequired: engineResult.acquisition.equityRequired,
      equityAvailable: referenceCase.property.ownMoney,
      rentalStrategy: referenceCase.selections.rentalStrategy,
      renovationStrategy: referenceCase.selections.renovationStrategy,
    });
    expect(outcome.returnRequirement.meetsMinRequiredReturn).toBeNull();
  });

  it("rejects an empty projection", () => {
    expect(() =>
      buildScenarioOutcome({
        scenario: "base",
        purchasePrice: referenceCase.property.purchasePrice,
        years: [],
        exit: outcomeFor("base").exit,
        irr: outcomeFor("base").irr,
        equityRequired: engineResult.acquisition.equityRequired,
        equityAvailable: referenceCase.property.ownMoney,
        rentalStrategy: referenceCase.selections.rentalStrategy,
        renovationStrategy: referenceCase.selections.renovationStrategy,
      }),
    ).toThrow(/at least one projection year/);
  });

  describe("placeholdersUsed: which unconfirmed assumptions this outcome actually rests on", () => {
    it("reference case (hybrid, light renovation): occupancy (both), the five light-renovation fields, this scenario's depreciation factor, the building-share/mejora-share/cadastral defaults", () => {
      const outcome = outcomeFor("base");
      const names = outcome.placeholdersUsed.map((p) => p.name);
      expect(names).toEqual(
        expect.arrayContaining([
          "MAINTENANCE_RATE",
          "BANK_FEE",
          "BASE_OCCUPANCY_LONG_TERM",
          "BASE_OCCUPANCY_SHORT_TERM",
          "RENOVATION_STRATEGIES.light.capex",
          "RENOVATION_STRATEGIES.light.rentMultiplier",
          "RENOVATION_STRATEGIES.light.maintenanceFactor",
          "RENOVATION_STRATEGIES.light.utilitiesEfficiency",
          "RENOVATION_STRATEGIES.light.timeToRentMonths",
          "DEPRECIATION_SCENARIO_FACTORS.base",
          "DEFAULT_BUILDING_SHARE_OF_VALUE",
          "DEFAULT_RENOVATION_IMPROVEMENT_SHARE",
          // referenceCase.property.cadastralValue is not set, so the IBI
          // approximation's placeholder applies too (MODEL_SPEC.md §16).
          "DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO",
        ]),
      );
      // referenceCase.constraints.minRoiTarget is set, so the fallback is
      // not consulted for this outcome.
      expect(names).not.toContain("DEFAULT_MIN_REQUIRED_RETURN");
      // Not the minimal or heavy strategy's fields, and not the other
      // scenarios' depreciation factors - those never entered this
      // outcome's numbers.
      expect(names).not.toContain("RENOVATION_STRATEGIES.minimal.capex");
      expect(names).not.toContain("RENOVATION_STRATEGIES.heavy.capex");
      expect(names).not.toContain("DEPRECIATION_SCENARIO_FACTORS.conservative");
      expect(names).not.toContain("DEPRECIATION_SCENARIO_FACTORS.optimistic");
    });

    it("every entry is genuinely PLACEHOLDER, never SOURCED or ESTIMATE", () => {
      const outcome = outcomeFor("optimistic");
      outcome.placeholdersUsed.forEach((p) => {
        expect(p.provenance).toBe("PLACEHOLDER");
      });
    });

    it("long-term-only strategy depends on the long-term occupancy PLACEHOLDER but not the short-term one", () => {
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
      const exit = computeExit({
        scenario: "base",
        years,
        purchasePrice: referenceCase.property.purchasePrice,
        acquisition: engineResult.acquisition,
        renovation: engineResult.selectedRenovation,
        assumptions: testAssumptions,
      });
      const irr = computeScenarioIrr({
        equityInvested: engineResult.acquisition.equityRequired,
        years,
        exit,
      });
      const outcome = buildScenarioOutcome({
        scenario: "base",
        purchasePrice: referenceCase.property.purchasePrice,
        years,
        exit,
        irr,
        equityRequired: engineResult.acquisition.equityRequired,
        equityAvailable: referenceCase.property.ownMoney,
        minRequiredReturn: referenceCase.constraints.minRoiTarget,
        rentalStrategy: "longTerm",
        renovationStrategy: "light",
      });
      const names = outcome.placeholdersUsed.map((p) => p.name);
      expect(names).toContain("BASE_OCCUPANCY_LONG_TERM");
      expect(names).not.toContain("BASE_OCCUPANCY_SHORT_TERM");
    });

    it("an explicit buildingShareOfValue / renovationImprovementShare drops their defaults from the list", () => {
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
        buildingShareOfValue: 0.65, // property-specific cadastral figure, not the generic default
      });
      const exit = computeExit({
        scenario: "base",
        years,
        purchasePrice: referenceCase.property.purchasePrice,
        acquisition: engineResult.acquisition,
        renovation: engineResult.selectedRenovation,
        assumptions: testAssumptions,
        renovationImprovementShare: 0.5, // documented mejora share, not the safe 0 default
      });
      const irr = computeScenarioIrr({
        equityInvested: engineResult.acquisition.equityRequired,
        years,
        exit,
      });
      const outcome = buildScenarioOutcome({
        scenario: "base",
        purchasePrice: referenceCase.property.purchasePrice,
        years,
        exit,
        irr,
        equityRequired: engineResult.acquisition.equityRequired,
        equityAvailable: referenceCase.property.ownMoney,
        minRequiredReturn: referenceCase.constraints.minRoiTarget,
        rentalStrategy: referenceCase.selections.rentalStrategy,
        renovationStrategy: referenceCase.selections.renovationStrategy,
        buildingShareOfValueProvided: true,
        renovationImprovementShareProvided: true,
      });
      const names = outcome.placeholdersUsed.map((p) => p.name);
      expect(names).not.toContain("DEFAULT_BUILDING_SHARE_OF_VALUE");
      expect(names).not.toContain("DEFAULT_RENOVATION_IMPROVEMENT_SHARE");
    });

    it("an explicit cadastralValue drops DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO (and, wired through, DEFAULT_BUILDING_SHARE_OF_VALUE) from the list (MODEL_SPEC.md §16)", () => {
      const scenarioResult = engineResult.scenarios.find((s) => s.id === "base")!;
      const cadastralValue = { suelo: 120000, construccion: 80000 };
      const years = buildProjectionYears({
        years: 1,
        scenario: "base",
        scenarioResult,
        purchasePrice: referenceCase.property.purchasePrice,
        financing: engineResult.selectedFinancing,
        fixedCosts: engineResult.fixedOperatingCosts,
        euResident: true,
        renovation: engineResult.selectedRenovation,
        cadastralValue,
      });
      const exit = computeExit({
        scenario: "base",
        years,
        purchasePrice: referenceCase.property.purchasePrice,
        acquisition: engineResult.acquisition,
        renovation: engineResult.selectedRenovation,
        assumptions: testAssumptions,
      });
      const irr = computeScenarioIrr({
        equityInvested: engineResult.acquisition.equityRequired,
        years,
        exit,
      });
      const outcome = buildScenarioOutcome({
        scenario: "base",
        purchasePrice: referenceCase.property.purchasePrice,
        years,
        exit,
        irr,
        equityRequired: engineResult.acquisition.equityRequired,
        equityAvailable: referenceCase.property.ownMoney,
        minRequiredReturn: referenceCase.constraints.minRoiTarget,
        rentalStrategy: referenceCase.selections.rentalStrategy,
        renovationStrategy: referenceCase.selections.renovationStrategy,
        cadastralValueProvided: true,
        buildingShareOfValueProvided: true,
      });
      const names = outcome.placeholdersUsed.map((p) => p.name);
      expect(names).not.toContain("DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO");
      expect(names).not.toContain("DEFAULT_BUILDING_SHARE_OF_VALUE");
    });
  });
});
