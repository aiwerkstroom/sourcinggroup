import { describe, expect, it } from "vitest";
import { deriveFinancingStrategy, deriveRenovationStrategy } from "../derive-selections";
import {
  FINANCING_STRATEGIES,
  FINANCING_TIER_SELECTION_TIE_BREAK,
  RENOVATION_TIER_BY_MAINTENANCE_CONDITION,
} from "../parameters";
import { RENOVATION_STRATEGIES } from "../parameters";

describe("deriveRenovationStrategy - staat van onderhoud -> renovation tier", () => {
  it("maps all three conditions exactly as RENOVATION_TIER_BY_MAINTENANCE_CONDITION defines", () => {
    expect(deriveRenovationStrategy("good")).toBe("minimal");
    expect(deriveRenovationStrategy("average")).toBe("light");
    expect(deriveRenovationStrategy("poor")).toBe("heavy");
  });

  it("reads the parameter rather than hardcoding the mapping a second time", () => {
    for (const condition of ["good", "average", "poor"] as const) {
      expect(deriveRenovationStrategy(condition)).toBe(
        RENOVATION_TIER_BY_MAINTENANCE_CONDITION.value[condition],
      );
    }
  });

  it("the mapping is a claim about the world, so it is PLACEHOLDER, not ESTIMATE", () => {
    expect(RENOVATION_TIER_BY_MAINTENANCE_CONDITION.provenance).toBe("PLACEHOLDER");
  });

  it("is a straight 1:1 lookup to all three existing tiers, no collapsing", () => {
    const mapped = new Set(Object.values(RENOVATION_TIER_BY_MAINTENANCE_CONDITION.value));
    expect(mapped).toEqual(new Set(["minimal", "light", "heavy"]));
  });
});

describe("deriveFinancingStrategy - gewenste LTV -> financing tier", () => {
  it("picks the exact tier when preferredLtv equals one of the three LTVs", () => {
    expect(deriveFinancingStrategy(FINANCING_STRATEGIES.low.ltv.value)).toBe("low");
    expect(deriveFinancingStrategy(FINANCING_STRATEGIES.medium.ltv.value)).toBe("medium");
    expect(deriveFinancingStrategy(FINANCING_STRATEGIES.high.ltv.value)).toBe("high");
  });

  it("picks the nearest tier off the midpoints", () => {
    expect(deriveFinancingStrategy(0.5)).toBe("low");
    expect(deriveFinancingStrategy(0.63)).toBe("low");
    expect(deriveFinancingStrategy(0.68)).toBe("medium");
    expect(deriveFinancingStrategy(0.71)).toBe("medium");
    expect(deriveFinancingStrategy(0.74)).toBe("high");
    expect(deriveFinancingStrategy(0.8)).toBe("high");
  });

  it("breaks the two exact ties (0.65, 0.725) toward the higher tier, per the parameter", () => {
    expect(FINANCING_TIER_SELECTION_TIE_BREAK.value).toBe("higher");
    // 0.65 is exactly midway between low (0.6) and medium (0.7).
    expect(deriveFinancingStrategy(0.65)).toBe("medium");
    // 0.725 is exactly midway between medium (0.7) and high (0.75).
    expect(deriveFinancingStrategy(0.725)).toBe("high");
  });

  it("the tie-break is a product convention, so it is ESTIMATE", () => {
    expect(FINANCING_TIER_SELECTION_TIE_BREAK.provenance).toBe("ESTIMATE");
  });

  it("does not decide loan term via a fourth, invented number - it reads FINANCING_STRATEGIES directly", () => {
    // The whole point of this derivation: loanTermYears (25/20/15) is only
    // available per named tier, not as a function of LTV, so the derived
    // tier id must be usable as a key into FINANCING_STRATEGIES unchanged.
    const tier = deriveFinancingStrategy(0.68);
    expect(FINANCING_STRATEGIES[tier].loanTermYears.value).toBe(
      FINANCING_STRATEGIES.medium.loanTermYears.value,
    );
  });
});

describe("both derivations feed straight into the existing tier tables, nothing new to score with", () => {
  it("every RenovationStrategyId the derivation can return exists in RENOVATION_STRATEGIES", () => {
    for (const condition of ["good", "average", "poor"] as const) {
      const tier = deriveRenovationStrategy(condition);
      expect(RENOVATION_STRATEGIES[tier]).toBeDefined();
    }
  });

  it("every FinancingStrategyId the derivation can return exists in FINANCING_STRATEGIES", () => {
    for (const ltv of [0.0, 0.3, 0.6, 0.65, 0.7, 0.725, 0.75, 1.0]) {
      const tier = deriveFinancingStrategy(ltv);
      expect(FINANCING_STRATEGIES[tier]).toBeDefined();
    }
  });
});
