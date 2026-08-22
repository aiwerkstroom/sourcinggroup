/**
 * The free indication has no account and no server state (UI_SPEC.md §2),
 * so the result page's only input is the URL itself - the query string
 * IS the state, which is what makes the URL shareable. This module is the
 * one place the query keys are named, used by both the form (which builds
 * the URL) and the result page (which reads it back), so the two cannot
 * drift apart.
 *
 * Datakwaliteitsfix stap 6 removed propertyType and units: UI_SPEC.md §3
 * used to ask for all five first-order fields, but only three ever fed
 * computeFreeTierBand() (FreeTierBandInput) - the other two were carried
 * through and displayed without entering the calculation, which is
 * exactly the gap the fix closed by removing them from the form.
 *
 * Fase A stap 1 added three more, optional keys: communityFeesAnnual,
 * maintenanceCondition and rentLevel each narrow the band when given (see
 * FreeTierBandInput's own docstring) and travel through the URL the same
 * way the three original fields do, so a shared link or a bookmark
 * reproduces the narrowed band exactly, not the wide default.
 */

import type { FreeTierRentLevel, MaintenanceCondition } from "@/lib/rules/es/types";

export interface FreeIndicationQuery {
  neighborhood: string;
  purchasePrice: number;
  builtAreaM2: number;
  communityFeesAnnual?: number;
  maintenanceCondition?: MaintenanceCondition;
  rentLevel?: FreeTierRentLevel;
}

const KEYS = {
  neighborhood: "wijk",
  purchasePrice: "prijs",
  builtAreaM2: "m2",
  communityFeesAnnual: "servicekosten",
  maintenanceCondition: "onderhoud",
  rentLevel: "huurniveau",
} as const;

const MAINTENANCE_CONDITIONS: readonly MaintenanceCondition[] = ["good", "average", "poor"];
const RENT_LEVELS: readonly FreeTierRentLevel[] = ["below", "average", "above"];

export function buildFreeIndicationQuery(input: FreeIndicationQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set(KEYS.neighborhood, input.neighborhood);
  params.set(KEYS.purchasePrice, String(input.purchasePrice));
  params.set(KEYS.builtAreaM2, String(input.builtAreaM2));
  if (input.communityFeesAnnual !== undefined) {
    params.set(KEYS.communityFeesAnnual, String(input.communityFeesAnnual));
  }
  if (input.maintenanceCondition !== undefined) {
    params.set(KEYS.maintenanceCondition, input.maintenanceCondition);
  }
  if (input.rentLevel !== undefined) {
    params.set(KEYS.rentLevel, input.rentLevel);
  }
  return params;
}

export type ParsedFreeIndicationQuery =
  | { ok: true; value: FreeIndicationQuery }
  | { ok: false };

/**
 * Reads the query back, tolerant of a tampered or hand-edited URL: since
 * there is no server state to fall back on, an unparseable purchase price
 * or area is not a crash, it is simply "not a valid indication" - the
 * page decides what to show for that, this function only decides whether
 * the three figures the calculation needs are present and sound.
 * `computeFreeTierBand` itself is the authority on whether the
 * neighbourhood is one of the covered wijken.
 *
 * The three fase A stap 1 fields are tolerant in the same spirit: an
 * unparseable communityFeesAnnual, or a maintenanceCondition/rentLevel
 * value outside the closed set this module itself defines, is dropped
 * rather than failing the whole indication - a hand-edited or stale URL
 * simply falls back to the wide band for that one dimension.
 */
export function parseFreeIndicationQuery(
  searchParams: Readonly<Record<string, string | string[] | undefined>>,
): ParsedFreeIndicationQuery {
  const get = (key: string): string | undefined => {
    const raw = searchParams[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };

  const neighborhood = get(KEYS.neighborhood);
  const purchasePriceRaw = get(KEYS.purchasePrice);
  const builtAreaM2Raw = get(KEYS.builtAreaM2);

  if (neighborhood === undefined || neighborhood === "") return { ok: false };

  const purchasePrice = purchasePriceRaw === undefined ? NaN : Number(purchasePriceRaw);
  const builtAreaM2 = builtAreaM2Raw === undefined ? NaN : Number(builtAreaM2Raw);
  if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) return { ok: false };
  if (!Number.isFinite(builtAreaM2) || builtAreaM2 <= 0) return { ok: false };

  const communityFeesAnnualRaw = get(KEYS.communityFeesAnnual);
  const communityFeesAnnual =
    communityFeesAnnualRaw === undefined ? NaN : Number(communityFeesAnnualRaw);

  const maintenanceConditionRaw = get(KEYS.maintenanceCondition);
  const rentLevelRaw = get(KEYS.rentLevel);

  return {
    ok: true,
    value: {
      neighborhood,
      purchasePrice,
      builtAreaM2,
      communityFeesAnnual:
        Number.isFinite(communityFeesAnnual) && communityFeesAnnual >= 0
          ? communityFeesAnnual
          : undefined,
      maintenanceCondition: MAINTENANCE_CONDITIONS.find((c) => c === maintenanceConditionRaw),
      rentLevel: RENT_LEVELS.find((l) => l === rentLevelRaw),
    },
  };
}
