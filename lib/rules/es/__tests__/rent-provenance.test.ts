import { describe, expect, it } from "vitest";
import {
  translateRentInputProvenanceReport,
  translateRentProvenanceDisclosure,
} from "../../../copy/es/rent-provenance-disclosures";
import { runEngine } from "../engine";
import {
  NEIGHBORHOOD_RENT_LONG_TERM,
  NEIGHBORHOOD_RENT_SHORT_TERM,
  RENT_OVERRIDE_SIGNIFICANT_DEVIATION_THRESHOLD,
} from "../parameters";
import { computeRentInputProvenance, rentProvenanceDisclosureKey } from "../rent-provenance";
import { referenceCase } from "./referencecase";

/**
 * Golden values: independent recomputation in Python/Node, transcribed by
 * hand from NEIGHBORHOOD_RENT_LONG_TERM/SHORT_TERM and the threshold
 * parameter. Ruzafa (17.0 €/m²/month LT) is the same reference the
 * free-tier band's own golden tests use.
 *
 * The exact-20% boundary case deliberately uses Oliva (9.2), not Ruzafa:
 * 17.0 * 1.20 evaluates to a double a hair under 0.2 once divided back out
 * ((20.4 - 17.0) / 17.0 = 0.19999999999999993 in both Python and Node),
 * while 9.2 * 1.20 = 11.04 happens to round-trip to exactly the same
 * double as the 0.2 threshold literal. Using Oliva keeps the boundary test
 * asserting the real >= 20% rule rather than an artifact of which
 * neighbourhood's reference rate was multiplied.
 */

describe("computeRentInputProvenance - matchesReference", () => {
  it("supplying exactly the wijk's reference rate matches, no deviation", () => {
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: 17.0,
      rentPerM2ShortTerm: 29.0, // NEIGHBORHOOD_RENT_SHORT_TERM.Ruzafa, unused by longTerm strategy
      rentalStrategy: "longTerm",
    });
    expect(report.longTerm).toEqual({
      status: "matchesReference",
      referenceRentPerM2: 17.0,
      suppliedRentPerM2: 17.0,
      deviationFraction: 0,
      significantDeviation: false,
    });
  });

  it("emits no disclosure key and no §6.1 text", () => {
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: 17.0,
      rentPerM2ShortTerm: 29.0,
      rentalStrategy: "longTerm",
    });
    expect(rentProvenanceDisclosureKey(report.longTerm!)).toBeNull();
    expect(translateRentProvenanceDisclosure("longTerm", report.longTerm!)).toBeNull();
    expect(translateRentInputProvenanceReport(report)).toEqual([]);
  });
});

describe("computeRentInputProvenance - noReference", () => {
  it("no neighbourhood supplied", () => {
    const report = computeRentInputProvenance({
      neighborhood: undefined,
      rentPerM2LongTerm: 25.0,
      rentPerM2ShortTerm: 40.0,
      rentalStrategy: "longTerm",
    });
    expect(report.longTerm).toEqual({
      status: "noReference",
      referenceRentPerM2: null,
      suppliedRentPerM2: 25.0,
      deviationFraction: null,
      significantDeviation: false,
    });
  });

  it("a neighbourhood outside the 13 covered wijken (paid tier allows any address)", () => {
    const report = computeRentInputProvenance({
      neighborhood: "Torrent",
      rentPerM2LongTerm: 25.0,
      rentPerM2ShortTerm: 40.0,
      rentalStrategy: "longTerm",
    });
    expect(report.longTerm!.status).toBe("noReference");
  });

  it("emits no disclosure key and no §6.1 text - unlike a deviation, an unknown reference is not an override", () => {
    const report = computeRentInputProvenance({
      neighborhood: undefined,
      rentPerM2LongTerm: 25.0,
      rentPerM2ShortTerm: 40.0,
      rentalStrategy: "longTerm",
    });
    expect(rentProvenanceDisclosureKey(report.longTerm!)).toBeNull();
    expect(translateRentInputProvenanceReport(report)).toEqual([]);
  });
});

