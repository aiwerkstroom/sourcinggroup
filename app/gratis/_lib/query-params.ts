/**
 * The free indication has no account and no server state (UI_SPEC.md §2),
 * so the result page's only input is the URL itself - the query string
 * IS the state, which is what makes the URL shareable. This module is the
 * one place the three query keys are named, used by both the form (which
 * builds the URL) and the result page (which reads it back), so the two
 * cannot drift apart.
 *
 * Datakwaliteitsfix stap 6 removed propertyType and units: UI_SPEC.md §3
 * used to ask for all five first-order fields, but only these three ever
 * fed computeFreeTierBand() (FreeTierBandInput) - the other two were
 * carried through and displayed without entering the calculation, which
 * is exactly the gap the fix closed by removing them from the form.
 */

export interface FreeIndicationQuery {
  neighborhood: string;
  purchasePrice: number;
  builtAreaM2: number;
}

const KEYS = {
  neighborhood: "wijk",
  purchasePrice: "prijs",
  builtAreaM2: "m2",
} as const;

export function buildFreeIndicationQuery(input: FreeIndicationQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set(KEYS.neighborhood, input.neighborhood);
  params.set(KEYS.purchasePrice, String(input.purchasePrice));
  params.set(KEYS.builtAreaM2, String(input.builtAreaM2));
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

  return {
    ok: true,
    value: { neighborhood, purchasePrice, builtAreaM2 },
  };
}
