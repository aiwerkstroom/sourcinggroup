import { describe, expect, it } from "vitest";
import {
  INDICATIVE_LABEL_COPY_NL,
  translateFreeTierDisclosure,
  translateIndicativeLabel,
} from "../../../copy/es/free-tier-disclosures";
import { computeFreeTierBand } from "../free-tier/band";
import {
  INDICATIVE_SCORE_DISCLOSURE_KEYS,
  computeIndicativeScore,
  toIndicativeLabel,
} from "../free-tier/indicative-score";
import { FREE_TIER_INDICATIVE_LABEL_THRESHOLDS, NEIGHBORHOOD_RENT_LONG_TERM } from "../parameters";
import { cashflowScore, dataCertaintyScore } from "../score";
import type { IndicativeLabel } from "../types";

/**
 * Golden values: independent recomputation in Python from SCORE_SPEC.md
 * §2.1 and §2.5's anchor tables, transcribed by hand, over the §8.4
 * reference case (Ruzafa, € 350.000, 90 m² - the same property the band's
 * own golden test uses).
 *
 * Two figures the spec left open or approximate, resolved here against the
 * real code and re-derived independently:
 *
 * - Placeholder count. §8.4 could not state it and asked for confirmation
 *   at implementation. The band's placeholdersUsed union is 12: six that
 *   apply to both ends (rent margin, usable/built ratio, cadastral ratio,
 *   long-term occupancy, maintenance rate, bank fee) plus three renovation
 *   multipliers for each of the two tiers. That scores 3.2 on the §2.5
 *   curve, which is "Laag" - not the "Gemiddeld" §8.4 expected from its own
 *   partial enumeration of five parameters (which would have given 6.7).
 * - Cashflow midpoint. § 8.4 rounds the band to € 350 - € 831 and reports
 *   ≈ 7,64 for the midpoint, and that stood until fase A stap 3: before
 *   financing, the unrounded band gave a midpoint of € 590,239275 and a
 *   score of 7.8, graded "Hoog". Fase A stap 3 added the fixed financing
 *   assumption (FINANCING_STRATEGIES.medium + NON_RESIDENT_INTEREST_SPREAD)
 *   to both ends, which - at this particular price/rent combination -
 *   swings the band deeply negative: € -1.115,75 to € -634,49/month,
 *   midpoint € -875,12, clamped to score 0.0.
 *
 * Fase A stap 4 then found that clamping was not unique to this one
 * property: a representative grid of the free indication's own input
 * space put 62.4% of cases at that same clamped floor, which is what made
 * the old shared threshold (medium 4.0, aligned to break-even) call
 * almost everything "Laag" regardless of how the cases actually compared
 * to one another. FREE_TIER_INDICATIVE_LABEL_THRESHOLDS is now split into
 * an independently calibrated cashflow pair (medium 1.0, high 7.0) and
 * data-confidence pair (medium 4.0, high 7.0, unchanged) - see that
 * parameter's own docstring in parameters.ts for the full derivation.
 * This reference case still grades "Laag" under the new cashflow pair too
 * (€ -875,12/month is well past even the lowered bar), which is the
 * correct outcome, not a sign the recalibration failed - see the
 * dedicated "fase A stap 4" describe block below for cases where the new
 * threshold does change the outcome.
 */

const referenceBand = computeFreeTierBand({
  neighborhood: "Ruzafa",
  purchasePrice: 350_000,
  builtAreaM2: 90,
});

describe("indicative score - reference case (SCORE_SPEC.md §8.4)", () => {
  const score = computeIndicativeScore(referenceBand);

  it("grades the cashflow midpoint Laag, both before and after fase A stap 4's recalibration", () => {
    expect(score.cashflowLabel).toBe("low");
  });

  it("grades data confidence Laag, on 12 placeholders", () => {
    expect(referenceBand.placeholdersUsed).toHaveLength(12);
    expect(score.dataConfidenceLabel).toBe("low");
  });

  it("scores the midpoint of the band, not either end", () => {
    const { low, high } = referenceBand.monthlyCashflow;
    const midpoint = (low + high) / 2;
    expect(midpoint).toBeCloseTo(-875.1193997746966, 6);
    // The underlying 0-10 figures, checked here and nowhere exposed on the
    // result (SCORE_SPEC.md §8.2). Clamped to the curve's floor - see the
    // module docstring above for what changed here in fase A stap 3.
    expect(cashflowScore(midpoint)).toBeCloseTo(0, 10);
    expect(dataCertaintyScore(referenceBand.placeholdersUsed.length)).toBeCloseTo(3.2, 10);
  });

  it("would have graded data confidence Gemiddeld on the five §8.4 guessed at", () => {
    // Not a claim about the code - a record of why the spec's expectation
    // and the implementation differ, so the gap is traceable rather than
    // looking like a mistake in either.
    expect(dataCertaintyScore(5)).toBeCloseTo(6.7, 10);
    expect(
      toIndicativeLabel(dataCertaintyScore(5), FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.value.dataConfidence),
    ).toBe("medium");
  });
});

