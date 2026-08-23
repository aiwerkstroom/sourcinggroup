/**
 * How the free indication's disclosures are grouped on the page.
 *
 * Presentation only. The keys, their Dutch text and which of them a given
 * result carries are all unchanged (FreeTierDisclosureKey,
 * free-tier-disclosures.ts, band.ts) - this module says nothing about
 * *whether* a caveat applies, only about where it is shown.
 *
 * It exists because five separate caveats stacked under one another read
 * as five reasons to distrust the number, which is the opposite of what
 * they are for: each one tells the reader something specific about what
 * they are looking at. Three headed blocks say the same things while
 * reading as an explanation rather than a retraction.
 *
 * The Record is exhaustive over FreeTierDisclosureKey on purpose: a key
 * added to that union without a group here fails to compile, so a new
 * disclosure cannot quietly end up rendered nowhere. That includes the
 * two the result page renders separately next to the figure itself
 * ("band" and "pointEstimateFromCustomerInput") - they are assigned a
 * group so the type stays closed, and filtered out before grouping.
 */

import type { FreeTierDisclosureKey } from "../../rules/es/types";

export type FreeTierDisclosureGroup = "figure" | "data" | "scope";

export const FREE_TIER_DISCLOSURE_GROUP: Readonly<
  Record<FreeTierDisclosureKey, FreeTierDisclosureGroup>
> = {
  // What the figure does and does not account for.
  band: "figure",
  pointEstimateFromCustomerInput: "figure",
  financing: "figure",
  shortTermLicence: "figure",
  // Where the underlying numbers came from.
  unverified: "data",
  narrowedByCustomerInput: "data",
  // What this indication does not attempt to judge at all.
  indicativeScoreScope: "scope",
};

export const FREE_TIER_DISCLOSURE_GROUP_ORDER: readonly FreeTierDisclosureGroup[] = [
  "figure",
  "data",
  "scope",
];

/**
 * Headings that say what the block is about, so a reader can tell at a
 * glance which of the three concerns each one answers - rather than
 * meeting five sentences with no shape.
 */
export const FREE_TIER_DISCLOSURE_GROUP_HEADING_NL: Readonly<
  Record<FreeTierDisclosureGroup, string>
> = {
  figure: "Wat er wel en niet in dit bedrag zit",
  data: "Waar deze cijfers op rusten",
  scope: "Wat deze indicatie niet beoordeelt",
};

/**
 * Groups a result's keys, keeping each group's keys in the order they
 * arrived and dropping groups that end up empty - `narrowedByCustomerInput`
 * is conditional, so "data" can hold one key or two, and a future result
 * carrying none of a group's keys should not render an empty heading.
 */
export function groupFreeTierDisclosures(
  keys: readonly FreeTierDisclosureKey[],
): ReadonlyArray<{ group: FreeTierDisclosureGroup; keys: FreeTierDisclosureKey[] }> {
  return FREE_TIER_DISCLOSURE_GROUP_ORDER.map((group) => ({
    group,
    keys: keys.filter((key) => FREE_TIER_DISCLOSURE_GROUP[key] === group),
  })).filter((entry) => entry.keys.length > 0);
}
