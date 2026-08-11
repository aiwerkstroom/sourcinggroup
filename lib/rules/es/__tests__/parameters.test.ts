import { describe, expect, it } from "vitest";
import {
  ALL_PARAMETERS,
  BANK_FEE,
  DEFAULT_BUILDING_SHARE_OF_VALUE,
  DEFAULT_MIN_REQUIRED_RETURN,
  DEFAULT_RENOVATION_IMPROVEMENT_SHARE,
  DEPRECIATION_BUILDING_SHARE,
  DEPRECIATION_SCENARIO_FACTORS,
  MAINTENANCE_RATE,
  PROPERTY_MANAGEMENT_FEE,
  RENOVATION_STRATEGIES,
  SCENARIOS,
} from "../parameters";

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
  });

  it("values genuinely in doubt were assigned PLACEHOLDER, not the more flattering ESTIMATE", () => {
    // DEPRECIATION_SCENARIO_FACTORS is replicated from the Excel without an
    // explained derivation - real doubt, so PLACEHOLDER per the audit rule
    // ("bij twijfel PLACEHOLDER"), not ESTIMATE.
    for (const factor of Object.values(DEPRECIATION_SCENARIO_FACTORS)) {
      expect(factor.provenance).toBe("PLACEHOLDER");
    }
  });
});
