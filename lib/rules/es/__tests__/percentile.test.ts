import { describe, expect, it } from "vitest";
import {
  assertValidScoreDistribution,
  computePercentile,
  parseScoreDistribution,
  serializeScoreDistribution,
} from "../percentile";
import type { ScoreDistribution } from "../types";

function distributionOf(scores: readonly number[]): ScoreDistribution {
  return {
    scores: [...scores].sort((a, b) => a - b),
    size: scores.length,
    generatedAt: "2026-08-11T00:00:00.000Z",
    seed: 1,
  };
}

describe("computePercentile() (SCORE_SPEC.md §5)", () => {
  it("matches the spec's own worked example: 320 of 1.000 lower scores gives percentile 32", () => {
    // 320 scores strictly below 4.4, 680 at or above.
    const scores = [
      ...Array.from({ length: 320 }, (_, i) => 1 + i * 0.001), // well below 4.4
      ...Array.from({ length: 680 }, (_, i) => 5 + i * 0.001), // at/above 4.4
    ];
    const dist = distributionOf(scores);
    expect(computePercentile(dist, 4.4)).toBe(32);
  });

  it("is the share strictly below, not at-or-below: a score tied with several others does not count itself", () => {
    const dist = distributionOf([1, 2, 2, 2, 3, 4]);
    // Two scores (both 1's... only one 1) strictly below 2: just the single 1.
    // 1 of 6 -> floor(16.67) = 16.
    expect(computePercentile(dist, 2)).toBe(16);
  });

  it("a score below every case in the distribution is percentile 0", () => {
    const dist = distributionOf([5, 6, 7, 8]);
    expect(computePercentile(dist, 1)).toBe(0);
    expect(computePercentile(dist, 5)).toBe(0); // tied with the minimum: nothing is strictly below it
  });

  it("a score at or above every case in the distribution clamps to 99, never 100", () => {
    const dist = distributionOf(Array.from({ length: 1000 }, (_, i) => i / 100));
    expect(computePercentile(dist, 1000)).toBe(99);
    // Even the distribution's own maximum value: floor(999/1000*100) = 99.
    expect(computePercentile(dist, dist.scores[dist.scores.length - 1]!)).toBe(99);
  });

  it("evenly spaced deciles land on the expected tens", () => {
    const dist = distributionOf(Array.from({ length: 100 }, (_, i) => i));
    // 30 values (0..29) are strictly below 30.
    expect(computePercentile(dist, 30)).toBe(30);
    expect(computePercentile(dist, 0)).toBe(0);
    expect(computePercentile(dist, 99)).toBe(99);
  });

  it("throws on an empty distribution rather than reporting a meaningless percentage", () => {
    expect(() => computePercentile(distributionOf([]), 5)).toThrow(/non-empty/);
  });

  it("throws on a non-finite score", () => {
    const dist = distributionOf([1, 2, 3]);
    expect(() => computePercentile(dist, NaN)).toThrow(/non-finite/);
    expect(() => computePercentile(dist, Infinity)).toThrow(/non-finite/);
  });

  it("is stable across distribution sizes: doubling every count leaves the percentile unchanged", () => {
    const small = distributionOf([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const doubled = distributionOf([
      ...small.scores,
      ...small.scores.map((s) => s + 0.0001),
    ]);
    expect(computePercentile(small, 5)).toBe(computePercentile(doubled, 5));
  });
});

describe("assertValidScoreDistribution() / parse / serialize (SCORE_SPEC.md §6)", () => {
  it("round-trips a valid distribution through JSON", () => {
    const dist = distributionOf([0.4, 1.2, 3.8, 5.5, 9.9]);
    const json = serializeScoreDistribution(dist);
    const parsed = parseScoreDistribution(json);
    expect(parsed).toEqual(dist);
  });

  it("accepts a well-formed distribution", () => {
    expect(() => assertValidScoreDistribution(distributionOf([0, 5, 10]))).not.toThrow();
  });

  it("rejects a size that does not match scores.length", () => {
    const dist = { ...distributionOf([1, 2, 3]), size: 5 };
    expect(() => assertValidScoreDistribution(dist)).toThrow(/size/);
  });

  it("rejects a score outside the 0-10 range", () => {
    const dist = distributionOf([1, 2, 3]);
    expect(() => assertValidScoreDistribution({ ...dist, scores: [-0.1, 2, 3] })).toThrow(
      /0-10/,
    );
    expect(() => assertValidScoreDistribution({ ...dist, scores: [1, 2, 10.1] })).toThrow(
      /0-10/,
    );
  });

  it("rejects scores that are not ascending", () => {
    const dist = distributionOf([1, 2, 3]);
    expect(() =>
      assertValidScoreDistribution({ ...dist, scores: [3, 2, 1], size: 3 }),
    ).toThrow(/ascending/);
  });

  it("parseScoreDistribution surfaces the same validation on malformed JSON text", () => {
    const badJson = JSON.stringify({
      scores: [3, 1, 2],
      size: 3,
      generatedAt: "2026-08-11T00:00:00.000Z",
      seed: 1,
    });
    expect(() => parseScoreDistribution(badJson)).toThrow(/ascending/);
  });
});
