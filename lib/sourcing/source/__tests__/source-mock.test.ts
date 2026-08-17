/**
 * Golden test for the mock source (SOURCING_SPEC.md §7 step 1).
 *
 * Three things carry real weight here, and the rest is bookkeeping:
 *
 * - REFERENTIAL INTEGRITY. Every sourceId a search returns must resolve
 *   through getListingDetail() to a detail whose own Listing-shaped
 *   fields match exactly what the search returned. A real scraper's
 *   search results and detail pages can drift (a price changes between
 *   pages, a listing gets pulled); the mock must not have that problem
 *   by construction, since nothing here is testing the scraper - it is
 *   testing that TSG's own code reads this contract correctly.
 * - THE SEARCH SHAPE IS THINNER THAN THE DETAIL SHAPE. searchListings()
 *   must actually strip ListingDetail's extra fields (rooms, bedrooms,
 *   description, ...), not just narrow the TypeScript type and still
 *   return the same object at runtime - that would silently leak detail
 *   fields into whatever eventually renders a search result.
 * - NEIGHBOURHOOD NAMES NEVER DRIFT FROM THE WIZARD'S. Every listing's
 *   `neighborhood` must be one of VALENCIA_NEIGHBORHOODS, which is read
 *   from the same NEIGHBORHOOD_RENT_LONG_TERM table the wizard's own Wijk
 *   dropdown uses (app/rapport/nieuw/pand/page.tsx) - a typo here would
 *   silently break SOURCING_SPEC.md §4's eventual wizard-prefill later,
 *   so it is caught now rather than assumed.
 */

import { describe, expect, it } from "vitest";
import { VALENCIA_NEIGHBORHOODS } from "../neighborhoods";
import { getListingDetail, searchListings } from "../source-mock";
import { SOURCE_PROPERTY_TYPES } from "../types";

