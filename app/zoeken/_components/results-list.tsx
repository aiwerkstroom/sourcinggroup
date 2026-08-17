/**
 * The search results (SOURCING_SPEC.md §7 step 3). Plain function
 * component, same reasoning as ListingCard's own docstring - server-only
 * rendering keeps every SieveYieldResult passed through here off the
 * client bundle.
 *
 * Neutral by construction, not just by copy: this component receives an
 * already-sorted list and renders it in that order - there is no
 * "sort by relevance" option in this file's own vocabulary to reach for
 * even by accident. The one sort this route offers (price, ascending)
 * is applied in page.tsx and named explicitly in the header here, so
 * the ordering is never silent (SOURCING_SPEC.md's own instruction:
 * a neutral sort is fine, "beste match" never is).
 */

import type { Listing } from "@/lib/sourcing/source/types";
import type { SieveYieldResult } from "@/lib/sourcing/yield/types";
import { ListingCard } from "./listing-card";

export interface ResultsListProps {
  results: ReadonlyArray<{ listing: Listing; sieveYield: SieveYieldResult }>;
}

export function ResultsList({ results }: ResultsListProps) {
  if (results.length === 0) {
    return (
      <p className="text-text-muted text-sm">
        Geen panden voldoen aan uw criteria. Pas de filters aan om het zoekgebied te verruimen.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-text-faint text-xs tracking-widest uppercase">
        {results.length} {results.length === 1 ? "pand voldoet" : "panden voldoen"} aan uw criteria —
        gesorteerd op prijs, laag naar hoog
      </p>
      <div className="flex flex-col gap-4">
        {results.map(({ listing, sieveYield }) => (
          <ListingCard key={listing.sourceId} listing={listing} sieveYield={sieveYield} />
        ))}
      </div>
    </div>
  );
}
