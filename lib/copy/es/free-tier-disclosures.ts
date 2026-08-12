/**
 * Dutch copy for the free indication's disclosures (UI_SPEC.md: Nederlands
 * in de UI; CLAUDE.md §6: Engels in de code en commentaar). This is the
 * only place these five lines exist. The calculation layer
 * (lib/rules/es/free-tier/band.ts) emits FreeTierDisclosureKey values, not
 * text - this module is what turns a key into the sentence a page shows
 * next to the band.
 *
 * The Record below is what keeps the coupling as hard as it was when the
 * text lived on the result directly: TypeScript requires every member of
 * FreeTierDisclosureKey to have an entry, so a key added to that union
 * without a matching line here fails to compile, not just fails to
 * render.
 */

import type { FreeTierDisclosureKey, IndicativeLabel } from "../../rules/es/types";

export const FREE_TIER_DISCLOSURE_COPY_NL: Readonly<Record<FreeTierDisclosureKey, string>> = {
  band:
    "Deze bandbreedte laat zien wat we nog niet van uw pand weten — servicekosten, " +
    "staat van onderhoud en hoe de huur zich verhoudt tot het wijkgemiddelde. De " +
    "uiteinden zijn de gunstigste en ongunstigste combinatie van die drie, niet de " +
    "kans dat het zo uitpakt. De werkelijke uitkomst ligt waarschijnlijk dichter bij " +
    "het midden dan bij de randen.",
  shortTermLicence:
    "Kortetermijnverhuur vereist sinds 31 maart 2026 een título habilitante in " +
    "Valencia. Deze indicatie rekent met langetermijnverhuur; met vergunning kan het " +
    "rendement hoger uitvallen. Dat is niet in dit bedrag verwerkt.",
  financing:
    "Dit bedrag is de cashflow vóór financiering. De gratis indicatie vraagt geen " +
    "hypotheek- of vermogensgegevens, dus rente en aflossing zijn er niet van " +
    "afgetrokken.",
  unverified:
    "Niet geverifieerd in deze indicatie: het bruikbaar oppervlak (afgeleid uit het " +
    "gebouwde oppervlak), de kadastrale waarde (benaderd met de vraagprijs) en de " +
    "bezettingsgraad. In het betaalde rapport vult u deze zelf in.",
  unmodeledFields:
    "Pandtype en aantal eenheden zijn in dit formulier gevraagd, maar tellen nog " +
    "niet mee in deze berekening.",
  indicativeScoreScope:
    "Deze indicatie is gebaseerd op twee van de vijf factoren die het volledige " +
    "rapport beoordeelt. Rendement, schuldbestendigheid en haalbaarheid worden pas " +
    "berekend zodra u uw financieringsgegevens invult.",
};

/**
 * Translates one disclosure key. A switch with an exhaustiveness guard,
 * on top of the Record above, so the compile-time check is not resting on
 * object-literal typing alone: adding a key to FreeTierDisclosureKey
 * without a matching case here fails to compile via the `never` branch,
 * the same way it already fails via the missing Record entry.
 */
export function translateFreeTierDisclosure(key: FreeTierDisclosureKey): string {
  switch (key) {
    case "band":
      return FREE_TIER_DISCLOSURE_COPY_NL.band;
    case "shortTermLicence":
      return FREE_TIER_DISCLOSURE_COPY_NL.shortTermLicence;
    case "financing":
      return FREE_TIER_DISCLOSURE_COPY_NL.financing;
    case "unverified":
      return FREE_TIER_DISCLOSURE_COPY_NL.unverified;
    case "unmodeledFields":
      return FREE_TIER_DISCLOSURE_COPY_NL.unmodeledFields;
    case "indicativeScoreScope":
      return FREE_TIER_DISCLOSURE_COPY_NL.indicativeScoreScope;
    default: {
      const exhaustive: never = key;
      throw new Error(`Missing Dutch copy for free-tier disclosure key: ${String(exhaustive)}`);
    }
  }
}

/** Translates a full list of keys, in order - what a page calls with FreeTierBand.disclosures. */
export function translateFreeTierDisclosures(
  keys: readonly FreeTierDisclosureKey[],
): string[] {
  return keys.map(translateFreeTierDisclosure);
}

/**
 * Dutch for the indicative score's three grades (SCORE_SPEC.md §8.2).
 * Same split as the disclosures above: the calculation layer grades in
 * English ("low" / "medium" / "high"), this file is the only place those
 * become the words a customer reads.
 */
export const INDICATIVE_LABEL_COPY_NL: Readonly<Record<IndicativeLabel, string>> = {
  low: "Laag",
  medium: "Gemiddeld",
  high: "Hoog",
};

/** Translates one indicative-score grade, with the same exhaustiveness guard as the disclosures. */
export function translateIndicativeLabel(label: IndicativeLabel): string {
  switch (label) {
    case "low":
      return INDICATIVE_LABEL_COPY_NL.low;
    case "medium":
      return INDICATIVE_LABEL_COPY_NL.medium;
    case "high":
      return INDICATIVE_LABEL_COPY_NL.high;
    default: {
      const exhaustive: never = label;
      throw new Error(`Missing Dutch copy for indicative label: ${String(exhaustive)}`);
    }
  }
}
