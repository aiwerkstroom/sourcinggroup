import { describe, expect, it } from "vitest";
import { incomeLine } from "../income";
import {
  BASE_OCCUPANCY_LONG_TERM,
  DEFAULT_USABLE_TO_BUILT_AREA_RATIO,
  NEIGHBORHOOD_RENT_LONG_TERM,
  NEIGHBORHOOD_RENT_SHORT_TERM,
  RENOVATION_STRATEGIES,
} from "../parameters";
import { computeRentPrefill } from "../rent-prefill";

/**
 * Golden values independently recomputed: usable area 90 x 0.85 = 76.5,
 * and an observed € 1.100/month over that area is 1100 / 76.5 =
 * 14.379084967320262 €/m²/month.
 */

describe("computeRentPrefill - the neighbourhood reference", () => {
  it("pre-fills both rates from the wijk tables when nothing better exists", () => {
    const prefill = computeRentPrefill({ neighborhood: "Ruzafa", builtAreaM2: 90 });
    expect(prefill.longTerm).toEqual({
      rentPerM2: NEIGHBORHOOD_RENT_LONG_TERM.value["Ruzafa"],
      source: "neighborhoodReference",
    });
    expect(prefill.shortTerm).toEqual({
      rentPerM2: NEIGHBORHOOD_RENT_SHORT_TERM.value["Ruzafa"],
      source: "neighborhoodReference",
    });
  });

  it("leaves both rates empty for a wijk outside the covered thirteen", () => {
    // The paid path takes any address, so this is a normal case, not an error.
    const prefill = computeRentPrefill({ neighborhood: "Torrent", builtAreaM2: 90 });
    expect(prefill.longTerm).toEqual({ rentPerM2: null, source: "none" });
    expect(prefill.shortTerm).toEqual({ rentPerM2: null, source: "none" });
  });

  it("leaves both rates empty when no wijk was chosen at all", () => {
    const prefill = computeRentPrefill({ neighborhood: undefined, builtAreaM2: 90 });
    expect(prefill.longTerm.source).toBe("none");
    expect(prefill.shortTerm.source).toBe("none");
  });
});

describe("computeRentPrefill - the observed current rent wins", () => {
  it("converts the monthly rent over the derived usable area", () => {
    const prefill = computeRentPrefill({
      neighborhood: "Ruzafa",
      builtAreaM2: 90,
      actualCurrentRentMonthly: 1100,
      actualCurrentRentAppliesTo: "longTerm",
    });
    expect(prefill.usableAreaM2).toBeCloseTo(76.5, 10);
    expect(prefill.usableAreaWasDerived).toBe(true);
    expect(prefill.longTerm.source).toBe("actualCurrentRent");
    expect(prefill.longTerm.rentPerM2).toBeCloseTo(14.379084967320262, 12);
  });

  it("uses a measured usable area when one was given, not the derived one", () => {
    const prefill = computeRentPrefill({
      neighborhood: "Ruzafa",
      builtAreaM2: 90,
      usableAreaM2: 80,
      actualCurrentRentMonthly: 1100,
      actualCurrentRentAppliesTo: "longTerm",
    });
    expect(prefill.usableAreaM2).toBe(80);
    expect(prefill.usableAreaWasDerived).toBe(false);
    expect(prefill.longTerm.rentPerM2).toBeCloseTo(13.75, 12);
  });

  it("only replaces the rate the letting status points at", () => {
    const prefill = computeRentPrefill({
      neighborhood: "Ruzafa",
      builtAreaM2: 90,
      actualCurrentRentMonthly: 1100,
      actualCurrentRentAppliesTo: "longTerm",
    });
    expect(prefill.longTerm.source).toBe("actualCurrentRent");
    // The short-term rate has no observation behind it and falls back.
    expect(prefill.shortTerm.source).toBe("neighborhoodReference");
    expect(prefill.shortTerm.rentPerM2).toBe(NEIGHBORHOOD_RENT_SHORT_TERM.value["Ruzafa"]);
  });

  it("applies to the short-term rate when the property is let short-term", () => {
    const prefill = computeRentPrefill({
      neighborhood: "Ruzafa",
      builtAreaM2: 90,
      actualCurrentRentMonthly: 2000,
      actualCurrentRentAppliesTo: "shortTerm",
    });
    expect(prefill.shortTerm.source).toBe("actualCurrentRent");
    expect(prefill.longTerm.source).toBe("neighborhoodReference");
  });

  it("beats the reference even for a covered wijk - this building outranks its average", () => {
    const prefill = computeRentPrefill({
      neighborhood: "Ruzafa",
      builtAreaM2: 90,
      actualCurrentRentMonthly: 1100,
      actualCurrentRentAppliesTo: "longTerm",
    });
    expect(prefill.longTerm.rentPerM2).not.toBe(NEIGHBORHOOD_RENT_LONG_TERM.value["Ruzafa"]);
  });

  it("falls back to the reference when the rent field was left empty or zero", () => {
    for (const rent of [undefined, 0]) {
      const prefill = computeRentPrefill({
        neighborhood: "Ruzafa",
        builtAreaM2: 90,
        actualCurrentRentMonthly: rent,
        actualCurrentRentAppliesTo: "longTerm",
      });
      expect(prefill.longTerm.source).toBe("neighborhoodReference");
    }
  });

  it("falls back to nothing when there is neither an observation nor a wijk", () => {
    const prefill = computeRentPrefill({
      neighborhood: undefined,
      builtAreaM2: 90,
      actualCurrentRentAppliesTo: "longTerm",
    });
    expect(prefill.longTerm).toEqual({ rentPerM2: null, source: "none" });
  });
});

