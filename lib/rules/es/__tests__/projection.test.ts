import { describe, expect, it } from "vitest";
import { runEngine } from "../engine";
import { buildProjectionYears } from "../projection";
import type { ScenarioId } from "../types";
import { referenceCase } from "./referencecase";

/**
 * Golden values: independent recomputation in Python (MODEL_SPEC_FASE1B §8
 * - there is no Excel counterpart for phase 1b, so a second, separate
 * doorrekening is the defence against a silent error). Checked at years
 * 1, 2, 5 and 10 for all three scenarios of the reference case
 * Avenida Primado Reig 19.
 */
describe("multi-year cashflow after tax (reference case)", () => {
  const engineResult = runEngine(referenceCase);

  function projectionFor(scenario: ScenarioId) {
    const scenarioResult = engineResult.scenarios.find((s) => s.id === scenario)!;
    return buildProjectionYears({
      years: 10,
      scenario,
      scenarioResult,
      purchasePrice: referenceCase.property.purchasePrice,
      financing: engineResult.selectedFinancing,
      fixedCosts: engineResult.fixedOperatingCosts,
      euResident: true,
    });
  }

  it("returns 10 years starting in 2026, none extrapolated before 2031", () => {
    const years = projectionFor("base");
    expect(years).toHaveLength(10);
    expect(years[0]!.calendarYear).toBe(2026);
    expect(years[9]!.calendarYear).toBe(2035);
    expect(years.slice(0, 5).every((y) => !y.extrapolated)).toBe(true);
    expect(years.slice(5).every((y) => y.extrapolated)).toBe(true);
  });

  it("year 1 reproduces the phase-1 scenario outcome (base year, no growth yet)", () => {
    const years = projectionFor("base");
    const y1 = years[0]!;
    expect(y1.grossIncome).toBeCloseTo(28440.72, 6);
    expect(y1.propertyManagement).toBeCloseTo(2275.2576, 6);
    expect(y1.maintenance).toBeCloseTo(1422.036, 6);
    expect(y1.utilities).toBeCloseTo(2859.5, 6);
    expect(y1.propertyTaxIBI).toBeCloseTo(1320, 6);
    expect(y1.insurance).toBeCloseTo(1030, 6);
    expect(y1.bankAccountFee).toBeCloseTo(100, 6);
    expect(y1.noi).toBeCloseTo(19433.9264, 4);
  });

  it("year 1 uses actual amortization interest, not the flat interest-only figure", () => {
    // Phase 1's annualInterestOnly for base is 10395 (rate x principal);
    // the real first-year annuity interest is lower because principal is
    // already being repaid within the year.
    const y1 = projectionFor("base")[0]!;
    expect(y1.interestPaid).toBeCloseTo(10163.765235, 4);
    expect(y1.principalPaid).toBeCloseTo(12103.819942, 4);
    expect(y1.interestPaid).toBeLessThan(10395);
  });

  const goldenByScenario: Record<
    ScenarioId,
    Record<1 | 2 | 5 | 10, Record<string, number>>
  > = {
    conservative: {
      1: {
        grossIncome: 23036.9832,
        noi: 14331.5405,
        interestPaid: 11383.852975,
        principalPaid: 11641.200437,
        mortgageBalance: 235858.799563,
        preTaxCashflow: -8693.512943,
        taxDue: 0,
        cashflowAfterTax: -8693.512943,
      },
      2: {
        grossIncome: 24188.8324,
        noi: 15240.267,
        interestPaid: 10824.775084,
        principalPaid: 12200.278328,
        mortgageBalance: 223658.521236,
        preTaxCashflow: -7784.786366,
        taxDue: 35.214954,
        cashflowAfterTax: -7820.00132,
      },
      5: {
        grossIncome: 26817.9649,
        noi: 17222.4924,
        interestPaid: 8981.220523,
        principalPaid: 14043.832889,
        mortgageBalance: 183428.207879,
        preTaxCashflow: -5802.560989,
        taxDue: 800.133436,
        cashflowAfterTax: -6602.694425,
      },
      10: {
        grossIncome: 31089.3715,
        noi: 20376.7808,
        interestPaid: 5269.038107,
        principalPaid: 17756.015305,
        mortgageBalance: 102420.428129,
        preTaxCashflow: -2648.272632,
        taxDue: 2172.290901,
        cashflowAfterTax: -4820.563533,
      },
    },
    base: {
      1: {
        grossIncome: 28440.72,
        noi: 19433.9264,
        interestPaid: 10163.765235,
        principalPaid: 12103.819942,
        mortgageBalance: 235396.180058,
        preTaxCashflow: -2833.658777,
        taxDue: 799.835621,
        cashflowAfterTax: -3633.494398,
      },
      2: {
        grossIncome: 29862.756,
        noi: 20594.1057,
        interestPaid: 9645.503785,
        principalPaid: 12622.081392,
        mortgageBalance: 222774.098666,
        preTaxCashflow: -1673.479449,
        taxDue: 1130.692079,
        cashflowAfterTax: -2804.171528,
      },
      5: {
        grossIncome: 33108.5987,
        noi: 23152.035,
        interestPaid: 7953.732534,
        principalPaid: 14313.852643,
        mortgageBalance: 181571.585031,
        preTaxCashflow: 884.449865,
        taxDue: 1972.699091,
        cashflowAfterTax: -1088.249226,
      },
      10: {
        grossIncome: 38381.9401,
        noi: 27242.8996,
        interestPaid: 4615.372495,
        principalPaid: 17652.212682,
        mortgageBalance: 100266.961333,
        preTaxCashflow: 4975.314381,
        taxDue: 3445.640863,
        cashflowAfterTax: 1529.673518,
      },
    },
    optimistic: {
      1: {
        grossIncome: 34413.2712,
        noi: 24859.0541,
        interestPaid: 9554.436089,
        principalPaid: 12339.952763,
        mortgageBalance: 235160.047237,
        preTaxCashflow: 2964.66527,
        taxDue: 1859.025176,
        cashflowAfterTax: 1105.640094,
      },
      2: {
        grossIncome: 36133.9348,
        noi: 26292.4392,
        interestPaid: 9058.08593,
        principalPaid: 12836.302922,
        mortgageBalance: 222323.744315,
        preTaxCashflow: 4398.050327,
        taxDue: 2237.029942,
        cashflowAfterTax: 2161.020385,
      },
      5: {
        grossIncome: 40061.4044,
        noi: 29473.0363,
        interestPaid: 7446.002776,
        principalPaid: 14448.386076,
        mortgageBalance: 180633.040069,
        preTaxCashflow: 7578.647409,
        taxDue: 3180.474895,
        cashflowAfterTax: 4398.172514,
      },
      10: {
        grossIncome: 46442.1475,
        noi: 34574.8439,
        interestPaid: 4296.86191,
        principalPaid: 17597.526942,
        mortgageBalance: 99191.89344,
        preTaxCashflow: 12680.455053,
        taxDue: 4806.474764,
        cashflowAfterTax: 7873.980289,
      },
    },
  };

  (Object.keys(goldenByScenario) as ScenarioId[]).forEach((scenario) => {
    describe(scenario, () => {
      const years = projectionFor(scenario);
      const cases = goldenByScenario[scenario];
      (Object.keys(cases) as unknown as (1 | 2 | 5 | 10)[]).forEach((yearNumber) => {
        it(`year ${yearNumber} matches the independent doorrekening`, () => {
          const y = years[Number(yearNumber) - 1]!;
          const expected = cases[yearNumber]!;
          expect(y.grossIncome).toBeCloseTo(expected.grossIncome!, 3);
          expect(y.noi).toBeCloseTo(expected.noi!, 3);
          expect(y.interestPaid).toBeCloseTo(expected.interestPaid!, 3);
          expect(y.principalPaid).toBeCloseTo(expected.principalPaid!, 3);
          expect(y.mortgageBalance).toBeCloseTo(expected.mortgageBalance!, 2);
          expect(y.preTaxCashflow).toBeCloseTo(expected.preTaxCashflow!, 3);
          expect(y.taxDue).toBeCloseTo(expected.taxDue!, 3);
          expect(y.cashflowAfterTax).toBeCloseTo(expected.cashflowAfterTax!, 3);
        });
      });
    });
  });

  it("clamps tax at zero instead of reporting a refund on negative taxable income", () => {
    const y1 = projectionFor("conservative")[0]!;
    expect(y1.taxableIncome).toBeLessThan(0);
    expect(y1.taxDue).toBe(0);
  });

  it("indexes IBI with CPI, not with the property's market value growth", () => {
    // Base scenario: 1320 x costIndex(year 2) = 1320 x 1.022 = 1349.04.
    // A market-value-linked IBI (growth 1.05) would give 1386 instead - the
    // regression this test guards against.
    const y2 = projectionFor("base")[1]!;
    expect(y2.propertyTaxIBI).toBeCloseTo(1349.04, 2);
  });

  it("keeps indexing IBI with CPI past 2030, in years marked extrapolated in the output", () => {
    const years = projectionFor("base");
    // Year 6 (2031) is the first year beyond the Correction Factors series.
    const y6 = years[5]!;
    expect(y6.calendarYear).toBe(2031);
    expect(y6.extrapolated).toBe(true);
    expect(y6.propertyTaxIBI).toBeCloseTo(1461.6758931667202, 4);
    // It keeps compounding rather than freezing at the year-5 value.
    const y10 = years[9]!;
    expect(y10.extrapolated).toBe(true);
    expect(y10.propertyTaxIBI).toBeCloseTo(1582.1649942603826, 4);
    expect(y10.propertyTaxIBI).toBeGreaterThan(y6.propertyTaxIBI);
  });

  it("the mortgage is fully repaid within the 15-year term, well inside the 10-year window", () => {
    // Sanity check on the amortization wiring: with a 15y term the balance
    // must still be positive and strictly decreasing through year 10.
    const years = projectionFor("base");
    for (let i = 1; i < years.length; i++) {
      expect(years[i]!.mortgageBalance).toBeLessThan(years[i - 1]!.mortgageBalance);
    }
    expect(years[9]!.mortgageBalance).toBeGreaterThan(0);
  });
});