describe("computeRentInputProvenance - customerOverride, not significant", () => {
  it("15% above the Ruzafa reference: deviation recorded, not flagged significant", () => {
    const supplied = 17.0 * 1.15; // 19.55
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: supplied,
      rentPerM2ShortTerm: 29.0,
      rentalStrategy: "longTerm",
    });
    expect(report.longTerm!.status).toBe("customerOverride");
    expect(report.longTerm!.deviationFraction).toBeCloseTo(0.15, 10);
    expect(report.longTerm!.significantDeviation).toBe(false);
  });

  it("emits the minor key and the lighter §6.1 text", () => {
    const supplied = 17.0 * 1.15;
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: supplied,
      rentPerM2ShortTerm: 29.0,
      rentalStrategy: "longTerm",
    });
    expect(rentProvenanceDisclosureKey(report.longTerm!)).toBe("rentOverrideMinor");
    const text = translateRentProvenanceDisclosure("longTerm", report.longTerm!);
    expect(text).not.toBeNull();
    expect(text).toContain("langetermijnhuur");
    expect(text).toContain("19,55");
    expect(text).toContain("17,00");
    expect(text).toContain("wijkt licht af");
  });
});

describe("computeRentInputProvenance - customerOverride, significant", () => {
  it("25% below the Ruzafa reference", () => {
    const supplied = 17.0 * 0.75; // 12.75
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: supplied,
      rentPerM2ShortTerm: 29.0,
      rentalStrategy: "longTerm",
    });
    expect(report.longTerm!.status).toBe("customerOverride");
    expect(report.longTerm!.deviationFraction).toBeCloseTo(-0.25, 10);
    expect(report.longTerm!.significantDeviation).toBe(true);
  });

  it("emits the significant key and a §6.1 text naming the value, the percentage and the reference", () => {
    const supplied = 17.0 * 0.75;
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: supplied,
      rentPerM2ShortTerm: 29.0,
      rentalStrategy: "longTerm",
    });
    expect(rentProvenanceDisclosureKey(report.longTerm!)).toBe("rentOverrideSignificant");
    const text = translateRentProvenanceDisclosure("longTerm", report.longTerm!);
    expect(text).not.toBeNull();
    // the value the customer entered
    expect(text).toContain("12,75");
    // the percentage
    expect(text).toContain("25,0%");
    expect(text).toContain("lager dan");
    // the market reference
    expect(text).toContain("17,00");
    expect(text).toContain("wijkreferentie");
  });

  it("says 'hoger dan' when the override runs above the reference, not below", () => {
    const supplied = 17.0 * 1.25;
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: supplied,
      rentPerM2ShortTerm: 29.0,
      rentalStrategy: "longTerm",
    });
    const text = translateRentProvenanceDisclosure("longTerm", report.longTerm!);
    expect(text).toContain("hoger dan");
  });
});

