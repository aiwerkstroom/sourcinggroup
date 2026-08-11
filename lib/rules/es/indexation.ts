/**
 * Phase 1b - yearly indexation (MODEL_SPEC_FASE1B §3, revised).
 *
 * Turns the Correction Factors series into a per-year index the projection
 * can multiply through. Two quantities move independently:
 *
 * - rent growth      -> gross rent                          (Rent Price Changes)
 * - cost inflation   -> maintenance, utilities, insurance,
 *                       bank fees, and IBI                  (CPI)
 *
 * IBI does NOT follow the property's market value: it is levied on the
 * cadastral value (valor catastral), which is set administratively and
 * revised periodically, not tied to market price movements. Since this
 * model has no cadastral-value series, IBI is indexed with CPI like the
 * other fixed cost lines - an approximation, documented in MODEL_SPEC.md.
 *
 * Base-year convention: year 1 is the phase-1 single-year outcome, so its
 * rent and cost index are exactly 1 and growth starts to bite in year 2.
 *
 * `propertyValueIndex` is kept for the exit price only (MODEL_SPEC_FASE1B
 * §5): the sale price after holding n years is `purchase price x growth^n`,
 * an end-of-holding-period index where year 1 already carries one year of
 * growth. It is deliberately not used for anything but the exit.
 */

import {
  CORRECTION_FACTORS_FIRST_ESTIMATE_YEAR,
  CORRECTION_FACTORS_LAST_YEAR,
  CPI_PERCENT_BY_YEAR,
  RENT_GROWTH_BY_YEAR,
  VALUE_GROWTH_ANNUAL,
} from "./parameters";
import type { ScenarioId } from "./types";

export const DEFAULT_PROJECTION_START_YEAR = CORRECTION_FACTORS_FIRST_ESTIMATE_YEAR.value;

/** One projection year with its growth factors and cumulative indices. */
export interface YearIndex {
  /** 1-based position in the projection. */
  yearNumber: number;
  /** Calendar year, used to look up the Correction Factors series. */
  calendarYear: number;
  /** That year's rent multiplier (1.06 = +6%). */
  rentGrowthFactor: number;
  /** That year's cost multiplier, derived from CPI (2.0% -> 1.02). */
  costInflationFactor: number;
  /** Cumulative rent index relative to year 1 (year 1 = 1). */
  rentIndex: number;
  /** Cumulative cost index relative to year 1 (year 1 = 1). */
  costIndex: number;
  /** Property value index: growth^yearNumber (year 1 already grown once). Exit price only - not used for IBI. */
  propertyValueIndex: number;
  /** True when the year falls beyond the source series and was carried forward. */
  extrapolated: boolean;
}

/**
 * Rent growth for a calendar year. Beyond the series the last known value is
 * carried forward; the caller learns that from `isExtrapolated`.
 */
export function rentGrowthFactor(calendarYear: number): number {
  const clamped = Math.min(calendarYear, CORRECTION_FACTORS_LAST_YEAR.value);
  const value = RENT_GROWTH_BY_YEAR.value[clamped];
  if (value === undefined) {
    throw new Error(
      `No rent growth factor for ${calendarYear}: the Correction Factors series starts at ${CORRECTION_FACTORS_FIRST_ESTIMATE_YEAR.value}`,
    );
  }
  return value;
}

/** Cost inflation multiplier for a calendar year, derived from the CPI row. */
export function costInflationFactor(calendarYear: number): number {
  const clamped = Math.min(calendarYear, CORRECTION_FACTORS_LAST_YEAR.value);
  const percent = CPI_PERCENT_BY_YEAR.value[clamped];
  if (percent === undefined) {
    throw new Error(
      `No CPI value for ${calendarYear}: the Correction Factors series starts at ${CORRECTION_FACTORS_FIRST_ESTIMATE_YEAR.value}`,
    );
  }
  return 1 + percent / 100;
}

/** Whether a calendar year sits beyond the Correction Factors series. */
export function isExtrapolated(calendarYear: number): boolean {
  return calendarYear > CORRECTION_FACTORS_LAST_YEAR.value;
}

/**
 * Property value index after holding a property for `years` years:
 * growth^years, compounded from the scenario's annual value growth rate
 * (MODEL_SPEC_FASE1B §5). Shared by buildIndexSeries (year-by-year) and
 * the exit price (a single lookup at the holding period) so both use the
 * exact same compounding, not two hand-copied `** ` expressions.
 */
export function propertyValueIndex(scenario: ScenarioId, years: number): number {
  return VALUE_GROWTH_ANNUAL[scenario].value ** years;
}

/**
 * Builds the index series for a projection.
 *
 * Year 1 is the base year: its rent and cost index are 1, so the phase-1
 * outcome passes through unchanged. From year 2 on, each year multiplies in
 * its own calendar year's factor.
 */
export function buildIndexSeries(args: {
  startYear?: number;
  years: number;
  scenario: ScenarioId;
}): YearIndex[] {
  const startYear = args.startYear ?? DEFAULT_PROJECTION_START_YEAR;
  if (!Number.isInteger(args.years) || args.years < 1) {
    throw new Error(`Projection needs at least 1 year, got ${args.years}`);
  }

  const series: YearIndex[] = [];
  let rentIndex = 1;
  let costIndex = 1;

  for (let yearNumber = 1; yearNumber <= args.years; yearNumber++) {
    const calendarYear = startYear + yearNumber - 1;
    const rent = rentGrowthFactor(calendarYear);
    const cost = costInflationFactor(calendarYear);
    // Year 1 is the base year; growth applies from year 2 onwards.
    if (yearNumber > 1) {
      rentIndex *= rent;
      costIndex *= cost;
    }
    series.push({
      yearNumber,
      calendarYear,
      rentGrowthFactor: rent,
      costInflationFactor: cost,
      rentIndex,
      costIndex,
      propertyValueIndex: propertyValueIndex(args.scenario, yearNumber),
      extrapolated: isExtrapolated(calendarYear),
    });
  }
  return series;
}
