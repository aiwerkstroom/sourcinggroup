import { describe, expect, it } from "vitest";
import {
  EXAMPLE_DEFAULTS,
  EXAMPLE_FIXED_DATA_CERTAINTY,
  EXAMPLE_FIXED_FEASIBILITY,
  EXAMPLE_MONTHLY_DEBT_RATE,
  EXAMPLE_PRICE_RANGE,
  EXAMPLE_RENT_RANGE,
  EXAMPLE_REQUIRED_YIELD_PERCENT,
  EXAMPLE_WIJK_TYPES,
  computeExampleOutcome,
  findWijkType,
} from "../example-calculator-formula";

/**
 * Golden test for the fictional demonstration formula
 * (HOMEPAGE_UPGRADE_SPEC.md §4.2), pinning the anchor points Samuel
 * approved on 18 August 2026.
 *
 * The table below is the one from the design proposal, so a future change
 * to any constant - the debt rate, a cost fraction, an anchor - moves a
 * number here and fails the build. That is the point: the proposal was
 * approved on these figures, and the code should not be able to drift
 * away from what was agreed without saying so.
 *
 * Five cells differ from the proposal as written, all for arithmetic
 * reasons rather than because the formula changed - it is exactly as
 * approved. Two distinct causes, both worth naming so nobody later
 * "corrects" these back:
 *
 *  - Rounding ORDER. The 600.000/2.500 row's cashflow dimension is 4,4
 *    here where the proposal printed 4,3. The proposal averaged
 *    unrounded dimension scores; the implementation rounds each dimension
 *    first, because those rounded numbers are what the rulers display and
 *    the five figures on screen have to add up to the total on screen.
 *  - Rounding DIRECTION at exact halves. Four values land precisely on a
 *    half: cashflow EUR 52,50 and EUR 262,50, and dimension scores 4,05
 *    and 4,85. The proposal's table was computed in Python, whose round()
 *    is half-to-even, so it printed 52, 262, 4,0 and 6,8. JavaScript's
 *    Math.round is half-up and gives 53, 263, 4,1 and 6,9. The shipped
 *    values are the JavaScript ones; the underlying figures are
 *    identical.
 *
 * Every other cell matches the approved table exactly.
 *
 * The collision checks against the REAL curve live in
 * app/__tests__/page.test.tsx, next to the bundle sweep, since they are
 * the same kind of guarantee.
 */

interface Row {
  price: number;
  rent: number;
  cashflow: number;
  yieldPercent: number;
  dscr: number;
  dimensions: number[];
  total: number;
}

const APPROVED: Row[] = [
  { price: 150_000, rent: 700, cashflow: 53, yieldPercent: 5.6, dscr: 1.48, dimensions: [5.0, 8.6, 6.3, 8.0, 6.5], total: 6.9 },
  { price: 180_000, rent: 1_100, cashflow: 258, yieldPercent: 7.3, dscr: 1.94, dimensions: [6.6, 9.5, 8.3, 8.0, 6.5], total: 7.8 },
  { price: 250_000, rent: 1_400, cashflow: 263, yieldPercent: 6.7, dscr: 1.78, dimensions: [6.6, 9.5, 7.7, 8.0, 6.5], total: 7.7 },
  { price: 300_000, rent: 1_200, cashflow: -45, yieldPercent: 4.8, dscr: 1.27, dimensions: [4.1, 7.4, 5.1, 8.0, 6.5], total: 6.2 },
  { price: 300_000, rent: 1_800, cashflow: 405, yieldPercent: 7.2, dscr: 1.90, dimensions: [7.5, 9.5, 8.2, 8.0, 6.5], total: 7.9 },
  { price: 450_000, rent: 1_500, cashflow: -292, yieldPercent: 4.0, dscr: 1.06, dimensions: [1.9, 5.5, 3.5, 8.0, 6.5], total: 5.1 },
  { price: 600_000, rent: 2_500, cashflow: -15, yieldPercent: 5.0, dscr: 1.32, dimensions: [4.4, 7.8, 5.5, 8.0, 6.5], total: 6.4 },
  { price: 600_000, rent: 1_200, cashflow: -990, yieldPercent: 2.4, dscr: 0.63, dimensions: [1.0, 1.3, 1.0, 8.0, 6.5], total: 3.6 },
];

describe("the approved anchor points (HOMEPAGE_UPGRADE_SPEC.md §4, design table)", () => {
  it.each(APPROVED)(
    "prijs $price / huur $rent -> totaal $total",
    ({ price, rent, cashflow, yieldPercent, dscr, dimensions, total }) => {
      const outcome = computeExampleOutcome(price, rent, "Woonwijk");

      expect(Math.round(outcome.monthlyCashflowEUR)).toBe(cashflow);
      expect(outcome.grossYieldPercent).toBeCloseTo(yieldPercent, 1);
      expect(outcome.dscr).toBeCloseTo(dscr, 2);
      expect(outcome.dimensions.map((d) => d.score)).toEqual(dimensions);
      expect(outcome.totalScore).toBe(total);
    },
  );

  it("the five displayed dimensions average to the displayed total", () => {
    // Not a restatement of the rows above: this is the property that made
    // the rounding order a decision rather than an accident.
    for (const { price, rent } of APPROVED) {
      const outcome = computeExampleOutcome(price, rent, "Woonwijk");
      const mean = outcome.dimensions.reduce((sum, d) => sum + d.score, 0) / 5;
      expect(outcome.totalScore).toBe(Math.round(mean * 10) / 10);
    }
  });
});