describe("searchListings - the full, unfiltered set", () => {
  it("returns 30 hand-authored listings", async () => {
    const listings = await searchListings();
    expect(listings).toHaveLength(30);
  });

  it("gives every listing a unique sourceId", async () => {
    const listings = await searchListings();
    expect(new Set(listings.map((l) => l.sourceId)).size).toBe(listings.length);
  });

  it("covers all 13 wijken - none of the dropdown's options come back empty", async () => {
    const listings = await searchListings();
    const covered = new Set(listings.map((l) => l.neighborhood));
    for (const wijk of VALENCIA_NEIGHBORHOODS) {
      expect(covered.has(wijk)).toBe(true);
    }
  });

  it("never uses a neighbourhood the wizard's own dropdown would not offer", async () => {
    const listings = await searchListings();
    for (const listing of listings) {
      expect(VALENCIA_NEIGHBORHOODS).toContain(listing.neighborhood);
    }
  });

  it("only uses property types the wizard's own dropdown would offer", async () => {
    const listings = await searchListings();
    for (const listing of listings) {
      expect(SOURCE_PROPERTY_TYPES).toContain(listing.propertyType);
    }
  });

  it("points sourceUrl at the mock's own fake domain, never a real listings site", async () => {
    const listings = await searchListings();
    for (const listing of listings) {
      expect(listing.sourceUrl).toMatch(/^https:\/\/mock-source\.internal\//);
      expect(listing.sourceUrl).not.toMatch(/idealista|fotocasa|rightmove/i);
    }
  });

  it("does not leak detail-only fields into a search result", async () => {
    const listings = await searchListings();
    for (const listing of listings) {
      expect(listing).not.toHaveProperty("description");
      expect(listing).not.toHaveProperty("rooms");
      expect(listing).not.toHaveProperty("bedrooms");
      expect(listing).not.toHaveProperty("bathrooms");
      expect(listing).not.toHaveProperty("constructionYear");
      expect(listing).not.toHaveProperty("energyLabel");
    }
  });

  it("is deterministic - the same call twice returns the same set", async () => {
    const first = await searchListings();
    const second = await searchListings();
    expect(second.map((l) => l.sourceId).sort()).toEqual(first.map((l) => l.sourceId).sort());
  });
});

describe("searchListings - filtering", () => {
  it("filters by neighbourhood exactly", async () => {
    const listings = await searchListings({ neighborhood: "Ruzafa" });
    expect(listings.length).toBeGreaterThan(0);
    for (const listing of listings) {
      expect(listing.neighborhood).toBe("Ruzafa");
    }
  });

  it("returns nothing for a neighbourhood with no listings that also fails another filter", async () => {
    const listings = await searchListings({ neighborhood: "Cullera", minPriceEUR: 1_000_000 });
    expect(listings).toEqual([]);
  });

  it("filters by price range inclusively at both ends", async () => {
    // mock-009 (Cullera, studio) is priced at exactly 72000.
    const atLowerBound = await searchListings({ minPriceEUR: 72000, maxPriceEUR: 72000 });
    expect(atLowerBound.map((l) => l.sourceId)).toContain("mock-009");

    const justBelow = await searchListings({ minPriceEUR: 72001 });
    expect(justBelow.map((l) => l.sourceId)).not.toContain("mock-009");

    const justAbove = await searchListings({ maxPriceEUR: 71999 });
    expect(justAbove.map((l) => l.sourceId)).not.toContain("mock-009");
  });

  it("filters by property type", async () => {
    const listings = await searchListings({ propertyType: "villa" });
    expect(listings.length).toBeGreaterThan(0);
    for (const listing of listings) {
      expect(listing.propertyType).toBe("villa");
    }
  });

  it("combines all three filters narrower than any one alone", async () => {
    const byNeighborhoodOnly = await searchListings({ neighborhood: "El Carmen (Ciutat Vella)" });
    const combined = await searchListings({
      neighborhood: "El Carmen (Ciutat Vella)",
      propertyType: "studio",
      maxPriceEUR: 250000,
    });

    expect(combined.length).toBeLessThan(byNeighborhoodOnly.length);
    expect(combined.map((l) => l.sourceId)).toEqual(["mock-022"]);
  });

  it("an empty criteria object behaves like no filter at all", async () => {
    const withEmpty = await searchListings({});
    const withNone = await searchListings();
    expect(withEmpty.map((l) => l.sourceId).sort()).toEqual(withNone.map((l) => l.sourceId).sort());
  });
});

describe("getListingDetail", () => {
  it("resolves every sourceId a search returns, with matching Listing-shaped fields", async () => {
    const listings = await searchListings();

    for (const listing of listings) {
      const detail = await getListingDetail(listing.sourceId);
      expect(detail).not.toBeNull();
      expect(detail!.sourceId).toBe(listing.sourceId);
      expect(detail!.title).toBe(listing.title);
      expect(detail!.neighborhood).toBe(listing.neighborhood);
      expect(detail!.priceEUR).toBe(listing.priceEUR);
      expect(detail!.builtAreaM2).toBe(listing.builtAreaM2);
      expect(detail!.propertyType).toBe(listing.propertyType);
      expect(detail!.sourceUrl).toBe(listing.sourceUrl);
    }
  });

  it("carries detail-only fields the search result did not have", async () => {
    const detail = await getListingDetail("mock-021");
    expect(detail).not.toBeNull();
    expect(detail!.description).toBeTruthy();
    expect(detail!.rooms).toBe(4);
    expect(detail!.bedrooms).toBe(2);
    expect(detail!.bathrooms).toBe(2);
    expect(detail!.constructionYear).toBe(2015);
    expect(detail!.energyLabel).toBe("B");
  });

  it("returns null for an unknown sourceId rather than throwing", async () => {
    expect(await getListingDetail("mock-does-not-exist")).toBeNull();
  });

  it("returns a copy, not a live reference into the fixture", async () => {
    const first = await getListingDetail("mock-001");
    first!.priceEUR = 1;

    const second = await getListingDetail("mock-001");
    expect(second!.priceEUR).toBe(235000);
  });
});

describe("a pinned, reviewable listing (the fixture's own golden case)", () => {
  it("mock-021 matches exactly - the same discipline referenceCase.ts applies to the engine", async () => {
    const detail = await getListingDetail("mock-021");
    expect(detail).toEqual({
      sourceId: "mock-021",
      title: "Penthouse met dakterras in El Carmen",
      neighborhood: "El Carmen (Ciutat Vella)",
      priceEUR: 415000,
      builtAreaM2: 95,
      usableAreaM2: 88,
      propertyType: "penthouse",
      sourceUrl: "https://mock-source.internal/listings/mock-021",
      photoUrls: [
        "https://mock-source.internal/photos/mock-021-1.jpg",
        "https://mock-source.internal/photos/mock-021-2.jpg",
        "https://mock-source.internal/photos/mock-021-3.jpg",
      ],
      listedDate: "2026-06-08",
      description: "Penthouse in het historisch centrum met eigen dakterras.",
      rooms: 4,
      bedrooms: 2,
      bathrooms: 2,
      constructionYear: 2015,
      energyLabel: "B",
    });
  });
});
