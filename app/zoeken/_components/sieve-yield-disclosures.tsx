/**
 * The sieve-yield's mandatory disclosure text (SOURCING_SPEC.md §7 step
 * 2's design, this step's own instruction: "het getal mag nergens los
 * verschijnen"). Renders all four SourcingYieldDisclosureKey sentences
 * in full - the same "no fold, no accordion" choice
 * indicatie-result.tsx already made for the free indication's own
 * disclosures, not a new UI pattern invented for this route. Small and
 * muted (text-xs, text-muted) so it reads as scope-setting context
 * rather than competing with the percentage it sits under, the same
 * visual weight a field's `hint` text already carries everywhere else in
 * this project.
 *
 * A plain function component - no "use client". Every ListingCard on
 * the results list renders one of these, and the page that renders them
 * (page.tsx) is itself a Server Component, so nothing here needs to
 * cross a client boundary at all.
 */

import { translateSourcingYieldDisclosures } from "@/lib/copy/es/sourcing-yield-disclosures";
import type { SourcingYieldDisclosureKey } from "@/lib/sourcing/yield/types";

export function SieveYieldDisclosures({
  disclosures,
}: {
  disclosures: readonly SourcingYieldDisclosureKey[];
}) {
  const sentences = translateSourcingYieldDisclosures(disclosures);

  return (
    <ul className="text-text-muted mt-3 flex flex-col gap-1.5 text-xs leading-relaxed">
      {sentences.map((sentence, index) => (
        // Stable within one result: the four keys and their order never
        // change per listing, so the array index is a safe key here.
        <li key={index}>{sentence}</li>
      ))}
    </ul>
  );
}