describe("indicative score - grading (SCORE_SPEC.md §8.2)", () => {
  it("puts the three bands exactly where the cashflow pair says (fase A stap 4: medium 1.0, high 7.0)", () => {
    const { cashflow } = FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.value;
    expect(toIndicativeLabel(0.0, cashflow)).toBe("low");
    expect(toIndicativeLabel(0.9, cashflow)).toBe("low");
    expect(toIndicativeLabel(1.0, cashflow)).toBe("medium");
    expect(toIndicativeLabel(6.9, cashflow)).toBe("medium");
    expect(toIndicativeLabel(7.0, cashflow)).toBe("high");
    expect(toIndicativeLabel(10.0, cashflow)).toBe("high");
  });

  it("puts the three bands exactly where the data-confidence pair says (unchanged since this parameter's introduction: medium 4.0, high 7.0)", () => {
    const { dataConfidence } = FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.value;
    expect(toIndicativeLabel(0.0, dataConfidence)).toBe("low");
    expect(toIndicativeLabel(3.9, dataConfidence)).toBe("low");
    expect(toIndicativeLabel(4.0, dataConfidence)).toBe("medium");
    expect(toIndicativeLabel(6.9, dataConfidence)).toBe("medium");
    expect(toIndicativeLabel(7.0, dataConfidence)).toBe("high");
    expect(toIndicativeLabel(10.0, dataConfidence)).toBe("high");
  });

  it("data confidence still starts Gemiddeld at break-even's old score - §2.5 is untouched by fase A stap 3/4", () => {
    // The coincidence §8.2 originally described (break-even scoring 4.0 on
    // §2.1, the same number as the shared threshold) only ever held for
    // the cashflow dimension, and cashflow gave that alignment up in fase
    // A stap 4 for a data-informed threshold instead (see this parameter's
    // docstring). Data confidence's own 4.0 was never about break-even in
    // the first place - it grades §2.5's placeholder-count curve, which
    // has no euro axis at all - so it is unaffected either way.
    expect(cashflowScore(0)).toBe(4.0);
    expect(FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.value.dataConfidence.medium).toBe(4.0);
  });

  it("cashflow's medium sits in the gap between the curve's clamped floor and its next distinct value (fase A stap 4)", () => {
    // §2.1 clamps everything at or below -€500/month to exactly 0.0, so
    // there is no real case anywhere between raw score 0.0 and the first
    // distinct value above it - the recalibration picked medium (1.0)
    // inside that empty gap on purpose (see parameters.ts), which is why
    // any property genuinely at the floor reads unambiguously "Laag"
    // regardless of how far below -€500 it actually sits.
    const { cashflow } = FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.value;
    expect(cashflowScore(-500)).toBe(0.0);
    expect(toIndicativeLabel(cashflowScore(-500), cashflow)).toBe("low");
    expect(cashflowScore(-10_000)).toBe(0.0);
    expect(toIndicativeLabel(cashflowScore(-10_000), cashflow)).toBe("low");
  });

  it("reads the thresholds from the parameter, not from inline numbers - for both pairs", () => {
    const { cashflow, dataConfidence } = FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.value;
    for (const thresholds of [cashflow, dataConfidence]) {
      expect(toIndicativeLabel(thresholds.medium, thresholds)).toBe("medium");
      expect(toIndicativeLabel(thresholds.high, thresholds)).toBe("high");
      expect(toIndicativeLabel(thresholds.medium - 0.1, thresholds)).toBe("low");
      expect(toIndicativeLabel(thresholds.high - 0.1, thresholds)).toBe("medium");
    }
  });

  it("is a model definition, so ESTIMATE is the right label", () => {
    expect(FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.provenance).toBe("ESTIMATE");
  });

  it("grades monotonically - a better score never earns a worse label, for either pair", () => {
    const rank: Record<IndicativeLabel, number> = { low: 0, medium: 1, high: 2 };
    const { cashflow, dataConfidence } = FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.value;
    for (const thresholds of [cashflow, dataConfidence]) {
      let previous = -1;
      for (let score = 0; score <= 10.0001; score += 0.1) {
        const current = rank[toIndicativeLabel(Math.round(score * 10) / 10, thresholds)];
        expect(current).toBeGreaterThanOrEqual(previous);
        previous = current;
      }
    }
  });
});

