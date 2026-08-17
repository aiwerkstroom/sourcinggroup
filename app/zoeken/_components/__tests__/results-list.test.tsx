/**
 * Golden test for the results list itself (SOURCING_SPEC.md §7 step 3):
 * neutral framing, the stated sort order, the zero-results state, and -
 * swept across every card in a real multi-listing list, not just one -
 * that the disclosure set is never absent.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SOURCING_YIELD_DISCLOSURE_COPY_NL } from "@/lib/copy/es/sourcing-yield-disclosures";
import { getListingDetail, searchListings } from "@/lib/sourcing/source/source-mock";
import { computeSieveYield } from "@/lib/sourcing/yield/sieve-yield";
import { ResultsList } from "../results-list";

async function pair(sourceId: string) {
  const listing = await getListingDetail(sourceId);
  if (listing === null) throw new Error(`Fixture missing: ${sourceId}`);
  return { listing, sieveYield: computeSieveYield(listing) };
}

describe("ResultsList - zero results", () => {
  it("shows a neutral message, never an apology or an error tone", () => {
    const html = renderToStaticMarkup(<ResultsList results={[]} />);
    expect(html).toContain("Geen panden voldoen aan uw criteria");
    expect(html.toLowerCase()).not.toContain("helaas");
    expect(html.toLowerCase()).not.toContain("fout");
  });
});

describe("ResultsList - the neutral sort is named, not silent", () => {
  it("states the sort order and the result count in the header line", async () => {
    const results = [await pair("mock-009"), await pair("mock-021")];
    const html = renderToStaticMarkup(<ResultsList results={results} />);

    expect(html).toContain("2 panden voldoen aan uw criteria");
    expect(html).toContain("gesorteerd op prijs");
  });

  it("uses the singular for exactly one result", async () => {
    const html = renderToStaticMarkup(<ResultsList results={[await pair("mock-009")]} />);
    expect(html).toContain("1 pand voldoet aan uw criteria");
  });

  it("renders results in the order it was given - no re-sorting or re-ranking of its own", async () => {
    // Deliberately out of price order (mock-030 is far more expensive
    // than mock-009): ResultsList must not silently reorder what it was
    // handed. Sorting is page.tsx's job.
    const results = [await pair("mock-030"), await pair("mock-009")];
    const html = renderToStaticMarkup(<ResultsList results={results} />);

    const posExpensive = html.indexOf("Groot herenhuis in El Carmen");
    const posCheap = html.indexOf("Studio vlak bij het strand van Cullera");
    expect(posExpensive).toBeGreaterThanOrEqual(0);
    expect(posCheap).toBeGreaterThan(posExpensive);
  });
});

describe("ResultsList - never a ranking claim", () => {
  it("contains no recommendation or ranking language anywhere in the list", async () => {
    const results = [await pair("mock-009"), await pair("mock-021"), await pair("mock-016")];
    const html = renderToStaticMarkup(<ResultsList results={results} />);

    expect(html.toLowerCase()).not.toContain("aanbevolen");
    expect(html.toLowerCase()).not.toContain("beste match");
    expect(html.toLowerCase()).not.toContain("top pand");
  });
});

describe("ResultsList - the disclosure set is never absent, across a full list", () => {
  it("every card in a multi-listing list carries all four disclosure sentences", async () => {
    const allListings = await searchListings();
    const results = allListings
      .slice(0, 8)
      .map((listing) => ({ listing, sieveYield: computeSieveYield(listing) }));

    const html = renderToStaticMarkup(<ResultsList results={results} />);

    // The count of each disclosure sentence in the combined HTML must
    // equal the number of cards - proving every single card carries its
    // own copy, not that the sentence merely appears somewhere on the
    // page once.
    const occurrences = (needle: string) => html.split(needle).length - 1;
    expect(occurrences(SOURCING_YIELD_DISCLOSURE_COPY_NL.grossOnly)).toBe(results.length);
    expect(occurrences(SOURCING_YIELD_DISCLOSURE_COPY_NL.longTermOnly)).toBe(results.length);
    expect(occurrences(SOURCING_YIELD_DISCLOSURE_COPY_NL.neighborhoodAverage)).toBe(results.length);
    expect(occurrences(SOURCING_YIELD_DISCLOSURE_COPY_NL.notTheReport)).toBe(results.length);
  });
});
