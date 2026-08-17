/**
 * The search page's only state is the URL (SOURCING_SPEC.md §7 step 3),
 * the same choice /gratis's query-params.ts already made for the same
 * reason: no account-tied server state exists for a single search, so a
 * shareable/bookmarkable URL is both simpler and more useful than a form
 * that forgets itself on refresh. This module is the one place the query
 * keys are named, used by both the form (which builds the URL) and the
 * page (which reads it back), so the two cannot drift apart.
 *
 * minYieldPercent is carried here but is deliberately NOT part of
 * SearchCriteria (lib/sourcing/source/types.ts) - that type's own
 * docstring explains why: a real bron cannot filter on a yield it never
 * computes, so the threshold is applied by the caller, after
 * searchListings() returns, via computeSieveYield(). This module is
 * where "the page's one URL" and "the source's own narrower filter
 * contract" meet without either concept absorbing the other.
 */

import { SOURCE_PROPERTY_TYPES } from "@/lib/sourcing/source/types";
import type { PropertyType, SearchCriteria } from "@/lib/sourcing/source/types";

const KEYS = {
  neighborhood: "wijk",
  minPriceEUR: "prijsMin",
  maxPriceEUR: "prijsMax",
  propertyType: "type",
  minYieldPercent: "minYield",
} as const;

/** What the form collects and builds a URL from - strings, exactly as typed, parsed only when the URL is read back. */
export interface SearchFormValues {
  neighborhood: string;
  minPriceEUR: string;
  maxPriceEUR: string;
  propertyType: string;
  minYieldPercent: string;
}

export const EMPTY_SEARCH_FORM_VALUES: SearchFormValues = {
  neighborhood: "",
  minPriceEUR: "",
  maxPriceEUR: "",
  propertyType: "",
  minYieldPercent: "",
};

export interface ParsedSearchQuery {
  /** False only when the URL carries none of the five keys at all - the cold-entry case, distinct from "searched, zero results". */
  hasAnyCriteria: boolean;
  criteria: SearchCriteria;
  minYieldPercent: number | undefined;
  /** The raw strings, so the form can re-populate itself from a shared or bookmarked URL. */
  formValues: SearchFormValues;
}

function isPropertyType(value: string): value is PropertyType {
  return (SOURCE_PROPERTY_TYPES as readonly string[]).includes(value);
}

export function buildSearchQuery(input: SearchFormValues): URLSearchParams {
  const params = new URLSearchParams();
  if (input.neighborhood !== "") params.set(KEYS.neighborhood, input.neighborhood);
  if (input.minPriceEUR !== "") params.set(KEYS.minPriceEUR, input.minPriceEUR);
  if (input.maxPriceEUR !== "") params.set(KEYS.maxPriceEUR, input.maxPriceEUR);
  if (input.propertyType !== "") params.set(KEYS.propertyType, input.propertyType);
  if (input.minYieldPercent !== "") params.set(KEYS.minYieldPercent, input.minYieldPercent);
  return params;
}

/**
 * Reads the query back, tolerant of a tampered or hand-edited URL - same
 * philosophy as parseFreeIndicationQuery: there is no server state to
 * fall back on, so an unparseable price or an unknown property type is
 * not an error, it is simply "that filter does not apply". Every field
 * is independently optional; a customer may search on only a wijk, or
 * only a yield threshold.
 */
export function parseSearchQuery(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
): ParsedSearchQuery {
  const get = (key: string): string | undefined => {
    const raw = searchParams[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  const neighborhoodRaw = get(KEYS.neighborhood) ?? "";
  const minPriceRaw = get(KEYS.minPriceEUR) ?? "";
  const maxPriceRaw = get(KEYS.maxPriceEUR) ?? "";
  const propertyTypeRaw = get(KEYS.propertyType) ?? "";
  const minYieldRaw = get(KEYS.minYieldPercent) ?? "";

  const hasAnyCriteria =
    neighborhoodRaw !== "" || minPriceRaw !== "" || maxPriceRaw !== "" || propertyTypeRaw !== "" || minYieldRaw !== "";

  const criteria: SearchCriteria = {};
  if (neighborhoodRaw !== "") criteria.neighborhood = neighborhoodRaw;

  const minPrice = Number(minPriceRaw);
  if (minPriceRaw !== "" && Number.isFinite(minPrice) && minPrice >= 0) {
    criteria.minPriceEUR = minPrice;
  }

  const maxPrice = Number(maxPriceRaw);
  if (maxPriceRaw !== "" && Number.isFinite(maxPrice) && maxPrice >= 0) {
    criteria.maxPriceEUR = maxPrice;
  }

  if (propertyTypeRaw !== "" && isPropertyType(propertyTypeRaw)) {
    criteria.propertyType = propertyTypeRaw;
  }

  const minYield = Number(minYieldRaw);
  const minYieldPercent =
    minYieldRaw !== "" && Number.isFinite(minYield) && minYield >= 0 ? minYield : undefined;

  return {
    hasAnyCriteria,
    criteria,
    minYieldPercent,
    formValues: {
      neighborhood: neighborhoodRaw,
      minPriceEUR: minPriceRaw,
      maxPriceEUR: maxPriceRaw,
      propertyType: propertyTypeRaw,
      minYieldPercent: minYieldRaw,
    },
  };
}
