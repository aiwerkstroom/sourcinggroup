import { describe, expect, it } from "vitest";
import { computeExit } from "../exit";
import { runEngine } from "../engine";
import { computeScenarioIrr } from "../irr";
import { buildScenarioOutcome } from "../outcome";
import {
  TSG_SCORE_ANCHORS_CASHFLOW,
  TSG_SCORE_ANCHORS_DATA_CERTAINTY,
  TSG_SCORE_ANCHORS_DEBT_RESILIENCE,
  TSG_SCORE_ANCHORS_RETURN_VS_REQUIREMENT,
  TSG_SCORE_DIMENSION_WEIGHTS,
  TSG_SCORE_FEASIBILITY_LEVELS,
  TSG_SCORE_FEASIBILITY_MARGIN_THRESHOLD,
} from "../parameters";
import { buildProjectionYears } from "../projection";
import {
  cashflowScore,
  computeTsgScore,
  dataCertaintyScore,
  debtResilienceScore,
  feasibilityScore,
  piecewiseLinear,
  returnVsRequirementScore,
  roundScore,
  totalScore,
} from "../score";
import type { ExitAssumptions, ScoreAnchor } from "../types";
import { referenceCase } from "./referencecase";

/**
 * SCORE_SPEC.md §1-§3. Golden values from an independent re-derivation in
 * Python of the piecewise-linear curves and the weighted total, not from
 * running this module - the same method used for the phase-1b projection
 * and IRR tests.
 *
 * Every curve is tested at all of its own anchor points plus intermediate
 * values, and outside both ends to prove the clamping rule.
 */

describe("piecewiseLinear() (SCORE_SPEC.md §2)", () => {
  const curve: readonly ScoreAnchor[] = [
    { x: 0, score: 0 },
    { x: 10, score: 5 },
    { x: 20, score: 10 },
  ];

  it("returns each anchor's own score exactly at that anchor", () => {
    curve.forEach((a) => expect(piecewiseLinear(curve, a.x)).toBe(a.score));
  });

  it("interpolates linearly between anchors", () => {
    expect(piecewiseLinear(curve, 5)).toBeCloseTo(2.5, 12);
    expect(piecewiseLinear(curve, 15)).toBeCloseTo(7.5, 12);
  });

  it("clamps to the outermost anchors' scores, in both directions", () => {
    expect(piecewiseLinear(curve, -1_000_000)).toBe(0);
    expect(piecewiseLinear(curve, 1_000_000)).toBe(10);
  });

  it("clamps to the endpoint value, not to a fixed 0/10 - which is what lets a descending curve work", () => {
    // The data-certainty curve (§2.5) runs downward: its lowest anchor
    // scores 10 and its highest 0. A rule of "below the lowest anchor: 0"
    // taken literally would invert it.
    const descending: readonly ScoreAnchor[] = [
      { x: 0, score: 10 },
      { x: 20, score: 0 },
    ];
    expect(piecewiseLinear(descending, -5)).toBe(10);
    expect(piecewiseLinear(descending, 999)).toBe(0);
  });

  it("rejects a malformed curve rather than scoring with it", () => {
    expect(() => piecewiseLinear([{ x: 0, score: 0 }], 0)).toThrow(/at least two anchors/);
    expect(() =>
      piecewiseLinear(
        [
          { x: 10, score: 0 },
          { x: 0, score: 5 },
        ],
        5,
      ),
    ).toThrow(/strictly ascending/);
    // Equal x values are ambiguous, not merely unsorted.
    expect(() =>
      piecewiseLinear(
        [
          { x: 0, score: 0 },
          { x: 0, score: 5 },
        ],
        0,
      ),
    ).toThrow(/strictly ascending/);
  });

  it("rejects NaN - it has no legitimate reading on any curve", () => {
    expect(() => piecewiseLinear(curve, NaN)).toThrow(/NaN/);
  });

  it("accepts +-Infinity and clamps to the outermost anchors, rather than throwing - a legitimate domain value (e.g. DSCR with zero debt service), not garbage", () => {
    expect(piecewiseLinear(curve, Infinity)).toBe(10);
    expect(piecewiseLinear(curve, -Infinity)).toBe(0);
  });
});

