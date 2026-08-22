import { describe, expect, it } from "vitest";
import { runEngine } from "../engine";
import { PROJECTION_YEARS } from "../parameters";
import { referenceCase } from "./referencecase";

/**
 * Golden test for datakwaliteitsfix stap 4: an upcoming community special
 * assessment (derrama), optionally supplied via PropertyInput.
 * upcomingDerramasEstimate, spread evenly over PROJECTION_YEARS.value and
 * folded into the same fixed-cost pipeline gastos de comunidad already
 * runs through (operating.ts, scenarios.ts, tax.ts, projection.ts).
 *
 * Two paths, both anchored on the reference case (Avenida Primado Reig 19)
 * so the "unchecked" path is provably identical to every other golden test
 * in this suite, and the "checked with amount" path is provably just that
 * same result plus the spread derrama, nothing else moved.
 */
describe("derramas: not given (the wizard checkbox left unticked)", () => {
  it("referenceCase itself sets no upcomingDerramasEstimate - the anchor is unaffected by this fix", () => {
    expect(referenceCase.property.upcomingDerramasEstimate).toBeUndefined();
    const result = runEngine(referenceCase);
    expect(result.fixedOperatingCosts.derramas).toBe(0);
    expect(result.fixedOperatingCosts.total).toBeCloseTo(13745, 9);
  });
});

describe("derramas: given (the wizard checkbox ticked, with an estimated amount)", () => {
  const withDerrama = {
    ...referenceCase,
    property: { ...referenceCase.property, upcomingDerramasEstimate: 5_000 },
  };
  const plain = runEngine(referenceCase);
  const result = runEngine(withDerrama);

  it("spreads the total evenly over PROJECTION_YEARS.value: 5000 / 10 = 500/yr", () => {
    expect(PROJECTION_YEARS.value).toBe(10);
    expect(result.fixedOperatingCosts.derramas).toBe(500);
  });

  it("adds exactly the spread amount to fixedOperatingCosts.total, nothing else moves", () => {
    expect(result.fixedOperatingCosts.propertyTaxIBI).toBe(plain.fixedOperatingCosts.propertyTaxIBI);
    expect(result.fixedOperatingCosts.insurance).toBe(plain.fixedOperatingCosts.insurance);
    expect(result.fixedOperatingCosts.communityFees).toBe(plain.fixedOperatingCosts.communityFees);
    expect(result.fixedOperatingCosts.mortgageInterest).toBeCloseTo(
      plain.fixedOperatingCosts.mortgageInterest,
      9,
    );
    expect(result.fixedOperatingCosts.total).toBeCloseTo(plain.fixedOperatingCosts.total + 500, 9);
  });

  it("the extra 500/yr reaches every scenario's fixedCosts and lowers NOI by exactly that much (exploitatiekosten)", () => {
    for (const scenarioId of ["conservative", "base", "optimistic"] as const) {
      const before = plain.scenarios.find((s) => s.id === scenarioId)!;
      const after = result.scenarios.find((s) => s.id === scenarioId)!;
      expect(after.fixedCosts).toBeCloseTo(before.fixedCosts + 500, 9);
      expect(after.noi).toBeCloseTo(before.noi - 500, 7);
    }
  });

  it("is deductible from the taxable base, same category as gastos de comunidad (tax.ts)", () => {
    expect(result.tax.deductibleCostsBase).toBeCloseTo(plain.tax.deductibleCostsBase + 500, 7);
  });

  it("appears in every projected year at the flat 500/yr, not CPI-indexed like communityFees is", () => {
    const before = plain.scenarioOutcomes!.find((o) => o.scenario === "base")!;
    const after = result.scenarioOutcomes!.find((o) => o.scenario === "base")!;
    for (let i = 0; i < after.years.length; i += 1) {
      const beforeYear = before.years[i]!;
      const afterYear = after.years[i]!;
      // ScenarioProjectionYear does not carry the individual cost lines,
      // only cashflowAfterTax and noi - the fixed 500/yr shows up as a
      // uniform gap between the two runs across every single year, which
      // an indexed (growing) figure could not produce.
      expect(afterYear.noi).toBeLessThan(beforeYear.noi);
      expect(beforeYear.noi - afterYear.noi).toBeCloseTo(500, 6);
    }
  });

  it("does not change which scenario the score/percentile were computed for - the reference anchor moves only because the cost genuinely changed", () => {
    // Sanity check that this is a real, expected change in the report, not
    // an accidental one: the base scenario's score is free to move because
    // the underlying cashflow really is 500/yr worse, but the calculation
    // must still run end to end without throwing.
    const base = result.scenarioOutcomes!.find((o) => o.scenario === "base")!;
    expect(base.score).not.toBeNull();
    expect(base.percentile).not.toBeNull();
  });
});
