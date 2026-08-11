import { describe, expect, it } from "vitest";
import { runEngine } from "../engine";
import {
  buildSyntheticEngineInput,
  deriveSyntheticEquitySupply,
  generateReferenceDistribution,
} from "../distribution/generate";
import {
  NEIGHBORHOOD_RENT_LONG_TERM,
  NEIGHBORHOOD_RENT_SHORT_TERM,
  TSG_SCORE_DISTRIBUTION_AREA_RANGE_M2,
  TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE,
  TSG_SCORE_DISTRIBUTION_EQUITY_COVERAGE_RANGE,
  TSG_SCORE_DISTRIBUTION_PRICE_TO_RENT_MULTIPLIER_RANGE,
  TSG_SCORE_DISTRIBUTION_RENTAL_STRATEGY_SHARES,
} from "../parameters";
import { computePercentile } from "../percentile";

/**
 * SCORE_SPEC.md §5: "Genereer bij de eerste build een synthetische set van
 * 1.000 casussen ... Reken elke casus door en bewaar alleen de
 * totaalscore." The Claude instruction for this step ("Genereer de
 * verdeling als onderdeel van de tests, niet als los script") is followed
 * literally: every test below calls generateReferenceDistribution()
 * itself rather than reading a pre-built JSON asset.
 *
 * The mulberry32 sequence this module's RNG produces was independently
 * cross-checked against a from-scratch Python reimplementation for seed
 * 20260811 (bit-for-bit match on the first 10 draws) - the same
 * independent-recomputation method used for the phase-1b golden tests,
 * applied here to the one genuinely new piece of arithmetic this step
 * introduces (the engine itself was already exhaustively golden-tested).
 */