describe("every published curve is well-formed", () => {
  const curves = {
    cashflow: TSG_SCORE_ANCHORS_CASHFLOW,
    debtResilience: TSG_SCORE_ANCHORS_DEBT_RESILIENCE,
    returnVsRequirement: TSG_SCORE_ANCHORS_RETURN_VS_REQUIREMENT,
    dataCertainty: TSG_SCORE_ANCHORS_DATA_CERTAINTY,
  };

  Object.entries(curves).forEach(([name, param]) => {
    it(`${name}: strictly ascending in x, every score within 0-10, monotone in score`, () => {
      const anchors = param.value;
      expect(anchors.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < anchors.length; i++) {
        expect(anchors[i]!.x).toBeGreaterThan(anchors[i - 1]!.x);
      }
      anchors.forEach((a) => {
        expect(a.score).toBeGreaterThanOrEqual(0);
        expect(a.score).toBeLessThanOrEqual(10);
      });
      // SCORE_SPEC.md §2: "elke dimensie is een monotone mapping".
      const ascending = anchors[anchors.length - 1]!.score > anchors[0]!.score;
      for (let i = 1; i < anchors.length; i++) {
        if (ascending) {
          expect(anchors[i]!.score).toBeGreaterThan(anchors[i - 1]!.score);
        } else {
          expect(anchors[i]!.score).toBeLessThan(anchors[i - 1]!.score);
        }
      }
    });
  });

  it("the curves and weights are ESTIMATE, so the score never discounts its own definition", () => {
    // If these were PLACEHOLDER they would land in placeholdersUsed and
    // the data-certainty dimension would score the scoring model itself.
    [
      TSG_SCORE_ANCHORS_CASHFLOW,
      TSG_SCORE_ANCHORS_DEBT_RESILIENCE,
      TSG_SCORE_ANCHORS_RETURN_VS_REQUIREMENT,
      TSG_SCORE_ANCHORS_DATA_CERTAINTY,
      TSG_SCORE_FEASIBILITY_LEVELS,
      TSG_SCORE_FEASIBILITY_MARGIN_THRESHOLD,
      TSG_SCORE_DIMENSION_WEIGHTS,
    ].forEach((p) => expect(p.provenance).toBe("ESTIMATE"));
  });
});

describe("cashflow dimension (SCORE_SPEC.md §2.1)", () => {
  const anchors: ReadonlyArray<[number, number]> = [
    [-500, 0],
    [-250, 2],
    [0, 4],
    [250, 6],
    [500, 7.5],
    [1000, 9],
    [1500, 10],
  ];

  it.each(anchors)("€ %s/month scores %s", (monthly, score) => {
    expect(cashflowScore(monthly)).toBe(score);
  });

  it.each([
    [-375, 1.0],
    [125, 5.0],
    [750, 8.3],
  ])("interpolates: € %s/month scores %s", (monthly, score) => {
    expect(cashflowScore(monthly)).toBe(score);
  });

  it("clamps below -500 and above +1500", () => {
    expect(cashflowScore(-5000)).toBe(0);
    expect(cashflowScore(50_000)).toBe(10);
  });

  it("break-even scores a 4, not a 5 - the spec's deliberate asymmetry", () => {
    expect(cashflowScore(0)).toBe(4);
    expect(cashflowScore(0)).toBeLessThan(5);
  });
});

describe("debt resilience dimension (SCORE_SPEC.md §2.2)", () => {
  const anchors: ReadonlyArray<[number, number]> = [
    [0.5, 0],
    [0.75, 2.5],
    [1.0, 5],
    [1.2, 7],
    [1.4, 8.5],
    [1.8, 10],
  ];

  it.each(anchors)("DSCR %s scores %s", (dscr, score) => {
    expect(debtResilienceScore(dscr)).toBe(score);
  });

  it.each([
    [0.875, 3.8],
    [1.3, 7.8],
    [1.6, 9.3],
  ])("interpolates: DSCR %s scores %s", (dscr, score) => {
    expect(debtResilienceScore(dscr)).toBe(score);
  });

  it("clamps below 0.50 and above 1.80", () => {
    expect(debtResilienceScore(0)).toBe(0);
    expect(debtResilienceScore(12)).toBe(10);
  });

  it("DSCR exactly 1.0 is the midpoint: neither good nor bad", () => {
    expect(debtResilienceScore(1.0)).toBe(5);
  });

  it("DSCR of +-Infinity (an all-cash purchase, zero debt service) scores cleanly, not a crash", () => {
    // NOI / 0 is +-Infinity in JS depending on NOI's sign, not NaN - a
    // real, meaningful value for "no debt to service at all", not an
    // error. Both signs must clamp to their respective outermost anchor
    // like any other out-of-range value, not be rejected as garbage.
    expect(debtResilienceScore(Infinity)).toBe(10);
    expect(debtResilienceScore(-Infinity)).toBe(0);
  });
});

