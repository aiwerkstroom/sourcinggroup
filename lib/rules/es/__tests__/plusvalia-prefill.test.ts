import { describe, expect, it } from "vitest";
import { PLUSVALIA_VALENCIA_COEFFICIENTS, PLUSVALIA_VALENCIA_RATE } from "../parameters";
import { computePlusvaliaPrefill } from "../plusvalia-prefill";

/**
 * Golden test for the plusvalía pre-fill (datakwaliteitsfix stap 2).
 *
 * WHAT THIS DOES AND DOES NOT PROVE, per constant - they no longer share
 * one status. PLUSVALIA_VALENCIA_RATE is now an ESTIMATE, corrected to
 * 29,70% and cited to the Ayuntamiento de Valencia's own fiscal
 * ordinance, Article 16 (Samuel, 22 August 2026) - see that constant's
 * own block in parameters.ts. PLUSVALIA_VALENCIA_COEFFICIENTS remains
 * PLACEHOLDER, explicitly unverified against Valencia's current fiscal
 * ordinance; confirmed correct and left unchanged in that same
 * correction. This file tests that the arithmetic built on top of both
 * constants is correct, not that either constant's own value is - that
 * second claim, for the coefficients, cannot be tested from here.
 *
 * WHY AN UNVERIFIED COEFFICIENT TABLE IS AN ACCEPTABLE THING TO SHIP. The
 * estimate only pre-fills a wizard field the customer can and is told to
 * override (exit-form.tsx's hint text) - it never reaches
 * buildEngineInput() or the calculation layer. A wrong coefficient
 * produces a wrong SUGGESTION, not a wrong CALCULATION.
 */

describe("no estimate without both required inputs (MODEL_SPEC.md §16: cadastral value is optional)", () => {
  it("returns null when the cadastral land value is missing", () => {
    const result = computePlusvaliaPrefill({ holdingYears: 10 });
    expect(result.estimatedTax).toBeNull();
    expect(result.source).toBe("none");
    expect(result.coefficientUsed).toBeNull();
  });

  it("returns null when the holding period is missing", () => {
    const result = computePlusvaliaPrefill({ cadastralSuelo: 80_000 });
    expect(result.estimatedTax).toBeNull();
    expect(result.source).toBe("none");
  });

  it("returns null for a zero or negative cadastral value", () => {
    expect(computePlusvaliaPrefill({ cadastralSuelo: 0, holdingYears: 10 }).estimatedTax).toBeNull();
    expect(
      computePlusvaliaPrefill({ cadastralSuelo: -5000, holdingYears: 10 }).estimatedTax,
    ).toBeNull();
  });

  it("returns null for a negative holding period", () => {
    expect(
      computePlusvaliaPrefill({ cadastralSuelo: 80_000, holdingYears: -1 }).estimatedTax,
    ).toBeNull();
  });

  it("still always reports the tax rate, even with no estimate - the form can show it either way", () => {
    const result = computePlusvaliaPrefill({});
    expect(result.taxRate).toBe(PLUSVALIA_VALENCIA_RATE.value);
  });
});

describe("the formula: land value x coefficient(years) x rate", () => {
  it("matches a hand-computed figure at 10 years", () => {
    const result = computePlusvaliaPrefill({ cadastralSuelo: 80_000, holdingYears: 10 });
    const expectedCoefficient = PLUSVALIA_VALENCIA_COEFFICIENTS.value[10]!;
    const expectedTax = Math.round(80_000 * expectedCoefficient * PLUSVALIA_VALENCIA_RATE.value);

    expect(result.source).toBe("cadastralEstimate");
    expect(result.coefficientUsed).toBe(expectedCoefficient);
    expect(result.estimatedTax).toBe(expectedTax);
  });

  it("uses a different, correctly-ordered coefficient at a different holding period", () => {
    // The table is not monotonic (SCORE_SPEC-style national coefficients
    // dip mid-range before rising again), so this only asserts that 20
    // years differs from 10 years, not that longer always means higher.
    const at10 = computePlusvaliaPrefill({ cadastralSuelo: 80_000, holdingYears: 10 });
    const at20 = computePlusvaliaPrefill({ cadastralSuelo: 80_000, holdingYears: 20 });

    expect(at20.coefficientUsed).not.toBe(at10.coefficientUsed);
    expect(at20.coefficientUsed).toBe(PLUSVALIA_VALENCIA_COEFFICIENTS.value[20]);
  });

  it("scales linearly with the cadastral land value at a fixed holding period", () => {
    const base = computePlusvaliaPrefill({ cadastralSuelo: 50_000, holdingYears: 5 });
    const doubled = computePlusvaliaPrefill({ cadastralSuelo: 100_000, holdingYears: 5 });

    expect(doubled.estimatedTax).toBe(base.estimatedTax! * 2);
  });

  it("rounds to whole euros", () => {
    const result = computePlusvaliaPrefill({ cadastralSuelo: 77_777, holdingYears: 7 });
    expect(Number.isInteger(result.estimatedTax)).toBe(true);
  });
});

describe("holding-period clamping", () => {
  it("clamps a fractional year to the nearest whole-year band", () => {
    const result = computePlusvaliaPrefill({ cadastralSuelo: 80_000, holdingYears: 10.4 });
    expect(result.coefficientUsed).toBe(PLUSVALIA_VALENCIA_COEFFICIENTS.value[10]);
  });

  it("clamps under 1 year to the '<1 year' band (index 0), not below it", () => {
    const result = computePlusvaliaPrefill({ cadastralSuelo: 80_000, holdingYears: 0 });
    expect(result.coefficientUsed).toBe(PLUSVALIA_VALENCIA_COEFFICIENTS.value[0]);
  });

  it("clamps beyond 20 years to the '>=20 years' band, not off the end of the table", () => {
    const result = computePlusvaliaPrefill({ cadastralSuelo: 80_000, holdingYears: 45 });
    expect(result.coefficientUsed).toBe(PLUSVALIA_VALENCIA_COEFFICIENTS.value[20]);
  });
});

describe("the coefficient table's own shape", () => {
  it("has an entry for every year from 0 to 20 inclusive - no gap the lookup could fall through", () => {
    for (let year = 0; year <= 20; year += 1) {
      expect(PLUSVALIA_VALENCIA_COEFFICIENTS.value[year]).toBeTypeOf("number");
    }
  });

  it("every coefficient is a plausible fraction, not a stray percentage or a typo", () => {
    for (const coefficient of Object.values(PLUSVALIA_VALENCIA_COEFFICIENTS.value)) {
      expect(coefficient).toBeGreaterThan(0);
      expect(coefficient).toBeLessThan(1);
    }
  });

  it("the coefficient table is marked PLACEHOLDER - not confirmed against a primary source", () => {
    expect(PLUSVALIA_VALENCIA_COEFFICIENTS.provenance).toBe("PLACEHOLDER");
  });

  it("the rate is marked ESTIMATE - cited to Valencia's own ordinance but not independently fetched by this project", () => {
    expect(PLUSVALIA_VALENCIA_RATE.provenance).toBe("ESTIMATE");
  });

  it("the rate is exactly Valencia's own cited 29,70% (Ayuntamiento de Valencia, ordenanza fiscal, art. 16)", () => {
    expect(PLUSVALIA_VALENCIA_RATE.value).toBe(0.297);
  });

  it("the rate does not exceed the legal national maximum of 30% (art. 108.1 TRLRHL)", () => {
    expect(PLUSVALIA_VALENCIA_RATE.value).toBeLessThanOrEqual(0.3);
  });
});
