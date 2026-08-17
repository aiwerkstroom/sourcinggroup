/**
 * Dutch copy for the sourcing sieve's yield disclosures (UI_SPEC.md:
 * Nederlands in de UI; CLAUDE.md §6: Engels in de code en commentaar).
 * Same split as lib/copy/es/free-tier-disclosures.ts: the calculation
 * layer (lib/sourcing/yield/sieve-yield.ts) emits
 * SourcingYieldDisclosureKey values, not text - this file is the only
 * place those four keys become the sentences a page shows next to a
 * listing's sieve-yield percentage.
 *
 * The Record below, plus the exhaustiveness-guarded switch beneath it,
 * is what keeps the coupling hard: TypeScript requires every member of
 * SourcingYieldDisclosureKey to have an entry, so a key added to that
 * union without a matching line here fails to compile, not just fails to
 * render.
 */

import type { SourcingYieldDisclosureKey } from "@/lib/sourcing/yield/types";

export const SOURCING_YIELD_DISCLOSURE_COPY_NL: Readonly<
  Record<SourcingYieldDisclosureKey, string>
> = {
  grossOnly:
    "Dit is een bruto rendement: er is niets afgetrokken voor servicekosten, " +
    "onderhoud, beheer of gemeentelijke belasting. Het volledige rapport laat dat " +
    "wel zien.",
  longTermOnly:
    "Berekend met langetermijnverhuur, ongeacht of dit pand een título habilitante " +
    "voor kortetermijnverhuur heeft — die informatie staat niet in een zoekresultaat.",
  neighborhoodAverage:
    "Gebaseerd op de gemiddelde huur in de wijk, niet op de werkelijke huur die dit " +
    "specifieke pand zou opbrengen.",
  notTheReport:
    "Dit is een grove zeef om te filteren, geen rendementscijfer uit het betaalde " +
    "rapport. Voor de volledige doorrekening doorloopt u de wizard.",
};

/**
 * Translates one disclosure key. A switch with an exhaustiveness guard,
 * on top of the Record above - same double-check
 * translateFreeTierDisclosure uses, so this does not rest on
 * object-literal typing alone.
 */
export function translateSourcingYieldDisclosure(key: SourcingYieldDisclosureKey): string {
  switch (key) {
    case "grossOnly":
      return SOURCING_YIELD_DISCLOSURE_COPY_NL.grossOnly;
    case "longTermOnly":
      return SOURCING_YIELD_DISCLOSURE_COPY_NL.longTermOnly;
    case "neighborhoodAverage":
      return SOURCING_YIELD_DISCLOSURE_COPY_NL.neighborhoodAverage;
    case "notTheReport":
      return SOURCING_YIELD_DISCLOSURE_COPY_NL.notTheReport;
    default: {
      const exhaustive: never = key;
      throw new Error(`Missing Dutch copy for sourcing yield disclosure key: ${String(exhaustive)}`);
    }
  }
}

/** Translates a full list of keys, in order - what a page calls with SieveYieldResult.disclosures. */
export function translateSourcingYieldDisclosures(
  keys: readonly SourcingYieldDisclosureKey[],
): string[] {
  return keys.map(translateSourcingYieldDisclosure);
}
