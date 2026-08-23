/**
 * The financing tiers, flattened into what wizard step 3 needs to show a
 * customer live as they type an LTV (fase C stap 3): which rate and term
 * their wanted LTV implies.
 *
 * This module exists because of where that has to run. The figures live in
 * parameters.ts, which is server-only - importing it (or anything that
 * imports it, including derive-selections.ts and financing.ts) into the
 * client form pulls the whole parameter database into the browser bundle,
 * since tree-shaking does not split that module. Fase C stap 1 made
 * exactly that mistake and had to undo it. But the answer changes on every
 * keystroke, so it cannot be resolved once on the server either.
 *
 * The split: the Server Component builds the bands below from
 * parameters.ts and hands them down; this module's picker is a pure data
 * traversal over that array and imports nothing. The *rule* - each band
 * covers LTVs up to its own, ascending, with the last band catching
 * anything above - is encoded in the order the server produces, and
 * financing-bands.test.ts pins the picker against the calculation layer's
 * own deriveFinancingStrategy() across the whole 0-1 range, so the two
 * cannot drift.
 */

export interface FinancingBand {
  /** FINANCING_STRATEGIES[id].ltv - the highest LTV this tier covers. */
  maxLtv: number;
  loanTermYears: number;
  /** Base tier rate plus any non-resident spread - the figure the customer is shown. */
  allInRate: number;
}

/**
 * The first band whose LTV covers `ltv`, or the last band when none does -
 * the same covering rule deriveFinancingStrategy() applies, and the same
 * fall-through for an LTV above every tier (the engine still clamps what
 * is actually borrowed; this only decides whose terms are quoted).
 *
 * Returns null for an empty table rather than inventing a band.
 */
export function pickFinancingBand(
  bands: readonly FinancingBand[],
  ltv: number,
): FinancingBand | null {
  if (bands.length === 0) return null;
  for (const band of bands) {
    if (ltv <= band.maxLtv) return band;
  }
  return bands[bands.length - 1]!;
}
