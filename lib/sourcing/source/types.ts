/**
 * Source-neutral types for pijler 2 (SOURCING_SPEC.md §1).
 *
 * `Listing` and `ListingDetail` describe what TSG's own code works with,
 * not what any particular scraper returns. The adapter behind
 * source-mock.ts's eventual real-SDK replacement is what translates a
 * bron's own shape into these - so nothing about Idealista's field names,
 * pagination, or quirks is allowed to leak past that one file. Every
 * caller in this codebase (the search page, later the wizard-prefill)
 * only ever sees this shape.
 */

/**
 * Mirrors app/rapport/nieuw/pand/pand-form.tsx's own PROPERTY_TYPES
 * values - duplicated rather than imported, the same decoupling this
 * project already applies to small route-private primitives (Card,
 * Spinner in /gratis, /app/auth, /app/rapport/betalen). The wizard stays
 * untouched by pijler 2 (SOURCING_SPEC.md's own opening line); a shared
 * import would be a dependency running the other way.
 */
export const SOURCE_PROPERTY_TYPES = [
  "appartement",
  "studio",
  "penthouse",
  "woonhuis",
  "villa",
  "anders",
] as const;

export type PropertyType = (typeof SOURCE_PROPERTY_TYPES)[number];

/**
 * The minimal shape SOURCING_SPEC.md §1 names: sourceId, neighborhood,
 * priceEUR, builtAreaM2, propertyType, sourceUrl, title, plus the three
 * optional fields. Nothing here assumes a specific source - a real
 * scraper adapter fills exactly this and nothing else it cannot vouch
 * for.
 */
export interface Listing {
  sourceId: string;
  title: string;
  neighborhood: string;
  priceEUR: number;
  builtAreaM2: number;
  propertyType: PropertyType;
  sourceUrl: string;
  usableAreaM2?: number;
  photoUrls?: string[];
  /** ISO 8601 date the listing first appeared at the source. */
  listedDate?: string;
}

/**
 * A single listing's full detail page. Provisional beyond `Listing`
 * itself: SOURCING_SPEC.md §4 defers the wizard-prefill mapping to its
 * own design review ("ontwerp deze provenance-uitbreiding en leg hem
 * voor voordat je hem bouwt"), so nothing here should be read as already
 * wired to WizardData. These are the fields a detail page plausibly
 * carries beyond the search-result summary - not yet a commitment about
 * which of them prefill which wizard field.
 */
export interface ListingDetail extends Listing {
  description?: string;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  constructionYear?: number;
  energyLabel?: string;
}

/**
 * SOURCING_SPEC.md §2's four filters, minus the yield threshold: that
 * filter is a post-search step (the yield calc it needs is its own
 * pending design item, §7 step 2), not something a real scraper source
 * could filter on directly - a bron only ever knows location, price, and
 * type. Keeping it out of this type is a deliberate omission, not an
 * oversight: it stops this step from quietly presupposing an answer to
 * a question that still needs Samuel's sign-off.
 *
 * `neighborhood` matches one of VALENCIA_NEIGHBORHOODS
 * (neighborhoods.ts) - SOURCING_SPEC.md §2's "bredere regio" option is
 * left for the search page (§7 step 3) to design; no region taxonomy is
 * invented here.
 */
export interface SearchCriteria {
  neighborhood?: string;
  minPriceEUR?: number;
  maxPriceEUR?: number;
  propertyType?: PropertyType;
}
