import { describe, expect, it } from "vitest";
import { runEngine } from "../engine";
import { DEFAULT_BUILDING_SHARE_OF_VALUE } from "../parameters";
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
      renovation: engineResult.selectedRenovation,
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

  it("year 1's occupancy-independent costs reproduce the phase-1 scenario outcome unchanged", () => {
    // Base year (rentIndex/costIndex = 1): maintenance, utilities and the
    // fixed costs run regardless of whether the property is let yet, so
    // they equal the phase-1 figures exactly.
    const years = projectionFor("base");
    const y1 = years[0]!;
    expect(y1.maintenance).toBeCloseTo(1422.036, 6);
    expect(y1.utilities).toBeCloseTo(2859.5, 6);
    expect(y1.propertyTaxIBI).toBeCloseTo(1320, 6);
    expect(y1.insurance).toBeCloseTo(1030, 6);
    expect(y1.bankAccountFee).toBeCloseTo(100, 6);
    expect(y1.communityFees).toBeCloseTo(900, 6);
  });

  it("year 1's rent is prorated for the renovation itself plus the lease-up (light: 3 + 2 months)", () => {
    // Fase C stap 2: 5 vacant months, not 2 - the work takes three
    // (RENOVATION_DURATION_MONTHS_BY_TIER.light) and finding a tenant two
    // (timeToRentMonths). 28440.72 (phase-1, full 12 months) x 7/12 =
    // 16590.42; it was 23700.60 when only the lease-up counted.
    const y1 = projectionFor("base")[0]!;
    expect(y1.grossIncome).toBeCloseTo(16590.42, 6);
    // Property management is 8% of that already-prorated rent, so it
    // scales down with it automatically: 16590.42 x 0.08 = 1327.2336.
    expect(y1.propertyManagement).toBeCloseTo(1327.2336, 6);
    expect(y1.noi).toBeCloseTo(7631.6504, 4);
  });

  it("does not prorate any other year: full rent from year 2 onwards", () => {
    const years = projectionFor("base");
    // Year 2 = phase-1 gross x rentIndex(year 2), no lease-up factor.
    expect(years[1]!.grossIncome).toBeCloseTo(28440.72 * 1.05, 6);
  });

  it("prorates by the renovation strategy's own timeToRentMonths (minimal: 1, heavy: 3)", () => {
    const scenarioResult = engineResult.scenarios.find((s) => s.id === "base")!;
    const common = {
      years: 1,
      scenario: "base" as const,
      scenarioResult,
      purchasePrice: referenceCase.property.purchasePrice,
      financing: engineResult.selectedFinancing,
      fixedCosts: engineResult.fixedOperatingCosts,
      euResident: true,
    };
    // durationMonths 0 isolates the lease-up half, which is what this test
    // is about; the two are additive since fase C stap 2 and the sum is
    // covered in its own describe block below.
    const minimal = buildProjectionYears({
      ...common,
      renovation: { timeToRentMonths: 1, durationMonths: 0 },
    });
    const heavy = buildProjectionYears({
      ...common,
      renovation: { timeToRentMonths: 3, durationMonths: 0 },
    });
    expect(minimal[0]!.grossIncome).toBeCloseTo(28440.72 * (11 / 12), 6);
    expect(heavy[0]!.grossIncome).toBeCloseTo(28440.72 * (9 / 12), 6);
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

  // Year 1 recomputed again for fase C stap 2, which added the
  // renovation's own duration to the vacancy that prorates it (light:
  // 3 months of work on top of 2 months' lease-up, so 7/12 of a year's
  // rent instead of 10/12). Only year 1 moves - years 2, 5 and 10 are
  // untouched, which is itself the check that the proration stayed
  // confined to the first year.
  //
  // Recomputed for MODEL_SPEC.md §15's gastos de comunidad (€ 900/yr
  // fixture, CPI-indexed like the other fixed cost lines): grossIncome,
  // interestPaid, principalPaid and mortgageBalance are unaffected (no
  // fixed-cost coupling); noi/preTaxCashflow drop by that year's indexed
  // community fee, and taxDue/cashflowAfterTax follow from the larger
  // deductible cost.
  const goldenByScenario: Record<
    ScenarioId,
    Record<1 | 2 | 5 | 10, Record<string, number>>
  > = {
    conservative: {
      1: {
        grossIncome: 13438.2402,
        noi: 4600.696908,
        interestPaid: 11383.852975,
        principalPaid: 11641.200437,
        mortgageBalance: 235858.799563,
        preTaxCashflow: -18424.356503,
        taxDue: 0,
        cashflowAfterTax: -18424.356503,
      },
      2: {
        grossIncome: 24188.8324,
        noi: 14320.467046,
        interestPaid: 10824.775084,
        principalPaid: 12200.278328,
        mortgageBalance: 223658.521236,
        preTaxCashflow: -8704.586366,
        taxDue: 37.266954,
        cashflowAfterTax: -8741.85332,
      },
      5: {
        grossIncome: 26817.9649,
        noi: 16245.436345,
        interestPaid: 8981.220523,
        principalPaid: 14043.832889,
        mortgageBalance: 183428.207879,
        preTaxCashflow: -6779.617067,
        taxDue: 791.306782,
        cashflowAfterTax: -7570.923848,
      },
      10: {
        grossIncome: 31089.3715,
        noi: 19298.03192,
        interestPaid: 5269.038107,
        principalPaid: 17756.015305,
        mortgageBalance: 102420.428129,
        preTaxCashflow: -3727.021492,
        taxDue: 2144.142618,
        cashflowAfterTax: -5871.16411,
      },
    },
    base: {
      1: {
        grossIncome: 16590.42,
        noi: 7631.6504,
        interestPaid: 10163.765235,
        principalPaid: 12103.819942,
        mortgageBalance: 235396.180058,
        preTaxCashflow: -14635.934777,
        taxDue: 0,
        cashflowAfterTax: -14635.934777,
      },
      2: {
        grossIncome: 29862.756,
        noi: 19674.305728,
        interestPaid: 9645.503785,
        principalPaid: 12622.081392,
        mortgageBalance: 222774.098666,
        preTaxCashflow: -2593.279449,
        taxDue: 1144.030079,
        cashflowAfterTax: -3737.309528,
      },
      5: {
        grossIncome: 33108.5987,
        noi: 22174.978964,
        interestPaid: 7953.732534,
        principalPaid: 14313.852643,
        mortgageBalance: 181571.585031,
        preTaxCashflow: -92.606213,
        taxDue: 1975.158436,
        cashflowAfterTax: -2067.764649,
      },
      10: {
        grossIncome: 38381.9401,
        noi: 26164.150699,
        interestPaid: 4615.372495,
        principalPaid: 17652.212682,
        mortgageBalance: 100266.961333,
        preTaxCashflow: 3896.565522,
        taxDue: 3428.77858,
        cashflowAfterTax: 467.786942,
      },
    },
    optimistic: {
      1: {
        grossIncome: 20074.4082,
        noi: 10767.300162,
        interestPaid: 9554.436089,
        principalPaid: 12339.952763,
        mortgageBalance: 235160.047237,
        preTaxCashflow: -11127.08869,
        taxDue: 0,
        cashflowAfterTax: -11127.08869,
      },
      2: {
        grossIncome: 36133.9348,
        noi: 25372.639179,
        interestPaid: 9058.08593,
        principalPaid: 12836.302922,
        mortgageBalance: 222323.744315,
        preTaxCashflow: 3478.250327,
        taxDue: 2257.891942,
        cashflowAfterTax: 1220.358385,
      },
      5: {
        grossIncome: 40061.4044,
        noi: 28495.980183,
        interestPaid: 7446.002776,
        principalPaid: 14448.386076,
        mortgageBalance: 180633.040069,
        preTaxCashflow: 6601.591331,
        taxDue: 3190.458241,
        cashflowAfterTax: 3411.13309,
      },
      10: {
        grossIncome: 46442.1475,
        noi: 33496.095046,
        interestPaid: 4296.86191,
        principalPaid: 17597.526942,
        mortgageBalance: 99191.89344,
        preTaxCashflow: 11601.706194,
        taxDue: 4797.136481,
        cashflowAfterTax: 6804.569712,
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

  it("defaults the depreciation base to DEFAULT_BUILDING_SHARE_OF_VALUE (0.70), not phase 1's fixed 80%", () => {
    // Base scenario: 330000 x 3% x 0.70 x factor 1.00 = 6930, every year
    // (depreciation is flat, tied to the acquisition cost, not indexed).
    expect(DEFAULT_BUILDING_SHARE_OF_VALUE.value).toBe(0.7);
    const years = projectionFor("base");
    expect(years[0]!.depreciation).toBeCloseTo(6930, 6);
    expect(years[9]!.depreciation).toBeCloseTo(6930, 6);
  });

  it("applies the scenario depreciation factor on top of the building share (conservative 0.94, optimistic 1.04)", () => {
    expect(projectionFor("conservative")[0]!.depreciation).toBeCloseTo(6514.2, 6);
    expect(projectionFor("optimistic")[0]!.depreciation).toBeCloseTo(7207.2, 6);
  });

  it("accepts an explicit buildingShareOfValue override, e.g. from a property's cadastral split", () => {
    const scenarioResult = engineResult.scenarios.find((s) => s.id === "base")!;
    const years = buildProjectionYears({
      years: 3,
      scenario: "base",
      scenarioResult,
      purchasePrice: referenceCase.property.purchasePrice,
      financing: engineResult.selectedFinancing,
      fixedCosts: engineResult.fixedOperatingCosts,
      euResident: true,
      renovation: engineResult.selectedRenovation,
      buildingShareOfValue: 0.85,
    });
    // 330000 x 3% x 0.85 x 1.00 = 8415, higher than the 0.70 default (6930).
    expect(years[0]!.depreciation).toBeCloseTo(8415, 6);
  });

  it("derives the depreciation base from cadastralValue.construccion when given, ignoring buildingShareOfValue (MODEL_SPEC.md §16)", () => {
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
      cadastralValue: { suelo: 120000, construccion: 80000 },
      buildingShareOfValue: 0.85, // must be ignored: cadastralValue takes priority
    });
    // 80000 (construcción only, excl. suelo) x 3% x 1.00 = 2400 - neither
    // the 0.70 default (6930) nor the 0.85 override (8415).
    expect(years[0]!.depreciation).toBeCloseTo(2400, 6);
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

  it("indexes gastos de comunidad with CPI, the same series as IBI/insurance/bank fee (MODEL_SPEC.md §15)", () => {
    // Base scenario: 900 x costIndex(year 2) = 900 x 1.022 = 919.8.
    const y2 = projectionFor("base")[1]!;
    expect(y2.communityFees).toBeCloseTo(919.8, 6);
    // Keeps compounding past 2030 rather than freezing (year 10: costIndex
    // 1.1986098441366696).
    const y10 = projectionFor("base")[9]!;
    expect(y10.communityFees).toBeCloseTo(900 * 1.1986098441366696, 4);
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

/**
 * Fase C stap 2: the renovation's own duration, added to the lease-up that
 * already prorated year 1. Two things worth pinning beyond the golden
 * values above - that the two periods really are additive, and that a
 * renovation long enough to fill the year cannot drive the rent negative.
 */
describe("year-1 vacancy: renovation duration plus lease-up (fase C stap 2)", () => {
  const engineResult = runEngine(referenceCase);
  const scenarioResult = engineResult.scenarios.find((s) => s.id === "base")!;
  const FULL_YEAR_RENT = 28440.72;

  function year1For(durationMonths: number, timeToRentMonths: number) {
    return buildProjectionYears({
      years: 1,
      scenario: "base",
      scenarioResult,
      purchasePrice: referenceCase.property.purchasePrice,
      financing: engineResult.selectedFinancing,
      fixedCosts: engineResult.fixedOperatingCosts,
      euResident: true,
      renovation: { durationMonths, timeToRentMonths },
    })[0]!;
  }

  it("adds the two periods rather than taking the larger", () => {
    // 3 + 2 = 5 vacant, 7 rented. Taking the larger (3) would give 9/12,
    // which is what a max() implementation would produce.
    expect(year1For(3, 2).grossIncome).toBeCloseTo(FULL_YEAR_RENT * (7 / 12), 6);
    expect(year1For(3, 2).grossIncome).not.toBeCloseTo(FULL_YEAR_RENT * (9 / 12), 6);
  });

  it("is symmetric in the two periods - only their sum matters", () => {
    expect(year1For(4, 1).grossIncome).toBeCloseTo(year1For(1, 4).grossIncome, 10);
  });

  it("a zero-duration renovation reproduces the pre-fase-C behaviour exactly", () => {
    expect(year1For(0, 2).grossIncome).toBeCloseTo(FULL_YEAR_RENT * (10 / 12), 6);
  });

  it("clamps at zero rather than going negative when the vacancy fills the year", () => {
    // 12 + 2 = 14 months of vacancy in a 12-month year. Without the clamp
    // this would be -2/12 of a year's rent - the projection crediting a
    // negative rent, which is worse than merely wrong.
    const y1 = year1For(12, 2);
    expect(y1.grossIncome).toBe(0);
    expect(y1.propertyManagement).toBe(0);
    // Every cost that runs regardless of occupancy still runs.
    expect(y1.maintenance).toBeGreaterThan(0);
    expect(y1.debtService).toBeGreaterThan(0);
  });

  it("exactly 12 months of vacancy is the boundary: zero rent, still not negative", () => {
    expect(year1For(12, 0).grossIncome).toBe(0);
    expect(year1For(11, 1).grossIncome).toBe(0);
    expect(year1For(11, 0).grossIncome).toBeCloseTo(FULL_YEAR_RENT * (1 / 12), 6);
  });

  it("never touches year 2, however long the renovation runs", () => {
    const years = buildProjectionYears({
      years: 2,
      scenario: "base",
      scenarioResult,
      purchasePrice: referenceCase.property.purchasePrice,
      financing: engineResult.selectedFinancing,
      fixedCosts: engineResult.fixedOperatingCosts,
      euResident: true,
      renovation: { durationMonths: 12, timeToRentMonths: 2 },
    });
    expect(years[0]!.grossIncome).toBe(0);
    // The spill past month 12 is precisely what the projection does not
    // model - year 2 is a full year regardless. The report discloses this
    // rather than the calculation absorbing it silently.
    expect(years[1]!.grossIncome).toBeCloseTo(FULL_YEAR_RENT * 1.05, 6);
  });
});
