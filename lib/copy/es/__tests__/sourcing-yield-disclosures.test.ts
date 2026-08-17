/**
 * Golden test for the sourcing-yield disclosure copy (SOURCING_SPEC.md
 * §7 step 2). Same shape as the free-tier disclosure copy's own test
 * would be: every key the calculation layer can emit must resolve to
 * non-empty Dutch text, in both the object lookup and the
 * exhaustiveness-guarded translate function - so a page can never be
 * left holding a key with nothing to show for it.
 */

import { describe, expect, it } from "vitest";
import { ALL_SOURCING_YIELD_DISCLOSURE_KEYS } from "@/lib/sourcing/yield/types";
import {
  SOURCING_YIELD_DISCLOSURE_COPY_NL,
  translateSourcingYieldDisclosure,
  translateSourcingYieldDisclosures,
} from "../sourcing-yield-disclosures";

describe("SOURCING_YIELD_DISCLOSURE_COPY_NL", () => {
  it("has non-empty Dutch text for every key", () => {
    for (const key of ALL_SOURCING_YIELD_DISCLOSURE_KEYS) {
      expect(SOURCING_YIELD_DISCLOSURE_COPY_NL[key]).toBeTruthy();
      expect(SOURCING_YIELD_DISCLOSURE_COPY_NL[key].length).toBeGreaterThan(10);
    }
  });
});

describe("translateSourcingYieldDisclosure", () => {
  it("translates every key without throwing", () => {
    for (const key of ALL_SOURCING_YIELD_DISCLOSURE_KEYS) {
      expect(() => translateSourcingYieldDisclosure(key)).not.toThrow();
    }
  });

  it("matches the Record for each key", () => {
    for (const key of ALL_SOURCING_YIELD_DISCLOSURE_KEYS) {
      expect(translateSourcingYieldDisclosure(key)).toBe(SOURCING_YIELD_DISCLOSURE_COPY_NL[key]);
    }
  });

  it("names the report explicitly in notTheReport, so a customer cannot mistake the sieve for it", () => {
    expect(translateSourcingYieldDisclosure("notTheReport")).toMatch(/rapport/i);
  });

  it("names the gross-only nature explicitly, so a customer does not read it as a net figure", () => {
    expect(translateSourcingYieldDisclosure("grossOnly")).toMatch(/bruto/i);
  });
});

describe("translateSourcingYieldDisclosures", () => {
  it("translates a full list in order", () => {
    const translated = translateSourcingYieldDisclosures(ALL_SOURCING_YIELD_DISCLOSURE_KEYS);
    expect(translated).toHaveLength(ALL_SOURCING_YIELD_DISCLOSURE_KEYS.length);
    expect(translated).toEqual(
      ALL_SOURCING_YIELD_DISCLOSURE_KEYS.map(translateSourcingYieldDisclosure),
    );
  });

  it("returns an empty list for an empty input", () => {
    expect(translateSourcingYieldDisclosures([])).toEqual([]);
  });
});