describe("return dimension (SCORE_SPEC.md §2.3)", () => {
  // The curve is defined over percentage points; the function takes
  // fractions, so 0.06 IRR against a 0.04 hurdle is +2pp.
  const anchors: ReadonlyArray<[number, number]> = [
    [-4, 0],
    [-2, 2],
    [0, 5],
    [2, 7],
    [4, 8.5],
    [8, 10],
  ];

  it.each(anchors)("a surplus of %spp scores %s", (pp, score) => {
    expect(returnVsRequirementScore(0.04 + pp / 100, 0.04)).toBeCloseTo(score, 10);
  });

  it.each([
    [-3, 1.0],
    [1, 6.0],
    [6, 9.3],
  ])("interpolates: a surplus of %spp scores %s", (pp, score) => {
    expect(returnVsRequirementScore(0.04 + pp / 100, 0.04)).toBeCloseTo(score, 10);
  });

  it("clamps below -4pp and above +8pp", () => {
    expect(returnVsRequirementScore(-0.5, 0.04)).toBe(0);
    expect(returnVsRequirementScore(0.5, 0.04)).toBe(10);
  });

  it("scores the surplus over the hurdle, not the absolute IRR: the same property scores differently for two investors", () => {
    const irr = 0.06;
    // Requirement exactly met = 5, by definition.
    expect(returnVsRequirementScore(irr, 0.06)).toBe(5);
    // A less demanding investor sees the same 6% as a 2pp surplus.
    expect(returnVsRequirementScore(irr, 0.04)).toBe(7);
    // A more demanding one sees it as a 2pp shortfall.
    expect(returnVsRequirementScore(irr, 0.08)).toBe(2);
  });

  it("a negative IRR is scored, not rejected - it is a real answer", () => {
    expect(returnVsRequirementScore(-0.02, 0.04)).toBe(0);
  });
});

describe("data certainty dimension (SCORE_SPEC.md §2.5)", () => {
  const anchors: ReadonlyArray<[number, number]> = [
    [0, 10],
    [3, 8],
    [6, 6],
    [10, 4],
    [15, 2],
    [20, 0],
  ];

  it.each(anchors)("%s placeholders scores %s", (count, score) => {
    expect(dataCertaintyScore(count)).toBe(score);
  });

  it.each([
    [1, 9.3],
    [8, 5.0],
    [13, 2.8],
  ])("interpolates: %s placeholders scores %s", (count, score) => {
    expect(dataCertaintyScore(count)).toBe(score);
  });

  it("is inverted: more placeholders always means a lower score", () => {
    const scores = [0, 3, 6, 10, 15, 20, 30].map(dataCertaintyScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]!).toBeLessThanOrEqual(scores[i - 1]!);
    }
    expect(dataCertaintyScore(30)).toBe(0);
  });

  it("rejects a fractional or negative count", () => {
    expect(() => dataCertaintyScore(2.5)).toThrow(/whole count/);
    expect(() => dataCertaintyScore(-1)).toThrow(/whole count/);
  });
});

