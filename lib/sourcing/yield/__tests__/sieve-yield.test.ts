/**
 * Golden test for the sourcing sieve's yield (SOURCING_SPEC.md §7 step
 * 2, design approved by Samuel).
 *
 * The seven anchor points are the ones the design document itself
 * presented for review - computed by hand against the real
 * NEIGHBORHOOD_RENT_LONG_TERM and DEFAULT_USABLE_TO_BUILT_AREA_RATIO
 * parameters and the real source-mock.ts fixtures. Pinning them here is
 * what makes "Samuel approved this table" mean something: if a future
 * change to the formula (or to the underlying parameters) moves one of
 * these seven numbers, this test is the thing that notices before a
 * customer does.
 *
 * The second thing this file exists to guarantee: no SieveYieldResult
 * can leave computeSieveYield() without its full disclosure set. That is
 * the one property standing between this figure and being mistaken for
 * the paid report's own numbers - so it is tested directly, not assumed
 * from the return statement's shape.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_USABLE_TO_BUILT_AREA_RATIO } from "@/lib/rules/es/parameters";
import { getListingDetail } from "../../source/source-mock";
import { computeSieveYield } from "../sieve-yield";
import { ALL_SOURCING_YIELD_DISCLOSURE_KEYS } from "../types";
import type { Listing } from "../../source/types";

async function listing(sourceId: string): Promise<Listing> {
  const detail = await getListingDetail(sourceId);
  if (detail === null) throw new Error(`Fixture missing: ${sourceId}`);
  return detail;
}

describe("computeSieveYield - the seven ankerpunten from the approved design", () => {
  it.each([
    { id: "mock-009", neighborhood: "Cullera", expectedPercent: 7 },
    { id: "mock-021", neighborhood: "El Carmen (Ciutat Vella)", expectedPercent: 6 },
    { id: "mock-016", neighborhood: "Oliva", expectedPercent: 5 },
    { id: "mock-011", neighborhood: "Mislata", expectedPercent: 6 },
    { id: "mock-002", neighborhood: "Valencia City", expectedPercent: 4 },
    { id: "mock-007", neighborhood: "Canet d'En Berenguer", expectedPercent: 7 },
    { id: "mock-030", neighborhood: "El Carmen (Ciutat Vella)", expectedPercent: 7 },
  ])("$id ($neighborhood) rounds to $expectedPercent%", async ({ id, neighborhood, expectedPercent }) => {
    const result = computeSieveYield(await listing(id));
    expect(result.neighborhood).toBe(neighborhood);
    expect(result.sieveYieldPercent).toBe(expectedPercent);
  });
});

describe("computeSieveYield - the two listings computed by hand in the design doc", () => {
  it("mock-009 (Cullera, usable area derived): 32,3 m² x 12,2 x 12 / 72.000", async () => {
    const result = computeSieveYield(await listing("mock-009"));

    expect(result.referenceRentPerM2).toBe(12.2);
    expect(result.usableAreaM2).toBeCloseTo(38 * DEFAULT_USABLE_TO_BUILT_AREA_RATIO.value, 6);
    expect(result.annualGrossRent).toBeCloseTo(4728.72, 2);
    expect(result.sieveYieldPercent).toBe(7);
  });

  it("mock-021 (El Carmen, usable area given): 88 m² x 23 x 12 / 415.000", async () => {
    const result = computeSieveYield(await listing("mock-021"));

    expect(result.referenceRentPerM2).toBe(23);
    expect(result.usableAreaM2).toBe(88);
    expect(result.annualGrossRent).toBeCloseTo(24288, 2);
    expect(result.sieveYieldPercent).toBe(6);
  });
});

describe("computeSieveYield - the disclosure set is never partial and never absent", () => {
  it("every result carries all four disclosure keys, unconditionally", async () => {
    const ids = ["mock-001", "mock-009", "mock-021", "mock-016", "mock-030"];
    for (const id of ids) {
      const result = computeSieveYield(await listing(id));
      expect(result.disclosures).toEqual(ALL_SOURCING_YIELD_DISCLOSURE_KEYS);
      expect(result.disclosures).toContain("grossOnly");
      expect(result.disclosures).toContain("longTermOnly");
      expect(result.disclosures).toContain("neighborhoodAverage");
      expect(result.disclosures).toContain("notTheReport");
    }
  });

  it("ALL_SOURCING_YIELD_DISCLOSURE_KEYS itself has exactly the four approved keys", () => {
    expect([...ALL_SOURCING_YIELD_DISCLOSURE_KEYS].sort()).toEqual(
      ["grossOnly", "longTermOnly", "neighborhoodAverage", "notTheReport"].sort(),
    );
  });
});

describe("computeSieveYield - bruikbaar oppervlak herkomst", () => {
  it("tracks no placeholder when the listing gives its own usableAreaM2", async () => {
    const result = computeSieveYield(await listing("mock-021"));
    expect(result.placeholdersUsed).toEqual([]);
  });

  it("tracks DEFAULT_USABLE_TO_BUILT_AREA_RATIO when the area had to be derived", async () => {
    const result = computeSieveYield(await listing("mock-009"));
    expect(result.placeholdersUsed).toHaveLength(1);
    expect(result.placeholdersUsed[0]!.name).toBe("DEFAULT_USABLE_TO_BUILT_AREA_RATIO");
    expect(result.placeholdersUsed[0]!.provenance).toBe("PLACEHOLDER");
  });
});

describe("computeSieveYield - precision guard", () => {
  it("sieveYieldPercent is always a whole number - never a decimal that reads as more precise than a sieve should", async () => {
    const ids = ["mock-001", "mock-005", "mock-013", "mock-024", "mock-028"];
    for (const id of ids) {
      const result = computeSieveYield(await listing(id));
      expect(Number.isInteger(result.sieveYieldPercent)).toBe(true);
    }
  });

  it("rounds half-up, at a constructed boundary (6,5% rounds to 7%)", () => {
    // Constructed, not a fixture: an 80 m² listing at a rent implying
    // exactly 6.5% before rounding, isolating the rounding rule itself
    // from source-mock.ts's own numbers.
    const syntheticListing: Listing = {
      sourceId: "synthetic-boundary",
      title: "Grensgeval voor afronding",
      neighborhood: "Valencia City", // 13.5 EUR/m2/month
      priceEUR: (13.5 * 80 * 12) / 0.065,
      builtAreaM2: 80,
      usableAreaM2: 80,
      propertyType: "appartement",
      sourceUrl: "https://mock-source.internal/listings/synthetic-boundary",
    };
    expect(computeSieveYield(syntheticListing).sieveYieldPercent).toBe(7);
  });
});

describe("computeSieveYield - unknown neighbourhood", () => {
  it("throws rather than silently falling back to a city average", () => {
    const badListing: Listing = {
      sourceId: "bad-neighborhood",
      title: "Buiten de 13 wijken",
      neighborhood: "Nonexistent Wijk",
      priceEUR: 200000,
      builtAreaM2: 80,
      propertyType: "appartement",
      sourceUrl: "https://mock-source.internal/listings/bad-neighborhood",
    };
    expect(() => computeSieveYield(badListing)).toThrow(/Nonexistent Wijk/);
  });
});

describe("computeSieveYield - never touches runEngine", () => {
  it("the source file has no import statement reaching into lib/rules/es/engine", () => {
    // A structural check on the source text itself, not on behaviour:
    // this is the one thing a behavioural test cannot prove (a function
    // that happens not to call runEngine() today could still import it).
    // Reading the file directly means a future edit that adds such an
    // import fails this test, not somewhere downstream.
    //
    // Checked against actual import syntax only, not the bare word
    // "runEngine" - this module's own docstring names the function in
    // prose, parens and all, while explaining precisely why it is
    // absent, and a text-mention check would fail on that explanation.
    // An import line is unambiguous: without one, calling the real
    // engine is not syntactically possible from this file regardless of
    // what its comments say.
    const source = readFileSync(path.join(import.meta.dirname, "../sieve-yield.ts"), "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line));

    expect(importLines.length).toBeGreaterThan(0); // sanity: this file does import something
    for (const line of importLines) {
      expect(line).not.toMatch(/rules\/es\/engine/);
    }
  });
});