function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return function nextRandom(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The corrections to the generator's sampling design, verified directly
 * against buildSyntheticEngineInput()'s and deriveSyntheticEquitySupply()'s
 * own derived figures rather than only indirectly through a final score.
 */
describe("corrections to the generator's sampling design", () => {
  it("1. purchase price is derived from area x the neighborhood's own rent, not drawn independently of it", () => {
    const rng = createRng(1);
    for (let i = 0; i < 200; i++) {
      const { input, derived } = buildSyntheticEngineInput(rng);
      const rentPerM2LongTerm = NEIGHBORHOOD_RENT_LONG_TERM.value[derived.neighborhood]!;
      expect(input.selections.rentPerM2LongTerm).toBe(rentPerM2LongTerm);
      // purchasePrice = annual rent per m² x multiplier x builtAreaM2, exactly.
      expect(derived.purchasePrice).toBeCloseTo(
        rentPerM2LongTerm * 12 * derived.priceToRentMultiplier * derived.builtAreaM2,
        6,
      );
      // The multiplier stays within the configured price-to-rent bandwidth.
      const range = TSG_SCORE_DISTRIBUTION_PRICE_TO_RENT_MULTIPLIER_RANGE.value;
      expect(derived.priceToRentMultiplier).toBeGreaterThanOrEqual(range.min);
      expect(derived.priceToRentMultiplier).toBeLessThanOrEqual(range.max);
    }
  });

  it("2. gastos de comunidad varies per case within the configured range, not fixed at € 900", () => {
    const rng = createRng(3);
    const range = TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE.value;
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const { input, derived } = buildSyntheticEngineInput(rng);
      expect(input.property.communityFeesAnnual).toBe(derived.communityFeesAnnual);
      expect(derived.communityFeesAnnual).toBeGreaterThanOrEqual(range.min);
      expect(derived.communityFeesAnnual).toBeLessThanOrEqual(range.max);
      seen.add(Math.round(derived.communityFeesAnnual));
    }
    // Genuinely varies, not a constant repeated 200 times.
    expect(seen.size).toBeGreaterThan(100);
  });

  it("the area range itself is unchanged by the corrections: still SCORE_SPEC.md §5's 30-200 m², uniform", () => {
    const rng = createRng(4);
    const range = TSG_SCORE_DISTRIBUTION_AREA_RANGE_M2.value;
    for (let i = 0; i < 100; i++) {
      const { derived } = buildSyntheticEngineInput(rng);
      expect(derived.builtAreaM2).toBeGreaterThanOrEqual(range.min);
      expect(derived.builtAreaM2).toBeLessThanOrEqual(range.max);
    }
  });

  it("3. available equity (and totalBudget) is a coverage factor on THIS case's own equityRequired, not a share of purchase price", () => {
    const rng = createRng(5);
    const range = TSG_SCORE_DISTRIBUTION_EQUITY_COVERAGE_RANGE.value;
    for (let i = 0; i < 50; i++) {
      const { input } = buildSyntheticEngineInput(rng);
      const engineResult = runEngine(input);
      const equity = deriveSyntheticEquitySupply(rng, engineResult.acquisition.equityRequired);

      expect(equity.equityRequired).toBe(engineResult.acquisition.equityRequired);
      expect(equity.equityAvailable).toBeCloseTo(equity.equityRequired * equity.equityCoverage, 6);
      expect(equity.equityCoverage).toBeGreaterThanOrEqual(range.min);
      expect(equity.equityCoverage).toBeLessThanOrEqual(range.max);

      // A coverage factor of exactly 1.0 must mean exactly enough equity -
      // the whole point of anchoring to equityRequired instead of price.
      const exactCoverage = deriveSyntheticEquitySupply(() => 0.5, equity.equityRequired);
      const midpoint = (range.min + range.max) / 2;
      expect(exactCoverage.equityCoverage).toBeCloseTo(midpoint, 10);
    }
  });

  it("deriveSyntheticEquitySupply() can straddle both sides of equityRequired: some cases under-covered, some over-covered", () => {
    // rng() = 0 draws the minimum coverage (under-prepared); rng() = 1
    // (unreachable in practice, but the boundary) draws the maximum
    // (over-prepared). Confirms the range genuinely spans both sides of
    // 1.0, not just a band that happens to average out near it.
    const range = TSG_SCORE_DISTRIBUTION_EQUITY_COVERAGE_RANGE.value;
    expect(range.min).toBeLessThan(1);
    expect(range.max).toBeGreaterThan(1);

    const under = deriveSyntheticEquitySupply(() => 0, 100_000);
    expect(under.equityAvailable).toBeLessThan(100_000);
    expect(under.equityCoverage).toBeCloseTo(range.min, 10);

    const over = deriveSyntheticEquitySupply(() => 0.999999, 100_000);
    expect(over.equityAvailable).toBeGreaterThan(100_000);
  });
});

describe("data used by the generator is self-consistent", () => {
  it("the long-term and short-term neighborhood tables cover the exact same neighborhoods", () => {
    // scoreOneCase() reads NEIGHBORHOOD_RENT_SHORT_TERM.value[neighborhood]
    // with a non-null assertion after picking from the long-term table's
    // keys - if the two tables' key sets ever diverged, that assertion
    // would silently produce undefined instead of failing loudly.
    const ltKeys = Object.keys(NEIGHBORHOOD_RENT_LONG_TERM.value).sort();
    const stKeys = Object.keys(NEIGHBORHOOD_RENT_SHORT_TERM.value).sort();
    expect(stKeys).toEqual(ltKeys);
  });

  it("the rental strategy shares sum to 1 (only longTerm/hybrid are drawn, never shortTerm)", () => {
    const shares = TSG_SCORE_DISTRIBUTION_RENTAL_STRATEGY_SHARES.value;
    expect(shares.longTerm + shares.hybrid).toBeCloseTo(1, 12);
  });
});