describe("the wijk type moves the cost side, never the rent", () => {
  it("costs rise from Woonwijk to Kustzone to Stadscentrum, and cashflow falls", () => {
    const outcomes = EXAMPLE_WIJK_TYPES.map((type) =>
      computeExampleOutcome(300_000, 1_400, type.name),
    );

    expect(outcomes.map((o) => Math.round(o.monthlyCashflowEUR))).toEqual([105, 63, 35]);
    expect(outcomes.map((o) => o.totalScore)).toEqual([7.0, 6.9, 6.9]);
  });

  it("leaves gross yield untouched - the visitor's own rent is not rewritten", () => {
    const yields = EXAMPLE_WIJK_TYPES.map(
      (type) => computeExampleOutcome(300_000, 1_400, type.name).grossYieldPercent,
    );
    expect(new Set(yields).size).toBe(1);
  });

  it("falls back to the first type for an unknown name rather than throwing", () => {
    expect(findWijkType("Bestaat Niet").name).toBe(EXAMPLE_WIJK_TYPES[0]!.name);
  });
});

describe("the demonstration cannot reach the extremes", () => {
  it("stays inside 1,0-9,5 across the whole UI range", () => {
    const totals: number[] = [];
    for (let price = EXAMPLE_PRICE_RANGE.min; price <= EXAMPLE_PRICE_RANGE.max; price += 10_000) {
      for (let rent = EXAMPLE_RENT_RANGE.min; rent <= EXAMPLE_RENT_RANGE.max; rent += 50) {
        for (const type of EXAMPLE_WIJK_TYPES) {
          const outcome = computeExampleOutcome(price, rent, type.name);
          totals.push(outcome.totalScore);
          for (const dimension of outcome.dimensions) {
            expect(dimension.score).toBeGreaterThanOrEqual(1);
            expect(dimension.score).toBeLessThanOrEqual(9.5);
          }
        }
      }
    }
    // Never 0, never 10 - an illustration that cannot hit either extreme.
    expect(Math.min(...totals)).toBeGreaterThan(0);
    expect(Math.max(...totals)).toBeLessThan(10);
  });

  it("clamps beyond the slider range instead of running off the curve", () => {
    const absurdlyCheap = computeExampleOutcome(10_000, 2_500, "Woonwijk");
    const absurdlyDear = computeExampleOutcome(5_000_000, 500, "Woonwijk");

    expect(absurdlyCheap.dimensions.every((d) => d.score <= 9.5)).toBe(true);
    expect(absurdlyDear.dimensions.every((d) => d.score >= 1)).toBe(true);
  });
});

describe("the two fixed dimensions", () => {
  it("do not move with any input - Samuel's decision, since the tool asks for neither", () => {
    const a = computeExampleOutcome(150_000, 2_500, "Woonwijk");
    const b = computeExampleOutcome(600_000, 500, "Stadscentrum");

    for (const outcome of [a, b]) {
      expect(outcome.dimensions[3]!.score).toBe(EXAMPLE_FIXED_FEASIBILITY);
      expect(outcome.dimensions[4]!.score).toBe(EXAMPLE_FIXED_DATA_CERTAINTY);
    }
  });

  it("say in their own description why they hold still", () => {
    const outcome = computeExampleOutcome(300_000, 1_400, "Woonwijk");
    expect(outcome.dimensions[3]!.description).toMatch(/staat vast/);
    expect(outcome.dimensions[4]!.description).toMatch(/staat vast/);
  });
});

describe("the constants the design fixed", () => {
  it("holds the approved values", () => {
    expect(EXAMPLE_MONTHLY_DEBT_RATE).toBe(0.00315);
    expect(EXAMPLE_REQUIRED_YIELD_PERCENT).toBe(5);
    expect(EXAMPLE_FIXED_FEASIBILITY).toBe(8);
    expect(EXAMPLE_FIXED_DATA_CERTAINTY).toBe(6.5);
    expect(EXAMPLE_WIJK_TYPES.map((t) => t.costFraction)).toEqual([0.25, 0.28, 0.3]);
  });

  it("defaults sit inside the slider ranges", () => {
    expect(EXAMPLE_DEFAULTS.priceEUR).toBeGreaterThanOrEqual(EXAMPLE_PRICE_RANGE.min);
    expect(EXAMPLE_DEFAULTS.priceEUR).toBeLessThanOrEqual(EXAMPLE_PRICE_RANGE.max);
    expect(EXAMPLE_DEFAULTS.rentPerMonthEUR).toBeGreaterThanOrEqual(EXAMPLE_RENT_RANGE.min);
    expect(EXAMPLE_DEFAULTS.rentPerMonthEUR).toBeLessThanOrEqual(EXAMPLE_RENT_RANGE.max);
    expect(EXAMPLE_WIJK_TYPES.some((t) => t.name === EXAMPLE_DEFAULTS.wijk)).toBe(true);
  });
});
