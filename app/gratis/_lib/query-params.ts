/**
 * The free indication has no account and no server state (UI_SPEC.md §2),
 * so the result page's only input is the URL itself - the query string
 * IS the state, which is what makes the URL shareable. This module is the
 * one place the five query keys are named, used by both the form (which
 * builds the URL) and the result page (which reads it back), so the two
 * cannot drift apart.
 *
 * Only neighborhood/purchasePrice/builtAreaM2 feed
 * computeFreeTierBand() (FreeTierBandInput). propertyType and units are
 * carried through anyway - UI_SPEC.md §3 asks for all five first-order
 * fields, and the result page still shows what the customer entered - but
 * neither is validated as strictly as the three that drive the
 * calculation, since an unparseable one still leaves a valid indication.
 */

export interface FreeIndicationQuery {
  neighborhood: string;
  purchasePrice: number;
  builtAreaM2: number;
  propertyType?: string;
  units?: number;
}

const KEYS = {
  neighborhood: "wijk",
  purchasePrice: "prijs",
  builtAreaM2: "m2",
  propertyType: "type",
  units: "eenheden",
} as const;

export function buildFreeIndicationQuery(input: FreeIndicationQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set(KEYS.neighborhood, input.neighborhood);
  params.set(KEYS.purchasePrice, String(input.purchasePrice));
  params.set(KEYS.builtAreaM2, String(input.builtAreaM2));
  if (input.propertyType !== undefined && input.propertyType !== "") {
    params.set(KEYS.propertyType, input.propertyType);
  }
  if (input.units !== undefined) {
    params.set(KEYS.units, String(input.units));
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

  const propertyType = get(KEYS.propertyType);
  const unitsRaw = get(KEYS.units);
  const units = unitsRaw === undefined ? undefined : Number(unitsRaw);

  return {
    ok: true,
    value: {
      neighborhood,
      purchasePrice,
      builtAreaM2,
      propertyType: propertyType === undefined || propertyType === "" ? undefined : propertyType,
      units: units !== undefined && Number.isFinite(units) ? units : undefined,
    },
  };
}
