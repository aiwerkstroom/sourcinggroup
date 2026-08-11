import { describe, expect, it } from "vitest";
import {
  ALL_PARAMETERS,
  BANK_FEE,
  BASE_OCCUPANCY_LONG_TERM,
  BASE_OCCUPANCY_SHORT_TERM,
  DEFAULT_BUILDING_SHARE_OF_VALUE,
  DEFAULT_MIN_REQUIRED_RETURN,
  DEFAULT_RENOVATION_IMPROVEMENT_SHARE,
  DEPRECIATION_BUILDING_SHARE,
  DEPRECIATION_SCENARIO_FACTORS,
  FINANCING_STRATEGIES,
  HYBRID_SHARE_LONG_TERM,
  HYBRID_SHARE_SHORT_TERM,
  INSURANCE_COSTS_ANNUAL,
  MAINTENANCE_RATE,
  PROJECTION_INTERIM_YEAR,
  PROJECTION_YEARS,
  PROPERTY_MANAGEMENT_FEE,
  RENOVATION_STRATEGIES,
  SCENARIOS,
  TOTAL_INSURANCE_ANNUAL,
  TOTAL_UTILITIES_PER_M2_ANNUAL,
  UTILITIES_PER_M2_ANNUAL,
} from "../parameters";
import { deriveParameter, weakestProvenance } from "../types";
import type { Parameter } from "../types";

/**
 * Provenance audit tests. The label lives on each parameter's type (see
 * types.ts, Parameter<T>), not in a comment, precisely so code can react
 * to it - these tests are that reaction: they inspect ALL_PARAMETERS
 * programmatically, the same way outcome.ts will (see the follow-up
 * correction that surfaces PLACEHOLDER usage in ScenarioOutcome).
 */
