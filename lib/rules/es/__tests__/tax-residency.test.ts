import { describe, expect, it } from "vitest";
import { runEngine } from "@/lib/rules/es/engine";
import { referenceCase } from "./referencecase";
import { rentalIncomeTaxTreatment } from "../tax";
import type { EngineInput, TaxResidency } from "../types";

/**
 * Golden test for the tax-residency correction.
 *
 * THE BUG THIS PINS. The engine switched the rental income tax RATE on
 * residency (19% EU / 24% non-EU) but always computed the taxable base as
 * gross income minus deductible costs. Under Spanish IRNR that base is
 * only available to EU/EEA residents; a non-EU resident is taxed on GROSS
 * rent with no deductions at all. Modelling the rate alone understated
 * their tax by a factor of two to three - enough to turn a report's
 * conclusion upside down for that group.
 *
 * Two things are checked, and the second matters as much as the first:
 *
 *  1. The three options really do produce different, correctly-ordered
 *     tax figures, on both the year-1 calculation and the ten-year
 *     projection.
 *  2. The NL/EU path is bit-for-bit what it was before this change. That
 *     was the implicit assumption until now, so if it moved, this
 *     "correction" would silently have altered every report already
 *     issued - the reference case's own anchor (base score 3,8 at
 *     percentile 70) is the tripwire for that.
 */

function withResidency(taxResidency: TaxResidency): EngineInput {
  return {
    ...referenceCase,
    selections: { ...referenceCase.selections, taxResidency },
  };
}

const EU_RATE = 0.19;
const NON_EU_RATE = 0.24;

describe("the treatment helper - one place decides rate AND base", () => {
  it("gives EU residents 19% on net income", () => {
    for (const taxResidency of ["netherlands", "otherEu"] as const) {
      expect(rentalIncomeTaxTreatment({ taxResidency })).toEqual({
        rate: EU_RATE,
        deductionsAllowed: true,
      });
    }
  });

  it("gives non-EU residents 24% on gross income", () => {
    expect(rentalIncomeTaxTreatment({ taxResidency: "nonEu" })).toEqual({
      rate: NON_EU_RATE,
      deductionsAllowed: false,
    });
  });

  it("falls back to EU treatment when nothing is supplied - the assumption this replaced", () => {
    expect(rentalIncomeTaxTreatment({})).toEqual({ rate: EU_RATE, deductionsAllowed: true });
  });

  it("still honours the legacy euResident flag when taxResidency is absent", () => {
    expect(rentalIncomeTaxTreatment({ euResident: false })).toEqual({
      rate: NON_EU_RATE,
      deductionsAllowed: false,
    });
    expect(rentalIncomeTaxTreatment({ euResident: true })).toEqual({
      rate: EU_RATE,
      deductionsAllowed: true,
    });
  });

  it("lets taxResidency win over a contradicting euResident", () => {
    expect(rentalIncomeTaxTreatment({ taxResidency: "nonEu", euResident: true }).rate).toBe(
      NON_EU_RATE,
    );
    expect(rentalIncomeTaxTreatment({ taxResidency: "netherlands", euResident: false }).rate).toBe(
      EU_RATE,
    );
  });
});

