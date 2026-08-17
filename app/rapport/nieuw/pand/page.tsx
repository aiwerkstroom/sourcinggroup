import { NEIGHBORHOOD_RENT_LONG_TERM } from "@/lib/rules/es/parameters";
import { getListingDetail } from "@/lib/sourcing/source/source-mock";
import { PandForm } from "./pand-form";

/**
 * Step 1 - het pand. Server Component: it reads the covered wijken from
 * parameters.ts here, on the server, and hands the client form a plain
 * list of names. That is what keeps parameters.ts - and with it
 * TSG_SCORE_DIMENSION_WEIGHTS, which UI_SPEC.md §5 says is not published -
 * out of the browser bundle, per interview round 1's server-side decision.
 *
 * `?listing=<sourceId>` (SOURCING_SPEC.md §4/§7 step 4) is the handoff
 * from a chosen listing on /zoeken: this page re-fetches the listing
 * itself here, server-side, via getListingDetail() - the same
 * source-mock.ts function /zoeken already calls to build its own list,
 * never client-bundled. Only the opaque sourceId crosses the URL; the
 * listing's own data (price, area, ...) never does.
 *
 * An unknown or no-longer-available sourceId - getListingDetail()
 * returns null - is not an error page. PandForm's own prefill effect
 * already treats a null prefillListing as "nothing to prefill", so a
 * stale link lands the customer on the same empty wizard a direct visit
 * would, and they fill it in by hand. Nothing extra to build for that
 * case; it falls out of the existing null-check.
 */
export default async function PandPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const neighborhoods = Object.keys(NEIGHBORHOOD_RENT_LONG_TERM.value);

  const resolved = await searchParams;
  const listingParam = resolved.listing;
  const sourceId = Array.isArray(listingParam) ? listingParam[0] : listingParam;
  const prefillListing = sourceId !== undefined ? await getListingDetail(sourceId) : null;

  return <PandForm neighborhoods={neighborhoods} prefillListing={prefillListing} />;
}