describe("parameter provenance audit", () => {
  it("every parameter has a non-empty name and a defined value", () => {
    expect(ALL_PARAMETERS.length).toBeGreaterThan(0);
    for (const p of ALL_PARAMETERS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.value).not.toBeUndefined();
    }
  });

  it("every SOURCED parameter carries a source and a date", () => {
    for (const p of ALL_PARAMETERS) {
      if (p.provenance === "SOURCED") {
        expect(p.source.length, `${p.name} has an empty source`).toBeGreaterThan(0);
        expect(p.date.length, `${p.name} has an empty date`).toBeGreaterThan(0);
      }
    }
  });

  it("every ESTIMATE and PLACEHOLDER parameter carries reasoning", () => {
    for (const p of ALL_PARAMETERS) {
      if (p.provenance === "ESTIMATE" || p.provenance === "PLACEHOLDER") {
        expect(p.reasoning.length, `${p.name} has empty reasoning`).toBeGreaterThan(0);
      }
    }
  });

  it("only recognizes the three provenance labels", () => {
    const allowed = new Set(["SOURCED", "ESTIMATE", "PLACEHOLDER"]);
    for (const p of ALL_PARAMETERS) {
      expect(allowed.has(p.provenance)).toBe(true);
    }
  });

  it("code can collect every PLACEHOLDER parameter by name (the point of the audit)", () => {
    const placeholders = ALL_PARAMETERS.filter((p) => p.provenance === "PLACEHOLDER").map(
      (p) => p.name,
    );
    // Spot-check a representative sample rather than the exact count, so
    // this test doesn't need updating every time a new placeholder is
    // added elsewhere - it only needs to prove the mechanism works.
    expect(placeholders).toContain("DEFAULT_BUILDING_SHARE_OF_VALUE");
    expect(placeholders).toContain("DEFAULT_RENOVATION_IMPROVEMENT_SHARE");
    expect(placeholders).toContain("DEFAULT_MIN_REQUIRED_RETURN");
    expect(placeholders).toContain("MAINTENANCE_RATE");
    expect(placeholders).toContain("BANK_FEE");
    expect(placeholders).toContain("RENOVATION_STRATEGIES.light.capex");
  });

  it("distribution: 25 SOURCED / 45 ESTIMATE / 30 PLACEHOLDER (SCORE_SPEC.md adds 7 scoring-curve + 11 distribution-generation ESTIMATEs)", () => {
    const counts = { SOURCED: 0, ESTIMATE: 0, PLACEHOLDER: 0 };
    for (const p of ALL_PARAMETERS) counts[p.provenance]++;
    expect(counts).toEqual({ SOURCED: 25, ESTIMATE: 45, PLACEHOLDER: 30 });
    expect(counts.SOURCED + counts.ESTIMATE + counts.PLACEHOLDER).toBe(ALL_PARAMETERS.length);
  });

  it("the scoring curves/weights and the distribution-generation ranges are ESTIMATE: model definitions, not claims about the world", () => {
    // SCORE_SPEC.md's curves say where TSG chose to put "a 5" and how much
    // each dimension counts; its §5 ranges say what universe of synthetic
    // cases the percentile is measured against. No external body publishes
    // either (so not SOURCED), and no future market data could verify them
    // (so not PLACEHOLDER, which is a reality claim awaiting verification)
    // - only a product decision can settle them. Same category as what
    // "conservative" means as a scenario.
    const scoreParameters = ALL_PARAMETERS.filter((p) => p.name.startsWith("TSG_SCORE_"));
    expect(scoreParameters).toHaveLength(18);
    for (const p of scoreParameters) {
      expect(p.provenance, `${p.name} should be ESTIMATE`).toBe("ESTIMATE");
    }
    // Consequence that matters: being ESTIMATE keeps them out of
    // placeholdersUsed, so the data-certainty dimension never discounts
    // the score for the existence of the scoring model itself.
    const placeholderNames = ALL_PARAMETERS.filter((p) => p.provenance === "PLACEHOLDER").map(
      (p) => p.name,
    );
    expect(placeholderNames.filter((n) => n.startsWith("TSG_SCORE_"))).toEqual([]);
  });

  it("spot-checks: values already flagged [BESLISSING] in MODEL_SPEC.md are PLACEHOLDER, not ESTIMATE", () => {
    expect(DEFAULT_BUILDING_SHARE_OF_VALUE.provenance).toBe("PLACEHOLDER");
    expect(DEFAULT_RENOVATION_IMPROVEMENT_SHARE.provenance).toBe("PLACEHOLDER");
    expect(DEFAULT_MIN_REQUIRED_RETURN.provenance).toBe("PLACEHOLDER");
    expect(RENOVATION_STRATEGIES.minimal.capex.provenance).toBe("PLACEHOLDER");
    expect(RENOVATION_STRATEGIES.light.capex.provenance).toBe("PLACEHOLDER");
    expect(RENOVATION_STRATEGIES.heavy.capex.provenance).toBe("PLACEHOLDER");
    // Kept only for phase-1 Excel parity, not a real-world claim.
    expect(DEPRECIATION_BUILDING_SHARE.provenance).toBe("PLACEHOLDER");
    // Replicated from the Excel with no explained derivation.
    expect(DEPRECIATION_SCENARIO_FACTORS.conservative.provenance).toBe("PLACEHOLDER");
    expect(DEPRECIATION_SCENARIO_FACTORS.base.provenance).toBe("PLACEHOLDER");
    expect(DEPRECIATION_SCENARIO_FACTORS.optimistic.provenance).toBe("PLACEHOLDER");
    // No external source cited in the Excel for these rates.
    expect(MAINTENANCE_RATE.provenance).toBe("PLACEHOLDER");
    expect(BANK_FEE.provenance).toBe("PLACEHOLDER");
  });

  it("spot-checks: rates with a real named external source are SOURCED", () => {
    expect(PROPERTY_MANAGEMENT_FEE.provenance).toBe("SOURCED");
    expect(PROPERTY_MANAGEMENT_FEE.source).toMatch(/Wise/);
  });

  it("spot-checks: TSG's own modeling conventions (not external facts) are ESTIMATE", () => {
    // How "conservative/base/optimistic" are defined is a product choice,
    // not a claim sourced from an external market study.
    expect(SCENARIOS.conservative.rentLevelMultiplier.provenance).toBe("ESTIMATE");
    expect(SCENARIOS.base.rentLevelMultiplier.provenance).toBe("ESTIMATE");
    expect(SCENARIOS.optimistic.rentLevelMultiplier.provenance).toBe("ESTIMATE");
    // Allocations/tier definitions, not claims about the world.
    expect(HYBRID_SHARE_LONG_TERM.provenance).toBe("ESTIMATE");
    expect(HYBRID_SHARE_SHORT_TERM.provenance).toBe("ESTIMATE");
    expect(FINANCING_STRATEGIES.low.ltv.provenance).toBe("ESTIMATE");
    expect(FINANCING_STRATEGIES.low.loanTermYears.provenance).toBe("ESTIMATE");
    expect(PROJECTION_YEARS.provenance).toBe("ESTIMATE");
    expect(PROJECTION_INTERIM_YEAR.provenance).toBe("ESTIMATE");
  });

  it("values genuinely in doubt were assigned PLACEHOLDER, not the more flattering ESTIMATE", () => {
    // DEPRECIATION_SCENARIO_FACTORS is replicated from the Excel without an
    // explained derivation - real doubt, so PLACEHOLDER per the audit rule
    // ("bij twijfel PLACEHOLDER"), not ESTIMATE.
    for (const factor of Object.values(DEPRECIATION_SCENARIO_FACTORS)) {
      expect(factor.provenance).toBe("PLACEHOLDER");
    }
  });

  describe("herclassificatie: reality-vs-model test applied to the 41 former ESTIMATEs", () => {
    it("occupancy baselines make a claim about the real market, not the model: reclassified to PLACEHOLDER", () => {
      // BASE_OCCUPANCY_LONG_TERM/SHORT_TERM claim an achievable real-world
      // occupancy rate - a reality claim with no external citation, so it
      // cannot be ESTIMATE regardless of how deliberate the Excel's choice
      // was.
      expect(BASE_OCCUPANCY_LONG_TERM.provenance).toBe("PLACEHOLDER");
      expect(BASE_OCCUPANCY_SHORT_TERM.provenance).toBe("PLACEHOLDER");
    });

    it("renovation multipliers claim a real-world consequence, not a tier definition: reclassified to PLACEHOLDER", () => {
      // rentMultiplier/maintenanceFactor/utilitiesEfficiency/timeToRentMonths
      // each claim what actually happens to rent, maintenance cost,
      // utility cost, or lease-up time as a RESULT of doing that
      // renovation - a real-world causal claim, unlike e.g. a financing
      // tier's LTV, which merely defines where TSG drew that tier's
      // boundary.
      for (const strategy of Object.values(RENOVATION_STRATEGIES)) {
        expect(strategy.rentMultiplier.provenance).toBe("PLACEHOLDER");
        expect(strategy.maintenanceFactor.provenance).toBe("PLACEHOLDER");
        expect(strategy.utilitiesEfficiency.provenance).toBe("PLACEHOLDER");
        expect(strategy.timeToRentMonths.provenance).toBe("PLACEHOLDER");
      }
    });

    it("financing tier definitions (LTV, term) remain ESTIMATE: they define the tier, not a market fact", () => {
      // Unlike the renovation multipliers above, LTV/loanTermYears ARE the
      // definition of "what counts as Low/Medium/High Leverage" - a
      // product-tier boundary TSG chose, not a claim that this specific
      // LTV or term is what the market generally offers (that claim, the
      // interest rate, is separately SOURCED).
      for (const strategy of Object.values(FINANCING_STRATEGIES)) {
        expect(strategy.ltv.provenance).toBe("ESTIMATE");
        expect(strategy.loanTermYears.provenance).toBe("ESTIMATE");
        expect(strategy.interestRate.provenance).toBe("SOURCED");
      }
    });

    it("scenario severity multipliers remain ESTIMATE: they define what a scenario means, not a market fact", () => {
      for (const scenario of Object.values(SCENARIOS)) {
        expect(scenario.rentLevelMultiplier.provenance).toBe("ESTIMATE");
        expect(scenario.occupancyMultiplier.provenance).toBe("ESTIMATE");
        expect(scenario.interestRateDelta.provenance).toBe("ESTIMATE");
        expect(scenario.utilitiesMultiplier.provenance).toBe("ESTIMATE");
        expect(scenario.maintenanceInflationMultiplier.provenance).toBe("ESTIMATE");
      }
    });

    it("moved list: exactly these 14 parameters were reclassified from ESTIMATE to PLACEHOLDER", () => {
      const moved = [
        BASE_OCCUPANCY_LONG_TERM.name,
        BASE_OCCUPANCY_SHORT_TERM.name,
        ...Object.values(RENOVATION_STRATEGIES).flatMap((s) => [
          s.rentMultiplier.name,
          s.maintenanceFactor.name,
          s.utilitiesEfficiency.name,
          s.timeToRentMonths.name,
        ]),
      ];
      expect(moved).toHaveLength(14);
      for (const name of moved) {
        const param = ALL_PARAMETERS.find((p) => p.name === name);
        expect(param, `${name} missing from ALL_PARAMETERS`).toBeDefined();
        expect(param!.provenance, `${name} should now be PLACEHOLDER`).toBe("PLACEHOLDER");
      }
    });
  });
});