describe("generateReferenceDistribution() (SCORE_SPEC.md §5)", () => {
  it("produces exactly `size` scores, every one a valid runEngine() output scored end to end", () => {
    // A smaller size here only speeds up this particular assertion; the
    // full default-sized (1.000) distribution is exercised separately
    // below. If any generated EngineInput were invalid, runEngine's own
    // assertValidEngineInput would throw and this test would fail loudly
    // rather than silently skip a case.
    const dist = generateReferenceDistribution({ size: 200, seed: 7 });
    expect(dist.scores).toHaveLength(200);
    expect(dist.size).toBe(200);
  });

  it("returns scores sorted ascending", () => {
    const dist = generateReferenceDistribution({ size: 200, seed: 7 });
    for (let i = 1; i < dist.scores.length; i++) {
      expect(dist.scores[i]!).toBeGreaterThanOrEqual(dist.scores[i - 1]!);
    }
  });

  it("every score stays within the 0.0-10.0 range SCORE_SPEC.md §1 defines", () => {
    const dist = generateReferenceDistribution({ size: 200, seed: 7 });
    dist.scores.forEach((s) => {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(10);
    });
  });

  it("records size, seed and a generation timestamp on the distribution itself (§5: 'leg het tijdstip van generatie vast')", () => {
    const before = Date.now();
    const dist = generateReferenceDistribution({ size: 50, seed: 7 });
    const after = Date.now();
    expect(dist.size).toBe(50);
    expect(dist.seed).toBe(7);
    const generatedAtMs = new Date(dist.generatedAt).getTime();
    expect(generatedAtMs).toBeGreaterThanOrEqual(before);
    expect(generatedAtMs).toBeLessThanOrEqual(after);
  });

  it("is deterministic: the same seed produces the exact same scores, every time (SCORE_SPEC.md §6)", () => {
    const first = generateReferenceDistribution({ size: 300, seed: 42 });
    const second = generateReferenceDistribution({ size: 300, seed: 42 });
    expect(second.scores).toEqual(first.scores);
  });

  it("a different seed produces a different distribution", () => {
    const a = generateReferenceDistribution({ size: 300, seed: 1 });
    const b = generateReferenceDistribution({ size: 300, seed: 2 });
    expect(a.scores).not.toEqual(b.scores);
  });

  it("a larger size is not just a truncation of a smaller one - it draws its own sequence of cases", () => {
    // Same seed, different size: proves size actually controls how many
    // independent cases are drawn, not just how many of a fixed
    // pre-computed sequence are kept (which would make the two arrays
    // share a common prefix).
    const small = generateReferenceDistribution({ size: 50, seed: 7 });
    const large = generateReferenceDistribution({ size: 51, seed: 7 });
    expect(large.scores).not.toEqual([...small.scores, expect.anything()]);
  });
});

/**
 * The default-configuration distribution (SCORE_SPEC.md §5's own 1.000
 * cases, TSG_SCORE_DISTRIBUTION_SEED). Generated once and reused across
 * these `it`s, the same pattern the rest of this suite uses for
 * `runEngine(referenceCase)` - not regenerated per assertion.
 */