describe("computeRentInputProvenance - the boundary at precisely 20%", () => {
  it("exactly 20% is significant (inclusive threshold)", () => {
    // Oliva: 9.2 * 1.20 round-trips to exactly the same double as the 0.2
    // threshold literal - see the module docstring above for why Ruzafa
    // cannot give a bit-exact boundary here.
    const reference = NEIGHBORHOOD_RENT_LONG_TERM.value["Oliva"]!;
    expect(reference).toBe(9.2);
    const supplied = reference * 1.2;
    const report = computeRentInputProvenance({
      neighborhood: "Oliva",
      rentPerM2LongTerm: supplied,
      rentPerM2ShortTerm: 15.0,
      rentalStrategy: "longTerm",
    });
    expect(report.longTerm!.deviationFraction).toBe(
      RENT_OVERRIDE_SIGNIFICANT_DEVIATION_THRESHOLD.value,
    );
    expect(report.longTerm!.significantDeviation).toBe(true);
    expect(rentProvenanceDisclosureKey(report.longTerm!)).toBe("rentOverrideSignificant");
  });

  it("just below 20% is not significant", () => {
    const reference = NEIGHBORHOOD_RENT_LONG_TERM.value["Oliva"]!;
    const supplied = reference * 1.19;
    const report = computeRentInputProvenance({
      neighborhood: "Oliva",
      rentPerM2LongTerm: supplied,
      rentPerM2ShortTerm: 15.0,
      rentalStrategy: "longTerm",
    });
    expect(report.longTerm!.significantDeviation).toBe(false);
    expect(rentProvenanceDisclosureKey(report.longTerm!)).toBe("rentOverrideMinor");
  });

  it("just above 20% is significant", () => {
    const reference = NEIGHBORHOOD_RENT_LONG_TERM.value["Oliva"]!;
    const supplied = reference * 1.21;
    const report = computeRentInputProvenance({
      neighborhood: "Oliva",
      rentPerM2LongTerm: supplied,
      rentPerM2ShortTerm: 15.0,
      rentalStrategy: "longTerm",
    });
    expect(report.longTerm!.significantDeviation).toBe(true);
    expect(rentProvenanceDisclosureKey(report.longTerm!)).toBe("rentOverrideSignificant");
  });
});

describe("computeRentInputProvenance - only the rate(s) the strategy actually uses are reported", () => {
  it("longTerm strategy: shortTerm stays null even when it deviates wildly", () => {
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: 17.0,
      rentPerM2ShortTerm: 1000, // absurd, but unused by this strategy
      rentalStrategy: "longTerm",
    });
    expect(report.longTerm).not.toBeNull();
    expect(report.shortTerm).toBeNull();
  });

  it("shortTerm strategy: longTerm stays null", () => {
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: 1000,
      rentPerM2ShortTerm: 29.0,
      rentalStrategy: "shortTerm",
    });
    expect(report.longTerm).toBeNull();
    expect(report.shortTerm).not.toBeNull();
  });

  it("hybrid strategy: both are reported", () => {
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: 17.0,
      rentPerM2ShortTerm: 29.0,
      rentalStrategy: "hybrid",
    });
    expect(report.longTerm).not.toBeNull();
    expect(report.shortTerm).not.toBeNull();
    expect(report.longTerm!.status).toBe("matchesReference");
    expect(report.shortTerm!.status).toBe("matchesReference");
  });

  it("hybrid with one rate overridden significantly and the other matching: exactly one §6.1 line", () => {
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: 17.0 * 1.30,
      rentPerM2ShortTerm: 29.0,
      rentalStrategy: "hybrid",
    });
    const lines = translateRentInputProvenanceReport(report);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("langetermijnhuur");
  });

  it("reads NEIGHBORHOOD_RENT_SHORT_TERM, not the long-term table, for the short-term rate", () => {
    const reference = NEIGHBORHOOD_RENT_SHORT_TERM.value["Ruzafa"]!;
    expect(reference).toBe(29.0);
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: 17.0,
      rentPerM2ShortTerm: reference,
      rentalStrategy: "shortTerm",
    });
    expect(report.shortTerm!.status).toBe("matchesReference");
    expect(report.shortTerm!.referenceRentPerM2).toBe(29.0);
  });
});

