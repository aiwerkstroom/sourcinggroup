/**
 * The 13 wijken pijler 2's search criteria offer (SOURCING_SPEC.md §2:
 * "Wijk-dropdown (dezelfde 13 als de wizard)").
 *
 * Read from NEIGHBORHOOD_RENT_LONG_TERM rather than duplicated as a
 * literal list. That table is already the wizard's own source of truth -
 * app/rapport/nieuw/pand/page.tsx reads it the same way, server-side, to
 * build the Wijk dropdown - so importing it here guarantees pijler 2's
 * neighbourhood names can never drift from the wizard's. That guarantee
 * matters beyond consistency: SOURCING_SPEC.md §4's eventual
 * listing-to-wizard prefill needs `listing.neighborhood` to match a
 * value the wizard's own Wijk field already accepts, or the prefill
 * silently fails. Small, presentational primitives (Card, Spinner) get
 * duplicated per route family elsewhere in this project; a canonical
 * name list that two features must agree on does not - that would
 * reintroduce the exact drift this avoids.
 */
import { NEIGHBORHOOD_RENT_LONG_TERM } from "@/lib/rules/es/parameters";

export const VALENCIA_NEIGHBORHOODS: readonly string[] = Object.keys(
  NEIGHBORHOOD_RENT_LONG_TERM.value,
);
