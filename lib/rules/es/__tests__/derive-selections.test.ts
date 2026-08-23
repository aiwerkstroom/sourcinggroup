import { describe, expect, it } from "vitest";
import {
  deriveFinancingStrategy,
  deriveRenovationStrategy,
  resolveRenovationTier,
} from "../derive-selections";
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

/**
 * Fase C stap 1. The tier itself was already covered above; what is new
 * here is that the *provenance* record is right, including in the two
 * cases a naive implementation gets wrong: the derived value must survive
 * an override (so the report can contrast them), and a customer choosing
 * the tier the lookup would also have produced must still read as a
 * choice.
 */
describe("resolveRenovationTier - the tier plus how it was arrived at (fase C stap 1)", () => {
  it("falls back to the derivation, and says so, when no override is given", () => {
    for (const condition of ["good", "average", "poor"] as const) {
      const { strategy, provenance } = resolveRenovationTier({ maintenanceCondition: condition });
      expect(strategy).toBe(deriveRenovationStrategy(condition));
      expect(provenance.status).toBe("derived");
      expect(provenance.derivedValue).toBe(deriveRenovationStrategy(condition));
    }
  });

  it("uses the override, and marks it as the customer's, when one is given", () => {
    const { strategy, provenance } = resolveRenovationTier({
      maintenanceCondition: "average",
      override: "heavy",
    });
    expect(strategy).toBe("heavy");
    expect(provenance.status).toBe("customerChosen");
  });

  it("keeps carrying what the derivation would have said, even when overridden", () => {
    // The whole reason the report can say "u koos grondig; afgeleid was
    // licht" - drop this and the override becomes unauditable.
    const { provenance } = resolveRenovationTier({
      maintenanceCondition: "average",
      override: "heavy",
    });
    expect(provenance.derivedValue).toBe("light");
    expect(provenance.derivedValue).toBe(deriveRenovationStrategy("average"));
  });

  it("reads as a choice even when the customer picks exactly what the derivation would have", () => {
    // The improvement over the comparison-based statuses
    // (ListingFieldProvenanceStatus): an explicit pick is a real signal, so
    // it does not silently collapse into "derived" the way a retyped
    // listing value collapses into "fromListing".
    const { strategy, provenance } = resolveRenovationTier({
      maintenanceCondition: "average",
      override: "light",
    });
    expect(strategy).toBe("light");
    expect(provenance.status).toBe("customerChosen");
    expect(provenance.derivedValue).toBe("light");
  });

  it("an override never changes the tier's own parameters - only which tier applies", () => {
    // The ESTIMATE-vs-PLACEHOLDER laundering guard: choosing a tier
    // explicitly must not upgrade that tier's unverified multipliers.
    const { strategy } = resolveRenovationTier({
      maintenanceCondition: "good",
      override: "heavy",
    });
    for (const field of ["capex", "rentMultiplier", "maintenanceFactor", "utilitiesEfficiency"] as const) {
      expect(RENOVATION_STRATEGIES[strategy][field].provenance).toBe("PLACEHOLDER");
    }
  });
});
