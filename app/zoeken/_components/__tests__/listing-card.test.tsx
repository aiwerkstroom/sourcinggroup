/**
 * Golden test for one listing's card (SOURCING_SPEC.md §7 step 3).
 *
 * The disclosure-set check is the one that matters most here: this test
 * asserts that all four SourcingYieldDisclosureKey sentences are present
 * in the card's own rendered HTML, verbatim against the Dutch copy layer
 * - not a mocked stand-in for it. A card that renders the percentage
 * without its scope is exactly the failure mode this step's design was
 * built to prevent.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SOURCING_YIELD_DISCLOSURE_COPY_NL } from "@/lib/copy/es/sourcing-yield-disclosures";
import { getListingDetail } from "@/lib/sourcing/source/source-mock";
import { computeSieveYield } from "@/lib/sourcing/yield/sieve-yield";
import { ListingCard } from "../listing-card";

async function renderCard(sourceId: string): Promise<string> {
  const listing = await getListingDetail(sourceId);
  if (listing === null) throw new Error(`Fixture missing: ${sourceId}`);
  const sieveYield = computeSieveYield(listing);
  return renderToStaticMarkup(<ListingCard listing={listing} sieveYield={sieveYield} />);
}

describe("ListingCard - brondata", () => {
  it("shows the wijk, price, type and area", async () => {
    const html = await renderCard("mock-021");

    expect(html).toContain("El Carmen (Ciutat Vella)");
    expect(html).toContain("Penthouse met dakterras in El Carmen");
    expect(html).toContain("Penthouse");
    expect(html).toContain("88"); // usableAreaM2, given directly for this listing
    expect(html.replace(/&\S+?;/g, " ")).toMatch(/415/); // priceEUR, formatted through Intl
  });

  it("labels the area as bruikbaar when the listing gives its own usableAreaM2", async () => {
    const html = await renderCard("mock-021");
    expect(html).toContain("bruikbaar");
  });

  it("labels the area as gebouwd when usableAreaM2 has to be derived", async () => {
    const html = await renderCard("mock-009"); // Cullera, no usableAreaM2 on the fixture
    expect(html).toContain("gebouwd");
  });
});

describe("ListingCard - the sieve-yield percentage never renders without its disclosure set", () => {
  it("shows the anchored percentage (mock-021: 6%)", async () => {
    const html = await renderCard("mock-021");
    expect(html).toContain("6%");
    expect(html).toContain("Indicatieve bruto yield");
  });

  it("carries all four disclosure sentences verbatim, every time", async () => {
    for (const id of ["mock-001", "mock-009", "mock-021", "mock-016", "mock-030"]) {
      const html = await renderCard(id);
      expect(html).toContain(SOURCING_YIELD_DISCLOSURE_COPY_NL.grossOnly);
      expect(html).toContain(SOURCING_YIELD_DISCLOSURE_COPY_NL.longTermOnly);
      expect(html).toContain(SOURCING_YIELD_DISCLOSURE_COPY_NL.neighborhoodAverage);
      expect(html).toContain(SOURCING_YIELD_DISCLOSURE_COPY_NL.notTheReport);
    }
  });
});

describe("ListingCard - neutral language", () => {
  it("never uses recommendation language", async () => {
    const html = await renderCard("mock-021");
    expect(html.toLowerCase()).not.toContain("aanbevolen");
    expect(html.toLowerCase()).not.toContain("beste");
    expect(html.toLowerCase()).not.toContain("aanrader");
  });
});
