import { describe, expect, it } from "vitest";
import { loadReferenceDistribution } from "../distribution/load";
import { computeExit } from "../exit";
import { runEngine } from "../engine";
import { computeScenarioIrr } from "../irr";
import { buildScenarioOutcome } from "../outcome";
import { computePercentile } from "../percentile";
import { buildProjectionYears } from "../projection";
import { dataCertaintyScore } from "../score";
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
      usableAreaM2Provided: true,
      // SCORE_SPEC.md §2.1/§2.2/§2.4 inputs - read live from the engine,
      // never hardcoded, so the score tracks the engine rather than
      // freezing a snapshot of it.
      scenarioCashflow: {
        monthlyCashflow: scenarioResult.monthlyCashflow,
        dscr: scenarioResult.dscr,
      },
      maxRenovationBudget: referenceCase.constraints.maxRenovationBudget,
      renovationCost: engineResult.selectedRenovation.capex,
    });
  }

  it("year series: cumulative cashflow, property value and equity built (base scenario)", () => {
    const outcome = outcomeFor("base");
    expect(outcome.years).toHaveLength(10);

    const y1 = outcome.years[0]!;
    expect(y1.cashflowAfterTax).toBeCloseTo(-14635.934777, 4);
    expect(y1.cumulativeCashflow).toBeCloseTo(-14635.934777, 4);
    // 330000 x 1.05^1 = 346500.
    expect(y1.propertyValue).toBeCloseTo(346500, 4);
    expect(y1.mortgageBalance).toBeCloseTo(235396.180058, 4);
    expect(y1.equityBuilt).toBeCloseTo(346500 - 235396.180058, 4);

    const y10 = outcome.years[9]!;
    // Cumulative operating cashflow after 10 years: -28947.907735 (never
    // recoups the 193040 equity - see the payback test below).
    expect(y10.cumulativeCashflow).toBeCloseTo(-28947.907735, 3);
    // 330000 x 1.05^10.
    expect(y10.propertyValue).toBeCloseTo(330000 * 1.05 ** 10, 4);
  });

  const goldenTotals: Record<
    ScenarioId,
    { totalReturn: number; paybackYear: null }
  > = {
    conservative: { totalReturn: 0.287614, paybackYear: null },
    base: { totalReturn: 0.776156, paybackYear: null },
    optimistic: { totalReturn: 1.275728, paybackYear: null },
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
    // (32416.65) is far short of the 193040 equity invested - the return
    // comes from the exit, not from carrying the property.
    (["conservative", "base", "optimistic"] as ScenarioId[]).forEach((scenario) => {
      expect(outcomeFor(scenario).paybackYear).toBeNull();
    });
  });

  it("equity fit check: the reference case needs more equity than the investor has available", () => {
    // equityRequired 193040 - the workbook's 197990 less the AJD
    // double count (MODEL_SPEC.md §22) - vs.
    // Property Input ownMoney 115000 (§11: "eigen geld"). This check did
    // not exist before this correction.
    const outcome = outcomeFor("base");
    expect(outcome.equityFit.equityRequired).toBeCloseTo(193040, 6);
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
      usableAreaM2Provided: true,
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
      usableAreaM2Provided: true,
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
      usableAreaM2Provided: true,
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
      usableAreaM2Provided: true,
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
      // referenceCase.property.usableAreaM2 is set (usableAreaM2Provided:
      // true in outcomeFor()), so the area-ratio placeholder does not
      // apply - see the dedicated test below for the opposite case.
      expect(names).not.toContain("DEFAULT_USABLE_TO_BUILT_AREA_RATIO");
    });

    it("DEFAULT_USABLE_TO_BUILT_AREA_RATIO joins placeholdersUsed only when usableAreaM2Provided is false (MODEL_SPEC.md §17)", () => {
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
        rentalStrategy: referenceCase.selections.rentalStrategy,
        renovationStrategy: referenceCase.selections.renovationStrategy,
        // usableAreaM2Provided omitted deliberately (defaults to false).
      });
      expect(outcome.placeholdersUsed.map((p) => p.name)).toContain(
        "DEFAULT_USABLE_TO_BUILT_AREA_RATIO",
      );
    });

    it("BASE_OCCUPANCY_LONG_TERM/SHORT_TERM drop out of placeholdersUsed when the customer supplies their own occupancy (datakwaliteitsfix stap 3)", () => {
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
        rentalStrategy: referenceCase.selections.rentalStrategy,
        renovationStrategy: referenceCase.selections.renovationStrategy,
        occupancyLongTermProvided: true,
        occupancyShortTermProvided: true,
      });
      const names = outcome.placeholdersUsed.map((p) => p.name);
      expect(names).not.toContain("BASE_OCCUPANCY_LONG_TERM");
      expect(names).not.toContain("BASE_OCCUPANCY_SHORT_TERM");
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
      usableAreaM2Provided: true,
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
      usableAreaM2Provided: true,
        cadastralValueProvided: true,
        buildingShareOfValueProvided: true,
      });
      const names = outcome.placeholdersUsed.map((p) => p.name);
      expect(names).not.toContain("DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO");
      expect(names).not.toContain("DEFAULT_BUILDING_SHARE_OF_VALUE");
    });
  });

  /**
   * SCORE_SPEC.md §1-§6: the score and percentile now ride along per
   * scenario, exactly as placeholdersUsed already does.
   *
   * Golden values from an independent re-derivation in Python of the §2
   * curves, the §3 weighting and the §5 percentile lookup - run against
   * the committed reference-distribution.json, not against this module's
   * own output. Every engine input the score reads is taken live from
   * runEngine(referenceCase) in outcomeFor() above, so these tests track
   * the engine rather than freezing a snapshot of it; only the expected
   * scores are golden.
   */
  describe("TSG score and percentile per scenario (SCORE_SPEC.md §1-§6)", () => {
    const goldenScores: Record<
      ScenarioId,
      { dimensions: Record<string, number>; total: number; percentile: number }
    > = {
      conservative: {
        dimensions: {
          cashflow: 0.0, // -799.46/month, at or below the -500 anchor
          debtResilience: 0.8, // DSCR 0.583, just above the 0.50 floor
          returnVsRequirement: 2.2, // IRR 2.132% - 4% = -1.868pp
          feasibility: 3.0, // equity short (197.990 vs 115.000), budget fine
          dataCertainty: 2.4, // 14 placeholders
        },
        total: 1.7,
        percentile: 22,
      },
      base: {
        dimensions: {
          cashflow: 1.5, // -311.14/month
          debtResilience: 3.3, // DSCR 0.832
          returnVsRequirement: 6.5, // IRR 5.454% - 4% = +1.454pp
          feasibility: 3.0,
          dataCertainty: 2.4,
        },
        total: 3.7,
        percentile: 70,
      },
      optimistic: {
        dimensions: {
          cashflow: 5.4, // +172.06/month
          debtResilience: 5.9, // DSCR 1.094
          returnVsRequirement: 8.7, // IRR 8.532% - 4% = +4.532pp
          feasibility: 3.0,
          dataCertainty: 2.4,
        },
        total: 5.5,
        percentile: 94,
      },
    };

    (Object.keys(goldenScores) as ScenarioId[]).forEach((scenario) => {
      it(`${scenario}: five dimensions, weighted total and percentile match the independent doorrekening`, () => {
        const outcome = outcomeFor(scenario);
        const expected = goldenScores[scenario];
        expect(outcome.score).not.toBeNull();
        expect(outcome.score!.dimensions).toEqual(expected.dimensions);
        expect(outcome.score!.total).toBe(expected.total);
        expect(outcome.percentile).toBe(expected.percentile);
      });
    });

    it("the score rises with the scenario: conservative < base < optimistic, on total and percentile alike", () => {
      const c = outcomeFor("conservative");
      const b = outcomeFor("base");
      const o = outcomeFor("optimistic");
      expect(c.score!.total).toBeLessThan(b.score!.total);
      expect(b.score!.total).toBeLessThan(o.score!.total);
      expect(c.percentile!).toBeLessThan(b.percentile!);
      expect(b.percentile!).toBeLessThan(o.percentile!);
    });

    it("the two dimensions that do not depend on the scenario are identical across all three", () => {
      const c = outcomeFor("conservative");
      const b = outcomeFor("base");
      const o = outcomeFor("optimistic");
      // Feasibility reads equity/budget, not the scenario; data certainty
      // counts placeholders, and all three scenarios rest on 13 (each on
      // its own DEPRECIATION_SCENARIO_FACTORS entry, so the count matches
      // even though the specific parameter differs).
      expect(c.score!.dimensions.feasibility).toBe(b.score!.dimensions.feasibility);
      expect(b.score!.dimensions.feasibility).toBe(o.score!.dimensions.feasibility);
      expect(c.score!.dimensions.dataCertainty).toBe(b.score!.dimensions.dataCertainty);
      expect(b.score!.dimensions.dataCertainty).toBe(o.score!.dimensions.dataCertainty);
    });

    it("the data-certainty dimension is driven by this outcome's own placeholdersUsed, not a global tally", () => {
      const outcome = outcomeFor("base");
      expect(outcome.placeholdersUsed).toHaveLength(14);
      // Same count the dimension was scored from - the score reads the
      // list this outcome built, not a second, independent count.
      expect(outcome.score!.dimensions.dataCertainty).toBe(dataCertaintyScore(14));
    });

    it("the percentile is resolved against the committed distribution, not a freshly generated one", () => {
      const outcome = outcomeFor("base");
      const distribution = loadReferenceDistribution();
      expect(outcome.percentile).toBe(computePercentile(distribution, outcome.score!.total));
      // The committed file is the 1.000-case set SCORE_SPEC.md §5 defines.
      expect(distribution.size).toBe(1000);
    });

    it("renders the §5 presentation sentence for the reference case", () => {
      const outcome = outcomeFor("base");
      expect(
        `Deze investering scoort in het ${outcome.percentile}ste percentiel van ons modelbereik.`,
      ).toBe("Deze investering scoort in het 70ste percentiel van ons modelbereik.");
    });

    it("a different investor scores the same property differently: the hurdle rate moves the return dimension", () => {
      // SCORE_SPEC.md §2.3's stated intent ("twee beleggers met
      // verschillende eisen krijgen een verschillende score op hetzelfde
      // pand, en dat is correct") - verified end to end through
      // buildScenarioOutcome, not just on the curve in isolation.
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
      const demanding = buildScenarioOutcome({
        scenario: "base",
        purchasePrice: referenceCase.property.purchasePrice,
        years,
        exit,
        irr,
        equityRequired: engineResult.acquisition.equityRequired,
        equityAvailable: referenceCase.property.ownMoney,
        minRequiredReturn: 0.08, // twice the reference case's 4%
        rentalStrategy: referenceCase.selections.rentalStrategy,
        renovationStrategy: referenceCase.selections.renovationStrategy,
        usableAreaM2Provided: true,
        scenarioCashflow: {
          monthlyCashflow: scenarioResult.monthlyCashflow,
          dscr: scenarioResult.dscr,
        },
        maxRenovationBudget: referenceCase.constraints.maxRenovationBudget,
        renovationCost: engineResult.selectedRenovation.capex,
      });
      // IRR 5.454% against an 8% hurdle is a -2.546pp shortfall: 1.5, not
      // the 6.5 the reference case's 4% hurdle produced. Total 2.2.
      expect(demanding.score!.dimensions.returnVsRequirement).toBe(1.5);
      expect(demanding.score!.total).toBe(2.2);
      // Every other dimension is untouched - the hurdle only enters §2.3.
      const reference = outcomeFor("base");
      expect(demanding.score!.dimensions.cashflow).toBe(
        reference.score!.dimensions.cashflow,
      );
      expect(demanding.score!.dimensions.debtResilience).toBe(
        reference.score!.dimensions.debtResilience,
      );
      expect(demanding.score!.dimensions.feasibility).toBe(
        reference.score!.dimensions.feasibility,
      );
    });

    it("score and percentile are null - not zero - when the IRR is undefined", () => {
      // SCORE_SPEC.md §2.3 has nothing to score against without a defined
      // IRR. An absent answer must not be reported as a bad one; the
      // reason lives on outcome.irr, not duplicated onto the score.
      const outcome = buildScenarioOutcome({
        scenario: "base",
        purchasePrice: referenceCase.property.purchasePrice,
        years: buildProjectionYears({
          years: 10,
          scenario: "base",
          scenarioResult: engineResult.scenarios.find((s) => s.id === "base")!,
          purchasePrice: referenceCase.property.purchasePrice,
          financing: engineResult.selectedFinancing,
          fixedCosts: engineResult.fixedOperatingCosts,
          euResident: true,
          renovation: engineResult.selectedRenovation,
        }),
        exit: outcomeFor("base").exit,
        irr: { defined: false, reason: "synthetic: no sign change" },
        equityRequired: engineResult.acquisition.equityRequired,
        equityAvailable: referenceCase.property.ownMoney,
        minRequiredReturn: referenceCase.constraints.minRoiTarget,
        rentalStrategy: referenceCase.selections.rentalStrategy,
        renovationStrategy: referenceCase.selections.renovationStrategy,
        usableAreaM2Provided: true,
        scenarioCashflow: { monthlyCashflow: -311, dscr: 0.83 },
        maxRenovationBudget: referenceCase.constraints.maxRenovationBudget,
        renovationCost: engineResult.selectedRenovation.capex,
      });
      expect(outcome.score).toBeNull();
      expect(outcome.percentile).toBeNull();
      expect(outcome.irr.defined).toBe(false);
    });

    it("score and percentile are null when the caller does not supply the scenario's cashflow/DSCR", () => {
      // Scoring is opt-in: a caller that has no ScenarioResult to hand
      // gets no score rather than one built on invented cashflow figures.
      // (This is what every pre-existing call site in this file does.)
      const outcome = buildScenarioOutcome({
        scenario: "base",
        purchasePrice: referenceCase.property.purchasePrice,
        years: buildProjectionYears({
          years: 10,
          scenario: "base",
          scenarioResult: engineResult.scenarios.find((s) => s.id === "base")!,
          purchasePrice: referenceCase.property.purchasePrice,
          financing: engineResult.selectedFinancing,
          fixedCosts: engineResult.fixedOperatingCosts,
          euResident: true,
          renovation: engineResult.selectedRenovation,
        }),
        exit: outcomeFor("base").exit,
        irr: outcomeFor("base").irr,
        equityRequired: engineResult.acquisition.equityRequired,
        equityAvailable: referenceCase.property.ownMoney,
        minRequiredReturn: referenceCase.constraints.minRoiTarget,
        rentalStrategy: referenceCase.selections.rentalStrategy,
        renovationStrategy: referenceCase.selections.renovationStrategy,
        usableAreaM2Provided: true,
        // scenarioCashflow omitted deliberately.
      });
      expect(outcome.score).toBeNull();
      expect(outcome.percentile).toBeNull();
      // Everything else is still computed as before - scoring is additive.
      expect(outcome.placeholdersUsed.length).toBeGreaterThan(0);
      expect(outcome.totalReturn).toBeCloseTo(0.776156, 4);
    });

    it("omitting the hurdle rate lowers data certainty but raises the return score, and both land in the total", () => {
      // Two effects at once, in opposite directions:
      // DEFAULT_MIN_REQUIRED_RETURN joins placeholdersUsed (14 -> 15, so
      // dataCertainty 2.4 -> 2.0), while the 0% fallback hurdle turns the
      // 5.239% IRR into a +5.239pp surplus (returnVsRequirement 6.2 ->
      // 9.0). Net: total 3.6 -> 4.4, percentile 68 -> 82.
      // That the total still rises here is a coincidence of this
      // property's own numbers (the return swing outweighs the
      // data-certainty drop for THIS deal) - the two dimensions move in
      // opposite directions on principle, but nothing guarantees which one
      // wins, and a different case could easily net the other way.
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
        // minRequiredReturn omitted deliberately.
        rentalStrategy: referenceCase.selections.rentalStrategy,
        renovationStrategy: referenceCase.selections.renovationStrategy,
        usableAreaM2Provided: true,
        scenarioCashflow: {
          monthlyCashflow: scenarioResult.monthlyCashflow,
          dscr: scenarioResult.dscr,
        },
        maxRenovationBudget: referenceCase.constraints.maxRenovationBudget,
        renovationCost: engineResult.selectedRenovation.capex,
      });
      expect(outcome.placeholdersUsed).toHaveLength(15);
      expect(outcome.score!.dimensions.dataCertainty).toBe(2.0);
      expect(outcome.score!.dimensions.returnVsRequirement).toBe(9.0);
      expect(outcome.score!.total).toBe(4.4);
      expect(outcome.percentile).toBe(82);
    });
  });
});
