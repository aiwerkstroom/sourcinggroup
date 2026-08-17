/**
 * Golden test for the listing-field-provenance disclosure copy
 * (SOURCING_SPEC.md §4/§7 step 4, stap 3 van 3): the pure formatting and
 * joining logic behind §6.1's boxed price notice and §6.8's quiet
 * wijk/oppervlak line, independent of how the report components render
 * them (covered separately by one-line-outcome-section.test.tsx and
 * assumptions-section.test.tsx).
 */

import { describe, expect, it } from "vitest";
import { EMPTY_LISTING_FIELD_PROVENANCE } from "@/lib/rules/es/types";
import {
  translateListingFieldsFromListingNote,
  translatePurchasePriceFromListingNotice,
} from "../listing-field-provenance-disclosures";

describe("translatePurchasePriceFromListingNotice", () => {
  it("formats the listing's own price in whole euros", () => {
    const text = translatePurchasePriceFromListingNotice({
      status: "fromListing",
      originalValue: 620000,
    });
    expect(text).toContain("€ 620.000");
    expect(text).toContain("nog niet door u bevestigd");
  });

  it("returns null for a confirmed/edited price", () => {
    expect(
      translatePurchasePriceFromListingNotice({ status: "confirmed", originalValue: 620000 }),
    ).toBeNull();
  });

  it("returns null when there is no listing origin at all", () => {
    expect(translatePurchasePriceFromListingNotice(null)).toBeNull();
  });
});

describe("translateListingFieldsFromListingNote", () => {
  it("returns null for EMPTY_LISTING_FIELD_PROVENANCE", () => {
    expect(translateListingFieldsFromListingNote(EMPTY_LISTING_FIELD_PROVENANCE)).toBeNull();
  });

  it("returns null once every field is confirmed", () => {
    const note = translateListingFieldsFromListingNote({
      neighborhood: { status: "confirmed", originalValue: "Ruzafa" },
      purchasePrice: { status: "confirmed", originalValue: 300000 },
      builtAreaM2: { status: "confirmed", originalValue: 90 },
      usableAreaM2: { status: "confirmed", originalValue: 80 },
    });
    expect(note).toBeNull();
  });

  it("never names purchasePrice, even when it is fromListing - that field has its own §6.1 notice", () => {
    const note = translateListingFieldsFromListingNote({
      neighborhood: { status: "confirmed", originalValue: "Ruzafa" },
      purchasePrice: { status: "fromListing", originalValue: 300000 },
      builtAreaM2: { status: "confirmed", originalValue: 90 },
      usableAreaM2: { status: "confirmed", originalValue: 80 },
    });
    expect(note).toBeNull();
  });

  it("names a single field, singular verb", () => {
    const note = translateListingFieldsFromListingNote({
      neighborhood: { status: "fromListing", originalValue: "Ruzafa" },
      purchasePrice: null,
      builtAreaM2: { status: "confirmed", originalValue: 90 },
      usableAreaM2: null,
    });
    expect(note).toBe("De wijk is overgenomen uit de gekozen listing, niet door u bevestigd.");
  });

  it("joins two fields with 'en', plural verb", () => {
    const note = translateListingFieldsFromListingNote({
      neighborhood: { status: "fromListing", originalValue: "Ruzafa" },
      purchasePrice: null,
      builtAreaM2: { status: "fromListing", originalValue: 90 },
      usableAreaM2: { status: "confirmed", originalValue: 80 },
    });
    expect(note).toBe(
      "De wijk en het gebouwd oppervlak zijn overgenomen uit de gekozen listing, niet door u bevestigd.",
    );
  });

  it("joins all three fields with a Dutch comma-then-en list, plural verb", () => {
    const note = translateListingFieldsFromListingNote({
      neighborhood: { status: "fromListing", originalValue: "Ruzafa" },
      purchasePrice: { status: "confirmed", originalValue: 300000 },
      builtAreaM2: { status: "fromListing", originalValue: 90 },
      usableAreaM2: { status: "fromListing", originalValue: 80 },
    });
    expect(note).toBe(
      "De wijk, het gebouwd oppervlak en het bruikbaar oppervlak zijn overgenomen uit de gekozen listing, niet door u bevestigd.",
    );
  });
});