describe("EngineResult.rentInputProvenance - wired unconditionally into runEngine()", () => {
  it("the reference case (no neighborhood) reports noReference on the rate its hybrid strategy uses", () => {
    const result = runEngine(referenceCase);
    expect(referenceCase.property.neighborhood).toBeUndefined();
    expect(result.rentInputProvenance.longTerm!.status).toBe("noReference");
    expect(result.rentInputProvenance.shortTerm!.status).toBe("noReference");
  });

  it("is present even when exitPlanning is omitted, unlike scenarioOutcomes", () => {
    const { exitPlanning: _exitPlanning, ...withoutExitPlanning } = referenceCase;
    const result = runEngine(withoutExitPlanning);
    expect(result.scenarioOutcomes).toBeNull();
    expect(result.rentInputProvenance).not.toBeNull();
    expect(result.rentInputProvenance.longTerm).not.toBeNull();
  });

  it("does not vary by scenario - it is one report on EngineResult, not one per ScenarioOutcome", () => {
    const result = runEngine(referenceCase);
    // Confirms the type itself: rentInputProvenance sits beside
    // scenarioOutcomes on EngineResult, not inside each ScenarioOutcome.
    expect(result.rentInputProvenance).toBeDefined();
    expect(result.scenarioOutcomes).not.toBeNull();
    for (const outcome of result.scenarioOutcomes!) {
      expect((outcome as unknown as Record<string, unknown>).rentInputProvenance).toBeUndefined();
    }
  });

  it("a neighbourhood matching the table end to end", () => {
    const result = runEngine({
      ...referenceCase,
      property: { ...referenceCase.property, neighborhood: "Ruzafa" },
      selections: { ...referenceCase.selections, rentPerM2LongTerm: 17.0, rentPerM2ShortTerm: 29.0 },
    });
    expect(result.rentInputProvenance.longTerm!.status).toBe("matchesReference");
    expect(result.rentInputProvenance.shortTerm!.status).toBe("matchesReference");
  });
});

