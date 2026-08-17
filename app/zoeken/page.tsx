/**
 * The search page (SOURCING_SPEC.md §7 step 3): criteria in, a neutral
 * results list out. Server Component - the first route to import
 * lib/sourcing, which is exactly why everything server-only in that
 * tree (source-mock.ts's registry, sieve-yield.ts, and through it
 * parameters.ts) must stay reachable only from here and from the plain
 * (non-"use client") components this page renders directly.
 *
 * BUNDLE-SWEEP BOUNDARY, stated once rather than per file: the only
 * thing this page hands to a Client Component (SearchForm) is
 * `neighborhoods: string[]` (plain names, computed here from
 * VALENCIA_NEIGHBORHOODS - the same pattern
 * app/rapport/nieuw/pand/page.tsx already established for the identical
 * problem) and the URL's own already-parsed form values. Every listing
 * and every SieveYieldResult - including placeholdersUsed's full
 * Parameter objects, which carry internal .reasoning/.source/.date text
 * no differently than TSG_SCORE_DIMENSION_WEIGHTS's own neighbours in
 * parameters.ts - flows only into ResultsList/ListingCard, which are
 * plain function components with no "use client" anywhere in their own
 * module graph. Nothing in that path is ever bundled for the browser.
 * Verified after building, not just reasoned about: grep the built
 * .next/static output for this route's own listing/parameter internals,
 * the same discipline every other phase's bundle-sweep already applies.
 *
 * Search results compute in three steps, deliberately kept separate:
 * searchListings(criteria) (the bron's own filters: wijk, prijs, type -
 * never yield, SearchCriteria's own docstring explains why), then
 * computeSieveYield() per listing (never runEngine() - this is a sieve,
 * not a report), then a post-filter on sieveYieldPercent and a sort by
 * price. The yield threshold cannot be pushed into step one because no
 * bron can filter on a number it does not compute.
 */

import { NEIGHBORHOOD_RENT_LONG_TERM } from "@/lib/rules/es/parameters";
import { searchListings } from "@/lib/sourcing/source/source-mock";
import { computeSieveYield } from "@/lib/sourcing/yield/sieve-yield";
import { parseSearchQuery } from "./_lib/query-params";
import { ResultsList } from "./_components/results-list";
import { SearchForm } from "./_components/search-form";

export const dynamic = "force-dynamic";

export default async function ZoekenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const query = parseSearchQuery(resolved);

  // Plain string[] only - see the module docstring's bundle-sweep note.
  const neighborhoods = Object.keys(NEIGHBORHOOD_RENT_LONG_TERM.value);

  const results = query.hasAnyCriteria
    ? (await searchListings(query.criteria))
        .map((listing) => ({ listing, sieveYield: computeSieveYield(listing) }))
        .filter(
          ({ sieveYield }) =>
            query.minYieldPercent === undefined || sieveYield.sieveYieldPercent >= query.minYieldPercent,
        )
        .sort((a, b) => a.listing.priceEUR - b.listing.priceEUR)
    : null;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10 md:px-8">
      <header className="border-border border-b pb-6">
        <p className="text-text-faint text-xs tracking-widest uppercase">Panden zoeken</p>
        <h1 className="mt-1 text-xl font-semibold">Zoek panden die aan uw criteria voldoen</h1>
        <p className="text-text-muted mt-2 max-w-prose text-sm leading-relaxed">
          Deze lijst rangschikt niet op aantrekkelijkheid en beveelt niets aan - hij toont wat aan de
          door u opgegeven criteria voldoet. De yield hieronder is een grove zeef om te filteren, geen
          rendementscijfer uit het betaalde rapport.
        </p>
      </header>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.4fr] md:items-start">
        <SearchForm neighborhoods={neighborhoods} initialValues={query.formValues} />

        <div>
          {results === null ? (
            <p className="text-text-muted text-sm">Vul uw criteria in om te zoeken.</p>
          ) : (
            <ResultsList results={results} />
          )}
        </div>
      </div>
    </div>
  );
}
