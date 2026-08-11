import { describe, expect, it } from "vitest";
import { rentalStrategyAvailability, TOURIST_LICENSE_REQUIRED_REASON } from "../licensing";

describe("rentalStrategyAvailability() - título habilitante gate (MODEL_SPEC.md §18)", () => {
  it("with a valid license: all three strategies available, none excluded", () => {
    const result = rentalStrategyAvailability(true);
    expect(result.available).toEqual(["longTerm", "shortTerm", "hybrid"]);
    expect(result.unavailable).toEqual([]);
  });

  it("without a license: only longTerm available - shortTerm/hybrid absent, not zeroed", () => {
    const result = rentalStrategyAvailability(false);
    expect(result.available).toEqual(["longTerm"]);
    // "They don't appear" - not present in `available` at all, whatever
    // their value would have been.
    expect(result.available).not.toContain("shortTerm");
    expect(result.available).not.toContain("hybrid");
  });

  it("without a license: shortTerm and hybrid are listed in `unavailable` with a reason, so a report can explain the absence", () => {
    const result = rentalStrategyAvailability(false);
    expect(result.unavailable).toHaveLength(2);
    const strategies = result.unavailable.map((u) => u.strategy);
    expect(strategies).toEqual(["shortTerm", "hybrid"]);
    result.unavailable.forEach((u) => {
      expect(u.reason).toBe(TOURIST_LICENSE_REQUIRED_REASON);
      expect(u.reason).toMatch(/título habilitante/);
    });
  });
});