describe("the reference case through all three options", () => {
  const nl = runEngine(withResidency("netherlands"));
  const eu = runEngine(withResidency("otherEu"));
  const nonEu = runEngine(withResidency("nonEu"));

  it("Nederland and ander EU-land are identical - Spain does not distinguish them", () => {
    expect(nl.tax).toEqual(eu.tax);
    expect(nl.scenarioOutcomes![1]!.irr).toEqual(eu.scenarioOutcomes![1]!.irr);
  });

  it("taxes EU residents on net income", () => {
    expect(nl.tax.deductionsAllowed).toBe(true);
    expect(nl.tax.taxRate).toBe(EU_RATE);
    expect(nl.tax.taxableIncomeBase).toBeCloseTo(
      nl.tax.grossRentalIncomeBase - nl.tax.deductibleCostsBase,
      6,
    );
  });

  it("taxes non-EU residents on GROSS income - the half that was missing", () => {
    expect(nonEu.tax.deductionsAllowed).toBe(false);
    expect(nonEu.tax.taxRate).toBe(NON_EU_RATE);
    expect(nonEu.tax.taxableIncomeBase).toBeCloseTo(nonEu.tax.grossRentalIncomeBase, 6);
    // The costs are still real and still reported - they simply do not
    // reduce what Spain taxes.
    expect(nonEu.tax.deductibleCostsBase).toBeCloseTo(nl.tax.deductibleCostsBase, 6);
    expect(nonEu.tax.deductibleCostsBase).toBeGreaterThan(0);
  });

  it("produces materially more tax for a non-EU investor, not merely 24/19ths more", () => {
    const ratio = nonEu.tax.taxDueBase / nl.tax.taxDueBase;

    // If only the rate had changed, this would be 24/19 = 1,26. The base
    // change is what makes it multiples - which is the whole reason this
    // field had to be asked rather than assumed.
    expect(ratio).toBeGreaterThan(2);
    expect(nonEu.tax.taxDueBase).toBeGreaterThan(nl.tax.taxDueBase);
  });

  it("carries through to the after-tax cashflow and the IRR", () => {
    const nlBase = nl.scenarioOutcomes!.find((o) => o.scenario === "base")!;
    const nonEuBase = nonEu.scenarioOutcomes!.find((o) => o.scenario === "base")!;

    // Every projected year is taxed more heavily, so every year's
    // after-tax cashflow is lower. ScenarioProjectionYear does not expose
    // taxDue - the outcome's year rows are a trimmed public view - so
    // cashflowAfterTax is where the difference is observable, which is
    // also where it matters to the customer.
    expect(nlBase.years.length).toBeGreaterThan(0);
    for (let i = 0; i < nlBase.years.length; i += 1) {
      expect(nonEuBase.years[i]!.cashflowAfterTax).toBeLessThan(
        nlBase.years[i]!.cashflowAfterTax,
      );
    }

    // ...and the return follows it down.
    expect(nlBase.irr.defined).toBe(true);
    expect(nonEuBase.irr.defined).toBe(true);
    if (nlBase.irr.defined && nonEuBase.irr.defined) {
      expect(nonEuBase.irr.irr).toBeLessThan(nlBase.irr.irr);
    }
    expect(nonEuBase.score!.total).toBeLessThan(nlBase.score!.total);
  });

  it("names the rate it actually applied in the report's assumptions", () => {
    const nlNames = nl.scenarioOutcomes![1]!.assumptionsUsed.map((p) => p.name);
    const nonEuNames = nonEu.scenarioOutcomes![1]!.assumptionsUsed.map((p) => p.name);

    expect(nlNames).toContain("RENTAL_INCOME_TAX_RATE_EU");
    expect(nlNames).not.toContain("RENTAL_INCOME_TAX_RATE_NON_EU");
    expect(nonEuNames).toContain("RENTAL_INCOME_TAX_RATE_NON_EU");
    expect(nonEuNames).not.toContain("RENTAL_INCOME_TAX_RATE_EU");
  });
});

describe("existing behaviour is untouched - NL/EU was the implicit assumption", () => {
  const before = runEngine(referenceCase);

  it("the reference case's anchor still lands exactly where it did: 3,8 at percentile 70", () => {
    const base = before.scenarioOutcomes!.find((o) => o.scenario === "base")!;
    expect(base.score!.total).toBe(3.8);
    expect(base.percentile).toBe(70);
  });

  it("an input with no taxResidency computes identically to one saying Nederland", () => {
    // The whole result, not just the tax block: if the fallback were
    // wrong anywhere, some downstream figure would diverge.
    expect(runEngine(withResidency("netherlands"))).toEqual(before);
  });

  it("the year-1 tax figures are unchanged for the EU path", () => {
    expect(before.tax.taxRate).toBe(EU_RATE);
    expect(before.tax.deductionsAllowed).toBe(true);
    expect(before.tax.taxableIncomeBase).toBeCloseTo(
      before.tax.grossRentalIncomeBase - before.tax.deductibleCostsBase,
      6,
    );
  });
});