describe("feasibility dimension (SCORE_SPEC.md §2.4)", () => {
  const base = { equityRequired: 100_000, maxRenovationBudget: 60_000, renovationCost: 50_000 };

  it("both checks fail: 0", () => {
    expect(
      feasibilityScore({ ...base, equityAvailable: 90_000, renovationCost: 70_000 }),
    ).toBe(0);
  });

  it("only the equity check fails: 3", () => {
    expect(feasibilityScore({ ...base, equityAvailable: 90_000 })).toBe(3);
  });

  it("only the budget check fails: 3", () => {
    expect(
      feasibilityScore({ ...base, equityAvailable: 150_000, renovationCost: 70_000 }),
    ).toBe(3);
  });

  it("both pass with a margin below 10%: 7", () => {
    // Equity headroom 5.000, budget headroom 10.000; min = 5.000 over the
    // 100.000 equity requirement = 5%.
    expect(feasibilityScore({ ...base, equityAvailable: 105_000 })).toBe(7);
  });

  it("both pass with a margin at or above 10%: 10", () => {
    // Equity headroom 10.000, budget headroom 10.000; min/100.000 = 10%,
    // exactly on the threshold, which the spec's ">= 10%" includes.
    expect(feasibilityScore({ ...base, equityAvailable: 110_000 })).toBe(10);
    expect(feasibilityScore({ ...base, equityAvailable: 200_000 })).toBe(10);
  });

  it("the margin is the smaller of the two headrooms, not just the equity one", () => {
    // Ample equity (50% headroom) but only € 1.000 of renovation budget
    // left: the budget headroom governs, so this is narrow, not ample.
    expect(
      feasibilityScore({
        equityRequired: 100_000,
        equityAvailable: 150_000,
        maxRenovationBudget: 51_000,
        renovationCost: 50_000,
      }),
    ).toBe(7);
  });

  it("a check with a missing input is skipped, and the other one governs", () => {
    // No equityAvailable: only the budget check runs, and it passes with
    // 10.000/100.000 = 10% headroom.
    expect(
      feasibilityScore({
        equityRequired: 100_000,
        maxRenovationBudget: 60_000,
        renovationCost: 50_000,
      }),
    ).toBe(10);
    // No renovation budget figures: only the equity check runs, and fails.
    expect(feasibilityScore({ equityRequired: 100_000, equityAvailable: 90_000 })).toBe(3);
  });

  it("a skipped check never counts as a passed one: a single failing check gives 3, never 0", () => {
    expect(feasibilityScore({ equityRequired: 100_000, equityAvailable: 1 })).toBe(3);
  });

  it("throws when neither check can run rather than inventing a score", () => {
    expect(() => feasibilityScore({ equityRequired: 100_000 })).toThrow(/at least one/);
    // A budget check needs both halves; one alone is not enough.
    expect(() =>
      feasibilityScore({ equityRequired: 100_000, maxRenovationBudget: 60_000 }),
    ).toThrow(/at least one/);
  });

  it("exactly meeting a constraint is passing it, not failing it", () => {
    // Zero headroom on both: passes, but with a 0% margin.
    expect(
      feasibilityScore({
        equityRequired: 100_000,
        equityAvailable: 100_000,
        maxRenovationBudget: 50_000,
        renovationCost: 50_000,
      }),
    ).toBe(7);
  });
});

describe("weighted total (SCORE_SPEC.md §3)", () => {
  it("the weights sum to exactly 1.00", () => {
    const sum = Object.values(TSG_SCORE_DIMENSION_WEIGHTS.value).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 12);
  });

  it("reproduces the spec's own worked arithmetic in §4", () => {
    // Independent of whether §4's dimension scores follow from §2 (see the
    // discrepancy test below), the weighting step itself must reproduce
    // 0,20x3,1 + 0,15x3,7 + 0,30x6,8 + 0,20x3,0 + 0,15x3,6 = 4,355 -> 4,4.
    expect(
      totalScore({
        cashflow: 3.1,
        debtResilience: 3.7,
        returnVsRequirement: 6.8,
        feasibility: 3.0,
        dataCertainty: 3.6,
      }),
    ).toBe(4.4);
  });

  it("a perfect and a zero card score 10.0 and 0.0", () => {
    const all = (v: number) => ({
      cashflow: v,
      debtResilience: v,
      returnVsRequirement: v,
      feasibility: v,
      dataCertainty: v,
    });
    expect(totalScore(all(10))).toBe(10);
    expect(totalScore(all(0))).toBe(0);
  });

  it("weights the return dimension heaviest and debt resilience/data certainty lightest", () => {
    const w = TSG_SCORE_DIMENSION_WEIGHTS.value;
    expect(w.returnVsRequirement).toBeGreaterThan(w.cashflow);
    expect(w.cashflow).toBeGreaterThan(w.debtResilience);
    expect(w.feasibility).toBe(w.cashflow);
    expect(w.dataCertainty).toBe(w.debtResilience);
  });

  it("rounds to one decimal", () => {
    expect(roundScore(3.765)).toBe(3.8);
    expect(roundScore(3.7449)).toBe(3.7);
    expect(roundScore(10)).toBe(10);
  });
});

