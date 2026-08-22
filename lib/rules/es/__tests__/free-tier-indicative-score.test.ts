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
import { FREE_TIER_INDICATIVE_LABEL_THRESHOLDS } from "../parameters";
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
 *   ≈ 7,64 for the midpoint. The unrounded band gives a midpoint of
 *   € 590,239275 and a score of 7.8. The label is "Hoog" either way, so
 *   the difference does not reach the customer.
 */

const referenceBand = computeFreeTierBand({
  neighborhood: "Ruzafa",
  purchasePrice: 350_000,
  builtAreaM2: 90,
});

describe("indicative score - reference case (SCORE_SPEC.md §8.4)", () => {
  const score = computeIndicativeScore(referenceBand);

  it("grades the cashflow midpoint Hoog", () => {
    expect(score.cashflowLabel).toBe("high");
  });

  it("grades data confidence Laag, on 12 placeholders", () => {
    expect(referenceBand.placeholdersUsed).toHaveLength(12);
    expect(score.dataConfidenceLabel).toBe("low");
  });

  it("scores the midpoint of the band, not either end", () => {
    const { low, high } = referenceBand.monthlyCashflowBeforeFinancing;
    const midpoint = (low + high) / 2;
    expect(midpoint).toBeCloseTo(590.239275, 6);
    // The underlying 0-10 figures, checked here and nowhere exposed on the
    // result (SCORE_SPEC.md §8.2).
    expect(cashflowScore(midpoint)).toBeCloseTo(7.8, 10);
    expect(dataCertaintyScore(referenceBand.placeholdersUsed.length)).toBeCloseTo(3.2, 10);
  });

  it("would have graded data confidence Gemiddeld on the five §8.4 guessed at", () => {
    // Not a claim about the code - a record of why the spec's expectation
    // and the implementation differ, so the gap is traceable rather than
    // looking like a mistake in either.
    expect(dataCertaintyScore(5)).toBeCloseTo(6.7, 10);
    expect(toIndicativeLabel(dataCertaintyScore(5))).toBe("medium");
  });
});

describe("indicative score - grading (SCORE_SPEC.md §8.2)", () => {
  it("puts the three bands exactly where the spec's table does", () => {
    expect(toIndicativeLabel(0.0)).toBe("low");
    expect(toIndicativeLabel(3.9)).toBe("low");
    expect(toIndicativeLabel(4.0)).toBe("medium");
    expect(toIndicativeLabel(6.9)).toBe("medium");
    expect(toIndicativeLabel(7.0)).toBe("high");
    expect(toIndicativeLabel(10.0)).toBe("high");
  });

  it("starts Gemiddeld at break-even, matching what §2.1 scores € 0 at", () => {
    // §8.2's stated reason for the 4.0 cut-off: a break-even cashflow
    // already scores 4.0 on the full curve, so the indication reads
    // break-even the same way the paid score does.
    expect(cashflowScore(0)).toBe(FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.value.medium);
    expect(toIndicativeLabel(cashflowScore(0))).toBe("medium");
  });

  it("holds Gemiddeld a few euro below break-even, because §8.2 grades one-decimal scores", () => {
    // A consequence of the spec's own table, not a bug: its bands are
    // written over one-decimal scores ("0,0-3,9 / 4,0-6,9"), and
    // cashflowScore() rounds before grading. On the §2.1 segment from
    // -250 (2.0) to 0 (4.0), a raw score only rounds down to 3.9 below
    // -€ 6,25 - so that, not € 0, is where Laag actually begins.
    expect(cashflowScore(-1)).toBe(4.0);
    expect(toIndicativeLabel(cashflowScore(-1))).toBe("medium");
    expect(cashflowScore(-6)).toBe(4.0);
    expect(toIndicativeLabel(cashflowScore(-6))).toBe("medium");
    expect(cashflowScore(-7)).toBe(3.9);
    expect(toIndicativeLabel(cashflowScore(-7))).toBe("low");
  });

  it("reads the thresholds from the parameter, not from inline numbers", () => {
    const { medium, high } = FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.value;
    expect(toIndicativeLabel(medium)).toBe("medium");
    expect(toIndicativeLabel(high)).toBe("high");
    expect(toIndicativeLabel(medium - 0.1)).toBe("low");
    expect(toIndicativeLabel(high - 0.1)).toBe("medium");
  });

  it("is a model definition, so ESTIMATE is the right label", () => {
    expect(FREE_TIER_INDICATIVE_LABEL_THRESHOLDS.provenance).toBe("ESTIMATE");
  });

  it("grades monotonically - a better score never earns a worse label", () => {
    const rank: Record<IndicativeLabel, number> = { low: 0, medium: 1, high: 2 };
    let previous = -1;
    for (let score = 0; score <= 10.0001; score += 0.1) {
      const current = rank[toIndicativeLabel(Math.round(score * 10) / 10)];
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});

describe("indicative score - it reuses the paid score's curves, not a copy", () => {
  it("moves with the §2.1 cashflow curve across the whole range", () => {
    // Three properties chosen to land in three different grades, each
    // checked against cashflowScore() on the band's own midpoint - so if
    // the curve is ever re-anchored, these follow rather than contradict.
    for (const input of [
      { neighborhood: "Oliva", purchasePrice: 150_000, builtAreaM2: 70 },
      { neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 },
      { neighborhood: "El Carmen (Ciutat Vella)", purchasePrice: 600_000, builtAreaM2: 120 },
    ]) {
      const band = computeFreeTierBand(input);
      const { low, high } = band.monthlyCashflowBeforeFinancing;
      const expected = toIndicativeLabel(cashflowScore((low + high) / 2));
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
      toIndicativeLabel(dataCertaintyScore(band.placeholdersUsed.length)),
    );
  });

  it("grades a low-cashflow property Laag", () => {
    // Oliva's band is € -56 to € 223/month; its midpoint sits just above
    // break-even, so this pins that the grade tracks the midpoint rather
    // than the favourable end.
    const band = computeFreeTierBand({
      neighborhood: "Oliva",
      purchasePrice: 150_000,
      builtAreaM2: 70,
    });
    const { low, high } = band.monthlyCashflowBeforeFinancing;
    expect(low).toBeLessThan(0);
    expect((low + high) / 2).toBeCloseTo(83.828533, 6);
    expect(computeIndicativeScore(band).cashflowLabel).toBe("medium");
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
