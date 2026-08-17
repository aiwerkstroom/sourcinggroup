/**
 * One listing's card in the results list (SOURCING_SPEC.md §7 step 3).
 * Plain function component, no "use client" - it renders server-side
 * only, the same way the paid report's own section components do, which
 * is what keeps a full SieveYieldResult (including placeholdersUsed's
 * Parameter objects, with their internal .reasoning/.source/.date
 * fields) safe to pass as a prop here: nothing in this subtree crosses
 * into a client bundle, so those fields are consumed entirely
 * server-side while producing HTML and never reach the browser as raw
 * data - only the Dutch sentences this component chooses to render do.
 *
 * Language stays neutral throughout (SOURCING_SPEC.md's Kernprincipe):
 * "voldoet aan uw criteria", never "aanbevolen" or a ranking claim. No
 * colour signal on the yield percentage either - UI_SPEC.md §1 reserves
 * colour for a pass/fail threshold the customer set explicitly
 * elsewhere (the paid report's own thresholds section), not for a
 * sieve figure that is already filtered to "passed" by the time it
 * reaches this card.
 */

import type { Listing } from "@/lib/sourcing/source/types";
import type { SieveYieldResult } from "@/lib/sourcing/yield/types";
import { Card } from "./card";
import { formatEuro, PROPERTY_TYPE_LABEL_NL } from "../_lib/format";
import { SieveYieldDisclosures } from "./sieve-yield-disclosures";

export function ListingCard({
  listing,
  sieveYield,
}: {
  listing: Listing;
  sieveYield: SieveYieldResult;
}) {
  const area = listing.usableAreaM2 ?? listing.builtAreaM2;
  const areaLabel = listing.usableAreaM2 !== undefined ? "m² bruikbaar" : "m² gebouwd";

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-text-faint text-xs tracking-widest uppercase">{listing.neighborhood}</p>
          <h3 className="mt-1 text-base font-semibold">{listing.title}</h3>
          <p className="text-text-muted mt-1 text-sm">
            {PROPERTY_TYPE_LABEL_NL[listing.propertyType] ?? listing.propertyType} · {area} {areaLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="tabular text-lg font-semibold">{formatEuro(listing.priceEUR)}</p>
        </div>
      </div>

      <div className="border-border mt-4 border-t pt-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm font-medium">Indicatieve bruto yield (zeef)</span>
          <span className="tabular text-lg font-semibold">{sieveYield.sieveYieldPercent}%</span>
        </div>
        <SieveYieldDisclosures disclosures={sieveYield.disclosures} />
      </div>
    </Card>
  );
}