/**
 * SCORE_SPEC.md §4 states a reference-case table. Two of its five rows do
 * not follow from the §2 curves the same document defines, and the engine
 * has moved on from the inputs it quotes. Both facts are pinned here
 * rather than quietly accommodated: §2 is the normative definition (it is
 * the function), §4 is an illustration of it.
 */
describe("SCORE_SPEC.md §4 reference-case table, checked against §2", () => {
  it("three of the five rows reproduce exactly from the §2 curves", () => {
    expect(debtResilienceScore(0.87)).toBe(3.7);
    expect(returnVsRequirementScore(0.0584, 0.04)).toBeCloseTo(6.8, 10);
    // "EV tekort (197.990 vs 115.000)" - equity fails, budget passes.
    expect(
      feasibilityScore({
        equityRequired: 197_990,
        equityAvailable: 115_000,
        maxRenovationBudget: 60_000,
        renovationCost: 55_000,
      }),
    ).toBe(3);
  });

  it("the cashflow row does not: §2.1 puts -€ 236/month at 2.1, while §4 states 3.1", () => {
    // Between the -250 (2.0) and 0 (4.0) anchors: 2 + (14/250) x 2 = 2.112.
    expect(cashflowScore(-236)).toBe(2.1);
    expect(cashflowScore(-236)).not.toBe(3.1);
  });

  it("the data-certainty row does not: §2.5 puts 12 placeholders at 3.2, while §4 states 3.6", () => {
    // Between the 10 (4.0) and 15 (2.0) anchors: 4 - (2/5) x 2 = 3.2.
    expect(dataCertaintyScore(12)).toBe(3.2);
    expect(dataCertaintyScore(12)).not.toBe(3.6);
  });

  it("recomputing §4 from its own stated inputs via §2 gives 4.1, not the 4.4 it prints", () => {
    const dimensions = {
      cashflow: cashflowScore(-236),
      debtResilience: debtResilienceScore(0.87),
      returnVsRequirement: returnVsRequirementScore(0.0584, 0.04),
      feasibility: 3.0,
      dataCertainty: dataCertaintyScore(12),
    };
    expect(dimensions).toEqual({
      cashflow: 2.1,
      debtResilience: 3.7,
      returnVsRequirement: 6.8,
      feasibility: 3.0,
      dataCertainty: 3.2,
    });
    // 0.20x2.1 + 0.15x3.7 + 0.30x6.8 + 0.20x3.0 + 0.15x3.2 = 4.095 -> 4.1.
    expect(totalScore(dimensions)).toBe(4.1);
  });
});

/**
 * The reference case scored against what the engine actually produces
 * today - which is not what SCORE_SPEC.md §4 quotes, because the spec was
 * written before MODEL_SPEC.md §15 added gastos de comunidad as a
 * mandatory cost. Every figure below is read from the engine, never
 * hardcoded, so this test tracks the engine instead of freezing a snapshot
 * of it; only the expected scores are golden.
 */
