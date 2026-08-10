import { describe, expect, it } from "vitest";
import {
  buildIndexSeries,
  costInflationFactor,
  DEFAULT_PROJECTION_START_YEAR,
  isExtrapolated,
  rentGrowthFactor,
} from "../indexation";

/**
 * Golden values: independent recomputation of the Correction Factors series
 * (MODEL_SPEC_FASE1B §8 - no Excel counterpart exists for phase 1b, so the
 * defence against a silent error is a second, separate calculation).
 */
describe("correction factor lookups", () => {
  it("reads rent growth from the series (Correction Factors!O26:S26)", () => {
    expect(rentGrowthFactor(2026)).toBe(1.06);
    expect(rentGrowthFactor(2027)).toBe(1.05);
    expect(rentGrowthFactor(2028)).toBe(1.04);
    expect(rentGrowthFactor(2029)).toBe(1.035);
    expect(rentGrowthFactor(2030)).toBe(1.03);
  });

  it("converts CPI percentages into cost multipliers (Correction Factors!O12:S12)", () => {
    expect(costInflationFactor(2026)).toBeCloseTo(1.02, 12);
    expect(costInflationFactor(2027)).toBeCloseTo(1.022, 12);
    expect(costInflationFactor(2028)).toBeCloseTo(1.021, 12);
    expect(costInflationFactor(2029)).toBeCloseTo(1.02, 12);
    expect(costInflationFactor(2030)).toBeCloseTo(1.02, 12);
  });

  it("carries the last known value forward beyond 2030", () => {
    expect(rentGrowthFactor(2031)).toBe(1.03);
    expect(rentGrowthFactor(2035)).toBe(1.03);
    expect(costInflationFactor(2031)).toBeCloseTo(1.02, 12);
  });

  it("flags years beyond the series as extrapolated", () => {
    expect(isExtrapolated(2030)).toBe(false);
    expect(isExtrapolated(2031)).toBe(true);
  });

  it("refuses a year before the series starts instead of guessing", () => {
    expect(() => rentGrowthFactor(2025)).toThrow(/Correction Factors series/);
    expect(() => costInflationFactor(2020)).toThrow(/Correction Factors series/);
  });
});

describe("index series (base scenario, 10 years from 2026)", () => {
  const series = buildIndexSeries({ years: 10, scenario: "base" });

  it("starts in the first estimate year of the series", () => {
    expect(DEFAULT_PROJECTION_START_YEAR).toBe(2026);
    expect(series[0]!.calendarYear).toBe(2026);
    expect(series).toHaveLength(10);
  });

  it("treats year 1 as the base year: rent and cost index are exactly 1", () => {
    expect(series[0]!.rentIndex).toBe(1);
    expect(series[0]!.costIndex).toBe(1);
  });

  it("compounds the rent index per year", () => {
    expect(series[1]!.rentIndex).toBeCloseTo(1.05, 12);
    expect(series[2]!.rentIndex).toBeCloseTo(1.092, 12);
    expect(series[3]!.rentIndex).toBeCloseTo(1.13022, 12);
    expect(series[4]!.rentIndex).toBeCloseTo(1.1641266, 12);
    expect(series[9]!.rentIndex).toBeCloseTo(1.349541786583007, 12);
  });

  it("compounds the cost index per year", () => {
    expect(series[1]!.costIndex).toBeCloseTo(1.022, 12);
    expect(series[2]!.costIndex).toBeCloseTo(1.043462, 12);
    expect(series[3]!.costIndex).toBeCloseTo(1.06433124, 12);
    expect(series[4]!.costIndex).toBeCloseTo(1.0856178648, 12);
    expect(series[9]!.costIndex).toBeCloseTo(1.1986098441366535, 12);
  });

  it("grows the property value from year 1 onwards (exit price = purchase x growth^n)", () => {
    expect(series[0]!.propertyValueIndex).toBeCloseTo(1.05, 12);
    expect(series[4]!.propertyValueIndex).toBeCloseTo(1.2762815625, 12);
    expect(series[9]!.propertyValueIndex).toBeCloseTo(1.628894626777442, 12);
  });

  it("keeps the IBI index at 1 in year 1, unlike the exit-price index", () => {
    expect(series[0]!.ibiValueIndex).toBe(1);
    expect(series[1]!.ibiValueIndex).toBeCloseTo(1.05, 12);
    expect(series[4]!.ibiValueIndex).toBeCloseTo(1.21550625, 12);
    expect(series[9]!.ibiValueIndex).toBeCloseTo(1.5513282159785162, 12);
  });

  it("ibiValueIndex(year) equals propertyValueIndex(year - 1)", () => {
    for (let i = 1; i < series.length; i++) {
      expect(series[i]!.ibiValueIndex).toBeCloseTo(series[i - 1]!.propertyValueIndex, 12);
    }
  });

  it("marks 2031 onwards as extrapolated", () => {
    expect(series.filter((y) => y.extrapolated).map((y) => y.calendarYear)).toEqual([
      2031, 2032, 2033, 2034, 2035,
    ]);
  });
});

describe("index series per scenario", () => {
  it("applies 4% / 5% / 6% value growth", () => {
    const years = 10;
    expect(
      buildIndexSeries({ years, scenario: "conservative" })[9]!.propertyValueIndex,
    ).toBeCloseTo(1.04 ** 10, 12);
    expect(buildIndexSeries({ years, scenario: "base" })[9]!.propertyValueIndex).toBeCloseTo(
      1.05 ** 10,
      12,
    );
    expect(
      buildIndexSeries({ years, scenario: "optimistic" })[9]!.propertyValueIndex,
    ).toBeCloseTo(1.06 ** 10, 12);
  });

  it("uses the same rent and cost index in every scenario", () => {
    const a = buildIndexSeries({ years: 10, scenario: "conservative" });
    const b = buildIndexSeries({ years: 10, scenario: "optimistic" });
    expect(a.map((y) => y.rentIndex)).toEqual(b.map((y) => y.rentIndex));
    expect(a.map((y) => y.costIndex)).toEqual(b.map((y) => y.costIndex));
  });

  it("rejects a projection shorter than one year", () => {
    expect(() => buildIndexSeries({ years: 0, scenario: "base" })).toThrow(/at least 1 year/);
  });
});