describe("derived values: weakest-link provenance", () => {
  it("weakestProvenance() ranks PLACEHOLDER < ESTIMATE < SOURCED", () => {
    expect(weakestProvenance(["SOURCED"])).toBe("SOURCED");
    expect(weakestProvenance(["SOURCED", "SOURCED"])).toBe("SOURCED");
    expect(weakestProvenance(["SOURCED", "ESTIMATE"])).toBe("ESTIMATE");
    expect(weakestProvenance(["SOURCED", "PLACEHOLDER"])).toBe("PLACEHOLDER");
    expect(weakestProvenance(["ESTIMATE", "PLACEHOLDER"])).toBe("PLACEHOLDER");
    expect(weakestProvenance(["SOURCED", "ESTIMATE", "PLACEHOLDER"])).toBe("PLACEHOLDER");
    expect(weakestProvenance(["ESTIMATE", "ESTIMATE"])).toBe("ESTIMATE");
  });

  it("deriveParameter() takes the weakest of its components, not the first or last", () => {
    const sourced: Parameter<number> = {
      name: "test.sourced",
      value: 1,
      provenance: "SOURCED",
      source: "Test Source",
      date: "2025",
    };
    const placeholder: Parameter<number> = {
      name: "test.placeholder",
      value: 2,
      provenance: "PLACEHOLDER",
      reasoning: "test reasoning",
    };
    // Placeholder listed last: the result must still be dragged down to
    // PLACEHOLDER, proving this isn't just "inherit the last component".
    const derived = deriveParameter("test.derived", 3, [sourced, placeholder]);
    expect(derived.provenance).toBe("PLACEHOLDER");
  });

  it("deriveParameter() stays SOURCED only when every component is SOURCED", () => {
    const a: Parameter<number> = { name: "a", value: 1, provenance: "SOURCED", source: "A", date: "2025" };
    const b: Parameter<number> = { name: "b", value: 2, provenance: "SOURCED", source: "B", date: "2024" };
    const derived = deriveParameter("sum", 3, [a, b]);
    expect(derived.provenance).toBe("SOURCED");
  });

  it("a derived value cannot silently drift: TOTAL_INSURANCE_ANNUAL matches deriveParameter(INSURANCE_COSTS_ANNUAL)", () => {
    // If INSURANCE_COSTS_ANNUAL is ever reclassified (e.g. to PLACEHOLDER
    // because one of its cited sources turns out to be unreliable), this
    // test fails unless TOTAL_INSURANCE_ANNUAL - built via deriveParameter,
    // not a hand-typed literal - is regenerated to match. The label cannot
    // go stale without a test catching it.
    expect(TOTAL_INSURANCE_ANNUAL.provenance).toBe(
      weakestProvenance([INSURANCE_COSTS_ANNUAL.provenance]),
    );
  });

  it("a derived value cannot silently drift: TOTAL_UTILITIES_PER_M2_ANNUAL matches deriveParameter(UTILITIES_PER_M2_ANNUAL)", () => {
    expect(TOTAL_UTILITIES_PER_M2_ANNUAL.provenance).toBe(
      weakestProvenance([UTILITIES_PER_M2_ANNUAL.provenance]),
    );
  });

  it("simulated downgrade: if the insurance component became PLACEHOLDER, the derived total would follow", () => {
    // Proves the mechanism reacts to a hypothetical future downgrade,
    // without actually mutating the real parameter.
    const hypotheticallyDowngraded: Parameter<{ home: number }> = {
      name: "INSURANCE_COSTS_ANNUAL",
      value: { home: 300 },
      provenance: "PLACEHOLDER",
      reasoning: "hypothetical: a cited source turned out to be unreliable",
    };
    const derivedTotal = deriveParameter("TOTAL_INSURANCE_ANNUAL", 300, [
      hypotheticallyDowngraded,
    ]);
    expect(derivedTotal.provenance).toBe("PLACEHOLDER");
  });
});