describe("indicative score - it reuses the paid score's curves, not a copy", () => {
  it("moves with the §2.1 cashflow curve across the whole range", () => {
    // Three properties that spanned three different grades before fase A
    // stap 3 added financing; now all three clamp to "low" under either
    // the old or the recalibrated (fase A stap 4) threshold, since all
    // three sit at the curve's own floor - but the point of this test is
    // unchanged - each case is checked against cashflowScore() on the
    // band's own midpoint, not a hardcoded label, so if the curve is ever
    // re-anchored these follow rather than contradict.
    const { cashflow } = FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.value;
    for (const input of [
      { neighborhood: "Oliva", purchasePrice: 150_000, builtAreaM2: 70 },
      { neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 },
      { neighborhood: "El Carmen (Ciutat Vella)", purchasePrice: 600_000, builtAreaM2: 120 },
    ]) {
      const band = computeFreeTierBand(input);
      const { low, high } = band.monthlyCashflow;
      const expected = toIndicativeLabel(cashflowScore((low + high) / 2), cashflow);
      expect(computeIndicativeScore(band).cashflowLabel).toBe(expected);
    }
  });

  it("moves with the §2.5 data-certainty curve via the band's own placeholder list", () => {
    const band = computeFreeTierBand({
      neighborhood: "Ruzafa",
      purchasePrice: 350_000,
      builtAreaM2: 90,
    });
    expect(computeIndicativeScore(band).dataConfidenceLabel).toBe(
      toIndicativeLabel(
        dataCertaintyScore(band.placeholdersUsed.length),
        FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.value.dataConfidence,
      ),
    );
  });

  it("grades a low-cashflow property Laag", () => {
    // Oliva's band is € -683,56 to € -404,80/month after fase A stap 3's
    // financing (was € -56 to € 223 before it, straddling break-even) -
    // this pins that the grade tracks the midpoint rather than the
    // favourable end.
    const band = computeFreeTierBand({
      neighborhood: "Oliva",
      purchasePrice: 150_000,
      builtAreaM2: 70,
    });
    const { low, high } = band.monthlyCashflow;
    expect(low).toBeLessThan(0);
    expect((low + high) / 2).toBeCloseTo(-544.1823275439177, 6);
    expect(computeIndicativeScore(band).cashflowLabel).toBe("low");
  });
});

/**
 * Fase A stap 4: the cashflow pair's recalibration, on the four anchor
 * points the design review settled on. Together they show the label
 * actually discriminating again - Laag, Gemiddeld (twice, at different
 * points in its range) and Hoog all appear - rather than the uniform
 * "Laag" fase A stap 3 alone produced on every one of this file's
 * existing canonical cases.
 */
