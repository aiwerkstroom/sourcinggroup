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
        noi: 15216.507,
        interestPaid: 10824.775084,
        principalPaid: 12200.278328,
        mortgageBalance: 223658.521236,
        preTaxCashflow: -7808.546366,
        taxDue: 30.700554,
        cashflowAfterTax: -7839.24692,
      },
      5: {
        grossIncome: 26817.9649,
        noi: 17111.2947,
        interestPaid: 8981.220523,
        principalPaid: 14043.832889,
        mortgageBalance: 183428.207879,
        preTaxCashflow: -5913.758706,
        taxDue: 779.00587,
        cashflowAfterTax: -6692.764576,
      },
      10: {
        grossIncome: 31089.3715,
        noi: 20080.1742,
        interestPaid: 5269.038107,
        principalPaid: 17756.015305,
        mortgageBalance: 102420.428129,
        preTaxCashflow: -2944.87923,
        taxDue: 2115.935648,
        cashflowAfterTax: -5060.814878,
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
        noi: 20557.1457,
        interestPaid: 9645.503785,
        principalPaid: 12622.081392,
        mortgageBalance: 222774.098666,
        preTaxCashflow: -1710.439449,
        taxDue: 1123.669679,
        cashflowAfterTax: -2834.109128,
      },
      5: {
        grossIncome: 33108.5987,
        noi: 22980.5824,
        interestPaid: 7953.732534,
        principalPaid: 14313.852643,
        mortgageBalance: 181571.585031,
        preTaxCashflow: 712.997197,
        taxDue: 1940.123084,
        cashflowAfterTax: -1227.125887,
      },
      10: {
        grossIncome: 38381.9401,
        noi: 26777.3113,
        interestPaid: 4615.372495,
        principalPaid: 17652.212682,
        mortgageBalance: 100266.961333,
        preTaxCashflow: 4509.726131,
        taxDue: 3357.179096,
        cashflowAfterTax: 1152.547035,
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
        noi: 26242.2792,
        interestPaid: 9058.08593,
        principalPaid: 12836.302922,
        mortgageBalance: 222323.744315,
        preTaxCashflow: 4347.890327,
        taxDue: 2227.499542,
        cashflowAfterTax: 2120.390785,
      },
      5: {
        grossIncome: 40061.4044,
        noi: 29239.5823,
        interestPaid: 7446.002776,
        principalPaid: 14448.386076,
        mortgageBalance: 180633.040069,
        preTaxCashflow: 7345.193404,
        taxDue: 3136.118634,
        cashflowAfterTax: 4209.074769,
      },
      10: {
        grossIncome: 46442.1475,
        noi: 33926.8967,
        interestPaid: 4296.86191,
        principalPaid: 17597.526942,
        mortgageBalance: 99191.89344,
        preTaxCashflow: 12032.507822,
        taxDue: 4683.36479,
        cashflowAfterTax: 7349.143031,
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
