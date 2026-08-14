import { describe, expect, it } from "vitest";
import {
  TSG_SCORE_ANCHORS_CASHFLOW,
  TSG_SCORE_ANCHORS_DATA_CERTAINTY,
  TSG_SCORE_ANCHORS_DEBT_RESILIENCE,
  TSG_SCORE_ANCHORS_RETURN_VS_REQUIREMENT,
  TSG_SCORE_FEASIBILITY_LEVELS,
} from "@/lib/rules/es/parameters";
import type { ScoreAnchor, TsgScoreDimension } from "@/lib/rules/es/types";
import { SCORE_RULER_MAX, SCORE_RULER_MIN, SCORE_RULER_TICKS } from "../score-ruler-ticks";

/**
 * The anti-drift test score-ruler-ticks.ts's docstring promises. That module
 * hard-codes the tick positions instead of importing the anchors, because
 * the report renders client-side and parameters.ts must not reach the
 * browser. This file closes that loop from the other side: it runs in Node,
 * so it can import the real parameters and check the copy still matches.
 *
 * If an anchor's score ever moves, this fails - which is the point. The
 * duplication is deliberate; going out of sync is not.
 */
function scorePositions(anchors: readonly ScoreAnchor[]): number[] {
  return [...new Set(anchors.map((a) => a.score))].sort((a, b) => a - b);
}

const EXPECTED: Record<TsgScoreDimension, number[]> = {
  cashflow: scorePositions(TSG_SCORE_ANCHORS_CASHFLOW.value),
  debtResilience: scorePositions(TSG_SCORE_ANCHORS_DEBT_RESILIENCE.value),
  returnVsRequirement: scorePositions(TSG_SCORE_ANCHORS_RETURN_VS_REQUIREMENT.value),
  dataCertainty: scorePositions(TSG_SCORE_ANCHORS_DATA_CERTAINTY.value),
  // §2.4's four discrete levels, not a curve - see the module docstring.
  feasibility: [...new Set(Object.values(TSG_SCORE_FEASIBILITY_LEVELS.value))].sort(
    (a, b) => a - b,
  ),
};

describe("SCORE_RULER_TICKS - pinned to SCORE_SPEC §2's real anchors", () => {
  it.each(Object.keys(EXPECTED) as TsgScoreDimension[])(
    "%s ticks equal the sorted score positions of its anchor set",
    (dimension) => {
      expect(SCORE_RULER_TICKS[dimension]).toEqual(EXPECTED[dimension]);
    },
  );

  it("covers every dimension, with no extras", () => {
    expect(Object.keys(SCORE_RULER_TICKS).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it("keeps every tick inside the 0-10 scale, ascending and unique", () => {
    for (const ticks of Object.values(SCORE_RULER_TICKS)) {
      expect(ticks.length).toBeGreaterThan(1);
      expect([...ticks]).toEqual([...ticks].sort((a, b) => a - b));
      expect(new Set(ticks).size).toBe(ticks.length);
      for (const t of ticks) {
        expect(t).toBeGreaterThanOrEqual(SCORE_RULER_MIN);
        expect(t).toBeLessThanOrEqual(SCORE_RULER_MAX);
      }
    }
  });

  it("spans the full scale: every dimension's ruler starts at 0 and ends at 10", () => {
    for (const ticks of Object.values(SCORE_RULER_TICKS)) {
      expect(ticks[0]).toBe(SCORE_RULER_MIN);
      expect(ticks[ticks.length - 1]).toBe(SCORE_RULER_MAX);
    }
  });

  it("publishes only score positions - never an anchor's input threshold", () => {
    // The input side of the curve (euros, DSCR, percentage points, placeholder
    // counts) must not appear in the shipped tick data. Every anchor x that is
    // not coincidentally also a valid 0-10 score would be a leak; checking the
    // whole set at once is stricter than spot-checking a few.
    const inputValues = new Set(
      [
        ...TSG_SCORE_ANCHORS_CASHFLOW.value,
        ...TSG_SCORE_ANCHORS_DEBT_RESILIENCE.value,
        ...TSG_SCORE_ANCHORS_RETURN_VS_REQUIREMENT.value,
        ...TSG_SCORE_ANCHORS_DATA_CERTAINTY.value,
      ]
        .map((a) => a.x)
        .filter((x) => x < SCORE_RULER_MIN || x > SCORE_RULER_MAX),
    );
    const shipped = new Set(Object.values(SCORE_RULER_TICKS).flat());
    for (const x of inputValues) {
      expect(shipped.has(x)).toBe(false);
    }
  });
});