describe("reference case Avenida Primado Reig 19, scored on live engine output", () => {
  const testAssumptions: ExitAssumptions = {
    sellingCommissionRate: 0.04,
    municipalCapitalGainsTax: 3500,
  };
  const engineResult = runEngine(referenceCase);
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
    minRequiredReturn: referenceCase.constraints.minRoiTarget,
    rentalStrategy: referenceCase.selections.rentalStrategy,
    renovationStrategy: referenceCase.selections.renovationStrategy,
    usableAreaM2Provided: true,
  });

  const score = computeTsgScore({
    monthlyCashflow: scenarioResult.monthlyCashflow,
    dscr: scenarioResult.dscr,
    irr: irr.defined ? irr.irr : NaN,
    minRequiredReturn: outcome.returnRequirement.minRequiredReturn,
    placeholderCount: outcome.placeholdersUsed.length,
    feasibility: {
      equityRequired: engineResult.acquisition.equityRequired,
      equityAvailable: referenceCase.property.ownMoney,
      maxRenovationBudget: referenceCase.constraints.maxRenovationBudget,
      renovationCost: engineResult.selectedRenovation.capex,
    },
  });

  it("the engine inputs the score reads are the ones documented below", () => {
    // Pinning these makes the score expectations readable: if one of them
    // moves, the failure names which input moved, not just "score wrong".
    expect(scenarioResult.monthlyCashflow).toBeCloseTo(-311.138231, 5);
    expect(scenarioResult.dscr).toBeCloseTo(0.832327630175, 10);
    expect(irr.defined && irr.irr).toBeCloseTo(0.055436784474, 10);
    expect(outcome.returnRequirement.minRequiredReturn).toBe(0.04);
    expect(outcome.placeholdersUsed).toHaveLength(13);
    expect(engineResult.acquisition.equityRequired).toBeCloseTo(197_990, 6);
    expect(referenceCase.property.ownMoney).toBe(115_000);
    expect(engineResult.selectedRenovation.capex).toBe(55_000);
    expect(referenceCase.constraints.maxRenovationBudget).toBe(60_000);
  });

  it("scores 1.5 / 3.3 / 6.5 / 3.0 / 2.8 with a 3.8 total", () => {
    expect(score.dimensions).toEqual({
      cashflow: 1.5, // -311.14/month, between the -500 and -250 anchors
      debtResilience: 3.3, // DSCR 0.832, between 0.75 and 1.00
      returnVsRequirement: 6.5, // IRR 5.544% - 4% = +1.544pp, between 0 and +2
      feasibility: 3.0, // equity short (197.990 vs 115.000), budget fine
      dataCertainty: 2.8, // 13 placeholders, between the 10 and 15 anchors
    });
    // 0.20x1.5 + 0.15x3.3 + 0.30x6.5 + 0.20x3.0 + 0.15x2.8 = 3.765 -> 3.8.
    expect(score.total).toBe(3.8);
  });

  it("is lower than the 4.4 SCORE_SPEC.md §4 states, and the reason is traceable", () => {
    expect(score.total).toBeLessThan(4.4);
    // Two independent causes, both real: §4's own table mis-scores two
    // rows against §2 (see the previous describe block), and the engine's
    // numbers have since moved because MODEL_SPEC.md §15 added a mandatory
    // gastos de comunidad that lowers cashflow, DSCR and IRR alike.
    expect(cashflowScore(-236)).toBeGreaterThan(score.dimensions.cashflow);
    expect(dataCertaintyScore(12)).toBeGreaterThan(score.dimensions.dataCertainty);
  });

  it("the placeholder count comes from this outcome's own list, not a global tally", () => {
    // The data-certainty dimension must move with the specific outcome:
    // supplying a real usable area removes one placeholder from the list
    // this scenario rests on, but the reference case already supplies it,
    // so omitting it must ADD one and lower the score.
    const withDerivedArea = buildScenarioOutcome({
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
      // usableAreaM2Provided omitted: the area is now derived from the
      // built area via a PLACEHOLDER ratio (MODEL_SPEC.md §17).
    });
    expect(withDerivedArea.placeholdersUsed).toHaveLength(14);
    expect(dataCertaintyScore(withDerivedArea.placeholdersUsed.length)).toBeLessThan(
      score.dimensions.dataCertainty,
    );
  });
});

describe("computeTsgScore() determinism (SCORE_SPEC.md §6)", () => {
  const input = {
    monthlyCashflow: -311.1382314080802,
    dscr: 0.8323276301747033,
    irr: 0.055436784474295564,
    minRequiredReturn: 0.04,
    placeholderCount: 13,
    feasibility: {
      equityRequired: 197_990,
      equityAvailable: 115_000,
      maxRenovationBudget: 60_000,
      renovationCost: 55_000,
    },
  };

  it("the same input gives the same score, every time", () => {
    const first = computeTsgScore(input);
    for (let i = 0; i < 50; i++) {
      expect(computeTsgScore(input)).toEqual(first);
    }
  });

  it("every dimension and the total stay within 0.0-10.0", () => {
    const score = computeTsgScore(input);
    Object.values(score.dimensions).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(10);
    });
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(10);
  });

  it("refuses to score an undefined IRR rather than treating it as the worst case", () => {
    // A cashflow series with no sign change has no IRR; that is not the
    // same as a terrible return, and must not be scored as one.
    expect(() => computeTsgScore({ ...input, irr: NaN })).toThrow(/NaN/);
  });
});