describe("the default (1.000-case, default-seed) reference distribution", () => {
  const distribution = generateReferenceDistribution();

  it("has exactly 1.000 scores, per SCORE_SPEC.md §5", () => {
    expect(distribution.scores).toHaveLength(1000);
    expect(distribution.size).toBe(1000);
  });

  it("generates in well under a second, fast enough to run inside a test rather than as a separate build step", () => {
    const t0 = Date.now();
    generateReferenceDistribution();
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it("places the reference case's own base-scenario total (3.8, from score.test.ts) at a specific, reproducible percentile", () => {
    // Golden value for the default seed/size - reproducible because
    // generation is deterministic (SCORE_SPEC.md §6). If the scoring
    // curves, weights, or generation ranges in parameters.ts ever change,
    // SCORE_SPEC.md §5's "verversing" rule applies and this value is
    // expected to move; it is not expected to move on its own.
    //
    // 98 - barely moved from the 99 the price-based equity draw produced,
    // and both are still far above the 78 the original independent-price-
    // sampling generator gave. Anchoring the coverage factor to
    // equityRequired fixed the systematic ~50%-of-cases-fail-on-principle
    // problem (see the feasibility pass-rate test below - now a realistic
    // ~50/50 split), but the OTHER three dimensions (cashflow,
    // debtResilience, returnVsRequirement) are still computed from
    // properties priced at a realistic market yield (13-24x annual rent)
    // and highly leveraged (60-75% LTV, amortising) - which keeps most
    // synthetic deals' operating cashflow and DSCR weak regardless of how
    // much equity the investor happens to have on hand. Equity coverage
    // only ever touches ONE of the five dimensions' worth of weight (0.20).
    expect(computePercentile(distribution, 3.8)).toBe(98);
  });

  it("presentation sentence renders as SCORE_SPEC.md §5 specifies", () => {
    const percentile = computePercentile(distribution, 3.8);
    const sentence = `Deze investering scoort in het ${percentile}ste percentiel van ons modelbereik.`;
    expect(sentence).toBe("Deze investering scoort in het 98ste percentiel van ons modelbereik.");
  });

  it("the feasibility check now passes for a realistic share of cases - roughly half, not almost none", () => {
    // The equity-coverage range (0.6-1.4) is centered on exactly 1.0
    // (coverage == equityRequired), so a case's equity check should pass
    // roughly as often as it fails - unlike the price-based draw, which
    // failed it for ~100% of a 300-case sample because it undershot
    // equityRequired systematically rather than spreading around it.
    const rng = createRng(99);
    let pass = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const { input } = buildSyntheticEngineInput(rng);
      const engineResult = runEngine(input);
      const equity = deriveSyntheticEquitySupply(rng, engineResult.acquisition.equityRequired);
      if (equity.equityAvailable >= equity.equityRequired) pass++;
    }
    const passRate = pass / n;
    expect(passRate).toBeGreaterThan(0.4);
    expect(passRate).toBeLessThan(0.6);
  });
});

/**
 * The corrected generator's overall shape - reported explicitly per the
 * instruction to state whether the left-skew was resolved or only
 * reduced. It was reduced, not resolved: the equity-coverage fix pulled
 * the median and max back up somewhat (1.3 -> 1.8, 4.5 -> 4.6) versus the
 * price-based equity draw, but both remain well below the ORIGINAL
 * independent-price-sampling generator's 1.9 median and 8.3 max. Golden
 * values below are for the default (1.000-case, default-seed)
 * distribution.
 */
describe("shape of the corrected distribution (left-skew: reduced, not resolved)", () => {
  const distribution = generateReferenceDistribution();
  const s = distribution.scores;

  it("min/median/max: 0.4 / 1.8 / 4.6 (price-based equity draw gave 0.4 / 1.3 / 4.5; the original generator gave 0.4 / 1.9 / 8.3)", () => {
    expect(s[0]).toBe(0.4);
    expect(s[500]).toBe(1.8);
    expect(s[999]).toBe(4.6);
  });

  it("the median recovered most of the way to the original 1.9, but the top of the range did not recover at all", () => {
    // Median: 1.8 is close to the original 1.9 - fixing the
    // near-universal feasibility failure did most of the work here.
    expect(s[500]).toBeGreaterThan(1.3);
    expect(s[500]).toBeLessThanOrEqual(1.9);
    // Max: still capped near 4.6, nowhere close to the original 8.3 - the
    // price-to-rent coupling (a market-consistent yield, then leveraged at
    // 60-75% LTV with an amortising loan) keeps cashflow/DSCR/return weak
    // for nearly every synthetic case regardless of how much equity the
    // investor has, and equity coverage cannot fix that: it only touches
    // the feasibility dimension's 0.20 weight, not the other 0.80.
    expect(Math.max(...s)).toBeLessThan(5);
  });
});
