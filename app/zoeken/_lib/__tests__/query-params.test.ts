/**
 * Golden test for the search page's query-string layer (SOURCING_SPEC.md
 * §7 step 3). Same discipline as gratis's own query-params.test.ts would
 * be: build and parse must round-trip, and parsing must be tolerant of
 * a partial or hand-edited URL rather than throwing - there is no server
 * state to fall back on if it did.
 */

import { describe, expect, it } from "vitest";
import { buildSearchQuery, parseSearchQuery } from "../query-params";
import type { SearchFormValues } from "../query-params";

function toRecord(params: URLSearchParams): Record<string, string> {
  return Object.fromEntries(params.entries());
}

describe("buildSearchQuery", () => {
  it("includes only the filters that were filled in", () => {
    const params = buildSearchQuery({
      neighborhood: "Ruzafa",
      minPriceEUR: "",
      maxPriceEUR: "300000",
      propertyType: "",
      minYieldPercent: "6",
    });
    expect(toRecord(params)).toEqual({ wijk: "Ruzafa", prijsMax: "300000", minYield: "6" });
  });

  it("produces an empty query for an entirely empty form", () => {
    const params = buildSearchQuery({
      neighborhood: "",
      minPriceEUR: "",
      maxPriceEUR: "",
      propertyType: "",
      minYieldPercent: "",
    });
    expect([...params.entries()]).toEqual([]);
  });
});

describe("parseSearchQuery - round trip", () => {
  it("reads back exactly what buildSearchQuery wrote", () => {
    const values: SearchFormValues = {
      neighborhood: "El Carmen (Ciutat Vella)",
      minPriceEUR: "100000",
      maxPriceEUR: "500000",
      propertyType: "villa",
      minYieldPercent: "5",
    };
    const params = buildSearchQuery(values);
    const parsed = parseSearchQuery(Object.fromEntries(params.entries()));

    expect(parsed.hasAnyCriteria).toBe(true);
    expect(parsed.formValues).toEqual(values);
    expect(parsed.criteria).toEqual({
      neighborhood: "El Carmen (Ciutat Vella)",
      minPriceEUR: 100000,
      maxPriceEUR: 500000,
      propertyType: "villa",
    });
    expect(parsed.minYieldPercent).toBe(5);
  });
});

describe("parseSearchQuery - cold entry", () => {
  it("reports hasAnyCriteria false when the URL carries none of the five keys", () => {
    const parsed = parseSearchQuery({});
    expect(parsed.hasAnyCriteria).toBe(false);
    expect(parsed.criteria).toEqual({});
    expect(parsed.minYieldPercent).toBeUndefined();
  });
});

describe("parseSearchQuery - every filter is independently optional", () => {
  it("accepts only a neighbourhood", () => {
    const parsed = parseSearchQuery({ wijk: "Oliva" });
    expect(parsed.hasAnyCriteria).toBe(true);
    expect(parsed.criteria).toEqual({ neighborhood: "Oliva" });
    expect(parsed.minYieldPercent).toBeUndefined();
  });

  it("accepts only a yield threshold", () => {
    const parsed = parseSearchQuery({ minYield: "7" });
    expect(parsed.hasAnyCriteria).toBe(true);
    expect(parsed.criteria).toEqual({});
    expect(parsed.minYieldPercent).toBe(7);
  });

  it("accepts only one end of the price range", () => {
    const parsed = parseSearchQuery({ prijsMax: "200000" });
    expect(parsed.criteria).toEqual({ maxPriceEUR: 200000 });
  });
});

describe("parseSearchQuery - tolerant of a tampered or hand-edited URL", () => {
  it("ignores an unparseable price rather than throwing", () => {
    const parsed = parseSearchQuery({ prijsMin: "not-a-number" });
    expect(parsed.criteria.minPriceEUR).toBeUndefined();
    expect(parsed.hasAnyCriteria).toBe(true); // the key was present, even though it did not parse
  });

  it("ignores a negative price", () => {
    const parsed = parseSearchQuery({ prijsMax: "-100" });
    expect(parsed.criteria.maxPriceEUR).toBeUndefined();
  });

  it("ignores a property type outside SOURCE_PROPERTY_TYPES", () => {
    const parsed = parseSearchQuery({ type: "kasteel" });
    expect(parsed.criteria.propertyType).toBeUndefined();
  });

  it("ignores an unparseable yield threshold", () => {
    const parsed = parseSearchQuery({ minYield: "veel" });
    expect(parsed.minYieldPercent).toBeUndefined();
  });

  it("takes the first value when a key repeats (array form)", () => {
    const parsed = parseSearchQuery({ wijk: ["Ruzafa", "Oliva"] });
    expect(parsed.criteria.neighborhood).toBe("Ruzafa");
  });
});