describe("indicative score - fase A stap 4: cashflow label recalibration", () => {
  it("Ruzafa, € 350.000, 90 m² (referentiecasus): stays Laag - genuinely below even the lowered bar", () => {
    const band = computeFreeTierBand({ neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 });
    const { low, high } = band.monthlyCashflow;
    expect((low + high) / 2).toBeCloseTo(-875.1193997746966, 6);
    expect(computeIndicativeScore(band).cashflowLabel).toBe("low");
  });

  it("Oliva, € 100.000, 60 m²: flips from Laag to Gemiddeld - this is what the recalibration was for", () => {
    const band = computeFreeTierBand({ neighborhood: "Oliva", purchasePrice: 100_000, builtAreaM2: 60 });
    const { low, high } = band.monthlyCashflow;
    const midpoint = (low + high) / 2;
    expect(midpoint).toBeCloseTo(-363.844688, 5);
    const rawScore = cashflowScore(midpoint);
    // Under the old, shared threshold (medium 4.0) this case was "low" -
    // still meaningfully negative cashflow, but clearly better than the
    // clamped-floor majority it used to be indistinguishable from.
    expect(toIndicativeLabel(rawScore, { medium: 4.0, high: 7.0 })).toBe("low");
    expect(computeIndicativeScore(band).cashflowLabel).toBe("medium");
  });

  it("Ruzafa, € 150.000, 90 m²: stays Gemiddeld - already above both the old and the new medium", () => {
    const band = computeFreeTierBand({ neighborhood: "Ruzafa", purchasePrice: 150_000, builtAreaM2: 90 });
    const { low, high } = band.monthlyCashflow;
    expect((low + high) / 2).toBeCloseTo(28.895081, 5);
    expect(computeIndicativeScore(band).cashflowLabel).toBe("medium");
  });

  it("El Carmen (Ciutat Vella), € 150.000, 100 m²: stays Hoog - high was never changed", () => {
    const band = computeFreeTierBand({
      neighborhood: "El Carmen (Ciutat Vella)",
      purchasePrice: 150_000,
      builtAreaM2: 100,
    });
    const { low, high } = band.monthlyCashflow;
    expect((low + high) / 2).toBeCloseTo(539.836579, 5);
    expect(computeIndicativeScore(band).cashflowLabel).toBe("high");
  });
});

/**
 * Fase A stap 4's other requirement: splitting the shared threshold must
 * not move data confidence's own grading, on any case - that is the
 * actual guarantee the split exists to provide (see
 * FREE_TIER_INDICATIVE_LABEL_THRESHOLDS's docstring in parameters.ts).
 * Checked by recomputing each case's data-confidence label against the
 * literal pre-split values (4.0/7.0), independent of whatever the
 * parameter's dataConfidence field currently holds, and confirming they
 * still agree.
 */
describe("indicative score - fase A stap 4: data confidence is unaffected by the threshold split", () => {
  const PRE_SPLIT_DATA_CONFIDENCE_THRESHOLDS = { medium: 4.0, high: 7.0 };

  it("the parameter's own dataConfidence pair still literally equals the pre-split values", () => {
    expect(FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.value.dataConfidence).toEqual(
      PRE_SPLIT_DATA_CONFIDENCE_THRESHOLDS,
    );
  });

  it("every case in this file grades the same dataConfidenceLabel it would have under the pre-split threshold", () => {
    for (const input of [
      { neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 },
      { neighborhood: "Oliva", purchasePrice: 150_000, builtAreaM2: 70 },
      { neighborhood: "Oliva", purchasePrice: 100_000, builtAreaM2: 60 },
      { neighborhood: "Ruzafa", purchasePrice: 150_000, builtAreaM2: 90 },
      { neighborhood: "El Carmen (Ciutat Vella)", purchasePrice: 600_000, builtAreaM2: 120 },
      { neighborhood: "El Carmen (Ciutat Vella)", purchasePrice: 150_000, builtAreaM2: 100 },
    ]) {
      const band = computeFreeTierBand(input);
      const expected = toIndicativeLabel(
        dataCertaintyScore(band.placeholdersUsed.length),
        PRE_SPLIT_DATA_CONFIDENCE_THRESHOLDS,
      );
      expect(computeIndicativeScore(band).dataConfidenceLabel).toBe(expected);
    }
  });
});

/**
 * Fase A stap 4's own sanity check on the recalibration itself: the same
 * representative grid the design's derivation used (13 neighbourhoods x
 * purchase prices € 80.000-€ 600.000 in € 20.000 steps x built areas
 * 30-200 m² in 10 m² steps = 6.318 cases), reproduced here independently
 * against the real code rather than trusted from the parameter's own
 * reasoning field, confirming the label actually spreads roughly
 * 67/24/9 - not the near-total "Laag" the old shared threshold produced.
 */