describe("computeRentInputProvenance - actualCurrentRent", () => {
  it("reports the declared status, with no deviation to measure", () => {
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: 14.5,
      rentPerM2ShortTerm: 29.0,
      rentalStrategy: "longTerm",
      fromActualCurrentRent: "longTerm",
    });
    expect(report.longTerm).toEqual({
      status: "actualCurrentRent",
      // Still carried: §6.8 may show what reference existed. Context, not
      // a yardstick - hence the null deviation below.
      referenceRentPerM2: 17.0,
      suppliedRentPerM2: 14.5,
      deviationFraction: null,
      significantDeviation: false,
    });
  });

  it("never flags a significant deviation, however far it sits from the reference", () => {
    // 14.5 vs 17.0 is -14.7%, and 6.0 vs 17.0 is -64.7% - both would be
    // customerOverride territory, one of them significantly so. An
    // observed rent is neither.
    for (const supplied of [14.5, 6.0, 40.0]) {
      const report = computeRentInputProvenance({
        neighborhood: "Ruzafa",
        rentPerM2LongTerm: supplied,
        rentPerM2ShortTerm: 29.0,
        rentalStrategy: "longTerm",
        fromActualCurrentRent: "longTerm",
      });
      expect(report.longTerm!.status).toBe("actualCurrentRent");
      expect(report.longTerm!.deviationFraction).toBeNull();
      expect(report.longTerm!.significantDeviation).toBe(false);
    }
  });

  it("stays actualCurrentRent even when the observed rent equals the reference exactly", () => {
    // The whole reason this status is declared rather than derived: a
    // coincidence with the wijk average must not turn it into
    // "matchesReference", which would credit the model for a figure it
    // did not supply.
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: 17.0,
      rentPerM2ShortTerm: 29.0,
      rentalStrategy: "longTerm",
      fromActualCurrentRent: "longTerm",
    });
    expect(report.longTerm!.status).toBe("actualCurrentRent");
  });

  it("carries a null reference when the wijk is unknown, without becoming noReference", () => {
    const report = computeRentInputProvenance({
      neighborhood: undefined,
      rentPerM2LongTerm: 14.5,
      rentPerM2ShortTerm: 29.0,
      rentalStrategy: "longTerm",
      fromActualCurrentRent: "longTerm",
    });
    expect(report.longTerm!.status).toBe("actualCurrentRent");
    expect(report.longTerm!.referenceRentPerM2).toBeNull();
  });

  it("emits a reassuring §6.1 line naming the rate, with no percentage and no warning", () => {
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: 14.5,
      rentPerM2ShortTerm: 29.0,
      rentalStrategy: "longTerm",
      fromActualCurrentRent: "longTerm",
    });
    expect(rentProvenanceDisclosureKey(report.longTerm!)).toBe("rentFromActualCurrentRent");
    const text = translateRentProvenanceDisclosure("longTerm", report.longTerm!)!;
    expect(text).toContain("werkelijke huidige huur van dit pand");
    expect(text).toContain("14,50");
    expect(text).toContain("niet op een schatting");
    // Reassuring, not cautioning: none of the override vocabulary.
    expect(text).not.toContain("%");
    expect(text).not.toContain("wijkreferentie");
    expect(text).not.toContain("U heeft zelf");
    expect(text).not.toContain("wijkt");
  });

  it("applies to the short-term rate when that is the one observed", () => {
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: 17.0,
      rentPerM2ShortTerm: 24.0,
      rentalStrategy: "hybrid",
      fromActualCurrentRent: "shortTerm",
    });
    expect(report.shortTerm!.status).toBe("actualCurrentRent");
    // The other rate is untouched by the declaration and still compares
    // against its own table.
    expect(report.longTerm!.status).toBe("matchesReference");
  });

  it("has no effect when it names a rate the selected strategy does not use", () => {
    const report = computeRentInputProvenance({
      neighborhood: "Ruzafa",
      rentPerM2LongTerm: 17.0,
      rentPerM2ShortTerm: 24.0,
      rentalStrategy: "longTerm",
      fromActualCurrentRent: "shortTerm",
    });
    expect(report.shortTerm).toBeNull();
    expect(report.longTerm!.status).toBe("matchesReference");
    expect(translateRentInputProvenanceReport(report)).toEqual([]);
  });

  it("leaves the other three statuses exactly as they were when not declared", () => {
    const base = {
      neighborhood: "Ruzafa",
      rentPerM2ShortTerm: 29.0,
      rentalStrategy: "longTerm" as const,
    };
    expect(
      computeRentInputProvenance({ ...base, rentPerM2LongTerm: 17.0 }).longTerm!.status,
    ).toBe("matchesReference");
    expect(
      computeRentInputProvenance({ ...base, rentPerM2LongTerm: 14.5 }).longTerm!.status,
    ).toBe("customerOverride");
    expect(
      computeRentInputProvenance({ ...base, neighborhood: undefined, rentPerM2LongTerm: 14.5 })
        .longTerm!.status,
    ).toBe("noReference");
  });
});

describe("EngineResult.rentInputProvenance - actualCurrentRent end to end", () => {
  it("runEngine passes ModelSelections.rentPerM2FromActualCurrentRent through", () => {
    const result = runEngine({
      ...referenceCase,
      property: { ...referenceCase.property, neighborhood: "Ruzafa" },
      selections: {
        ...referenceCase.selections,
        rentalStrategy: "longTerm",
        rentPerM2LongTerm: 14.5,
        rentPerM2FromActualCurrentRent: "longTerm",
      },
    });
    expect(result.rentInputProvenance.longTerm!.status).toBe("actualCurrentRent");
    expect(result.rentInputProvenance.longTerm!.suppliedRentPerM2).toBe(14.5);
    expect(result.rentInputProvenance.longTerm!.deviationFraction).toBeNull();
  });

  it("without the declaration the same figure reads as a customer override", () => {
    const result = runEngine({
      ...referenceCase,
      property: { ...referenceCase.property, neighborhood: "Ruzafa" },
      selections: {
        ...referenceCase.selections,
        rentalStrategy: "longTerm",
        rentPerM2LongTerm: 14.5,
      },
    });
    expect(result.rentInputProvenance.longTerm!.status).toBe("customerOverride");
  });
});