describe("computeRentPrefill - the conversion is a contract rate, not an annual average", () => {
  it("does not gross up for vacancy, so the model's occupancy allowance survives", () => {
    // The one place this could quietly go wrong. An observed rent is what
    // the property earns in an occupied month; income.ts then multiplies
    // by BASE_OCCUPANCY_LONG_TERM to allow for future vacancy. Grossing up
    // here would cancel that allowance.
    const builtAreaM2 = 90;
    const monthlyRent = 1100;
    const prefill = computeRentPrefill({
      neighborhood: "Ruzafa",
      builtAreaM2,
      actualCurrentRentMonthly: monthlyRent,
      actualCurrentRentAppliesTo: "longTerm",
    });

    const modelled = incomeLine(
      prefill.longTerm.rentPerM2!,
      prefill.usableAreaM2,
      BASE_OCCUPANCY_LONG_TERM.value,
      RENOVATION_STRATEGIES.light.rentMultiplier.value,
    );

    // The model's annual figure is exactly the occupancy fraction of the
    // contract rent - which is the allowance doing its job, not a loss of
    // information.
    const contractAnnual = monthlyRent * 12;
    expect(modelled.adjustedAnnualIncome).toBeCloseTo(11_880, 6);
    expect(modelled.adjustedAnnualIncome / contractAnnual).toBeCloseTo(
      BASE_OCCUPANCY_LONG_TERM.value,
      12,
    );
  });

  it("round-trips: rate x usable area x 12 recovers the contract rent", () => {
    const prefill = computeRentPrefill({
      neighborhood: "Ruzafa",
      builtAreaM2: 90,
      actualCurrentRentMonthly: 1100,
      actualCurrentRentAppliesTo: "longTerm",
    });
    expect(prefill.longTerm.rentPerM2! * prefill.usableAreaM2).toBeCloseTo(1100, 10);
  });
});

describe("computeRentPrefill - the derived usable area is flagged", () => {
  it("reports the PLACEHOLDER ratio's involvement so the form can say so", () => {
    const prefill = computeRentPrefill({ neighborhood: "Ruzafa", builtAreaM2: 100 });
    expect(prefill.usableAreaWasDerived).toBe(true);
    expect(prefill.usableAreaM2).toBeCloseTo(
      100 * DEFAULT_USABLE_TO_BUILT_AREA_RATIO.value,
      10,
    );
  });
});