describe("indicative score - fase A stap 4: recalibration sanity check on the representative grid", () => {
  it("spreads Laag/Gemiddeld/Hoog approximately 67% / 24% / 9% across 6.318 cases", () => {
    const { cashflow } = FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.value;
    const neighborhoods = Object.keys(NEIGHBORHOOD_RENT_LONG_TERM.value);
    const prices: number[] = [];
    for (let p = 80_000; p <= 600_000; p += 20_000) prices.push(p);
    const areas: number[] = [];
    for (let a = 30; a <= 200; a += 10) areas.push(a);

    const counts: Record<IndicativeLabel, number> = { low: 0, medium: 0, high: 0 };
    let total = 0;
    for (const purchasePrice of prices) {
      for (const builtAreaM2 of areas) {
        for (const neighborhood of neighborhoods) {
          const band = computeFreeTierBand({ neighborhood, purchasePrice, builtAreaM2 });
          const { low, high } = band.monthlyCashflow;
          const label = toIndicativeLabel(cashflowScore((low + high) / 2), cashflow);
          counts[label]++;
          total++;
        }
      }
    }

    expect(total).toBe(6_318);
    // Exact counts, not just percentages - fully deterministic, no
    // randomness anywhere in this grid, so these reproduce bit-for-bit.
    expect(counts.low).toBe(4_233);
    expect(counts.medium).toBe(1_511);
    expect(counts.high).toBe(574);
  });
});

describe("indicative score - what it deliberately does not expose (SCORE_SPEC.md §8.2)", () => {
  const score = computeIndicativeScore(referenceBand);

  it("carries no 0-10 number anywhere on the result", () => {
    // The whole point of the coarse scale: an indication must not be
    // laid beside a paid TSG score and read as the same measurement.
    for (const value of Object.values(score)) {
      expect(typeof value).not.toBe("number");
    }
    expect(Object.keys(score).sort()).toEqual([
      "cashflowLabel",
      "dataConfidenceLabel",
      "disclosures",
    ]);
  });

  it("has no third dimension standing in for the missing three", () => {
    // §8.1: return, debt resilience and feasibility are absent and are not
    // compensated for by re-weighting what remains.
    expect(Object.keys(score).filter((k) => k.endsWith("Label"))).toHaveLength(2);
  });
});

describe("indicative score - the scope disclosure (SCORE_SPEC.md §8.3)", () => {
  it("is present unconditionally, for every property", () => {
    for (const input of [
      { neighborhood: "Oliva", purchasePrice: 150_000, builtAreaM2: 70 },
      { neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 },
      { neighborhood: "El Carmen (Ciutat Vella)", purchasePrice: 600_000, builtAreaM2: 120 },
    ]) {
      const score = computeIndicativeScore(computeFreeTierBand(input));
      expect(score.disclosures).toEqual(["indicativeScoreScope"]);
    }
  });

  it("is additive to the band's four, giving all five together", () => {
    const score = computeIndicativeScore(referenceBand);
    const shown = [...referenceBand.disclosures, ...score.disclosures];
    expect(new Set(shown).size).toBe(shown.length);
    expect(shown).toHaveLength(5);
    expect(shown).toContain("indicativeScoreScope");
  });

  it("is a key in the calculation layer, never Dutch text", () => {
    expect(INDICATIVE_SCORE_DISCLOSURE_KEYS).toEqual(["indicativeScoreScope"]);
    for (const key of INDICATIVE_SCORE_DISCLOSURE_KEYS) {
      expect(key).not.toMatch(/\s/);
    }
  });

  it("names the three dimensions the free indication cannot score", () => {
    const text = translateFreeTierDisclosure("indicativeScoreScope");
    expect(text).toContain("twee van de vijf factoren");
    expect(text).toContain("Rendement");
    expect(text).toContain("schuldbestendigheid");
    expect(text).toContain("haalbaarheid");
    expect(text).toContain("financieringsgegevens");
  });
});

describe("indicative score - Dutch label copy", () => {
  it("translates all three grades", () => {
    expect(translateIndicativeLabel("low")).toBe("Laag");
    expect(translateIndicativeLabel("medium")).toBe("Gemiddeld");
    expect(translateIndicativeLabel("high")).toBe("Hoog");
  });

  it("has exactly one Record entry per IndicativeLabel", () => {
    expect(Object.keys(INDICATIVE_LABEL_COPY_NL).sort()).toEqual(["high", "low", "medium"]);
  });

  it("throws rather than silently returning empty text for an unknown grade", () => {
    expect(() => translateIndicativeLabel("excellent" as unknown as never)).toThrow(
      /Missing Dutch copy for indicative label/,
    );
  });

  it("keeps the grades out of the calculation layer's own vocabulary", () => {
    // The result speaks English; only this copy module knows the Dutch.
    const score = computeIndicativeScore(referenceBand);
    expect(["low", "medium", "high"]).toContain(score.cashflowLabel);
    expect(["low", "medium", "high"]).toContain(score.dataConfidenceLabel);
  });
});
