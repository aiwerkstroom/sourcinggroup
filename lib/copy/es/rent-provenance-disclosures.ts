/**
 * Dutch copy for the paid report's rent-provenance disclosures (interview
 * round 2/3, extended with "actualCurrentRent"): the sentence §6.1
 * ("Uitkomst in één regel") shows when something other than the
 * neighbourhood reference drove the outcome.
 *
 * Unlike lib/copy/es/free-tier-disclosures.ts, the text here is not static
 * per key - it must carry the supplied rate, the deviation percentage and
 * the reference rate - so this module formats numbers, not just switches
 * on a key. The key itself (RentProvenanceDisclosureKey) still comes from
 * the calculation layer's rentProvenanceDisclosureKey()
 * (rent-provenance.ts): that decision - which key, if any, applies - is
 * model logic (it reads RENT_OVERRIDE_SIGNIFICANT_DEVIATION_THRESHOLD), so
 * it lives in exactly one place rather than being re-derived here from raw
 * fields.
 *
 * Tone differs by key on purpose. The two override lines flag that a
 * figure came from the customer's judgement rather than market data, so
 * they name the deviation. The actual-current-rent line reports a
 * *better* input than the model could supply, so it reassures and carries
 * no percentage - there is nothing for an observed rent to deviate from.
 */

// Imported from rent-provenance-key.ts, not rent-provenance.ts: that
// module also imports parameters.ts (NEIGHBORHOOD_RENT_LONG_TERM/
// SHORT_TERM, RENT_OVERRIDE_SIGNIFICANT_DEVIATION_THRESHOLD) for
// computeRentInputProvenance(), which this file never calls - importing
// from there anyway pulled the client bundle for /rapport/resultaat into
// including all of parameters.ts's reachable module scope, RENOVATION_STRATEGIES
// included. See rent-provenance-key.ts's own docstring.
import { rentProvenanceDisclosureKey } from "../../rules/es/rent-provenance-key";
import type { RentInputProvenance, RentInputProvenanceReport } from "../../rules/es/types";

type Rate = "longTerm" | "shortTerm";

const EURO_PER_M2 = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const PERCENT = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatEuroPerM2(value: number): string {
  return `€ ${EURO_PER_M2.format(value)}/m²/maand`;
}

function formatPercent(fraction: number): string {
  return `${PERCENT.format(Math.abs(fraction) * 100)}%`;
}

function rateLabel(rate: Rate): string {
  return rate === "longTerm" ? "langetermijnhuur" : "kortetermijnhuur";
}

/**
 * Translates one rate's provenance disclosure. Returns null exactly when
 * rentProvenanceDisclosureKey() does - matchesReference and noReference
 * carry nothing in §6.1, since the model's own reference is what drove
 * the outcome.
 */
export function translateRentProvenanceDisclosure(
  rate: Rate,
  provenance: RentInputProvenance,
): string | null {
  const key = rentProvenanceDisclosureKey(provenance);
  if (key === null) return null;

  const supplied = provenance.suppliedRentPerM2;

  switch (key) {
    case "rentFromActualCurrentRent":
      return (
        `Deze uitkomst is gebaseerd op de werkelijke huidige huur van dit pand ` +
        `(${formatEuroPerM2(supplied)}), niet op een schatting.`
      );
    case "rentOverrideSignificant": {
      // Non-null by construction: this key is only returned for
      // status === "customerOverride", the one branch that populates both.
      const reference = provenance.referenceRentPerM2!;
      const deviation = provenance.deviationFraction!;
      const direction = deviation > 0 ? "hoger dan" : "lager dan";
      return (
        `U heeft zelf een ${rateLabel(rate)} ingevuld: ${formatEuroPerM2(supplied)} - ` +
        `${formatPercent(deviation)} ${direction} de wijkreferentie van ${formatEuroPerM2(reference)}. ` +
        `Deze uitkomst rekent met uw eigen waarde, niet met de wijkreferentie.`
      );
    }
    case "rentOverrideMinor": {
      const reference = provenance.referenceRentPerM2!;
      return (
        `De ingevoerde ${rateLabel(rate)} (${formatEuroPerM2(supplied)}) wijkt licht af van de ` +
        `wijkreferentie (${formatEuroPerM2(reference)}).`
      );
    }
    default: {
      const exhaustive: never = key;
      throw new Error(
        `Missing Dutch copy for rent provenance disclosure key: ${String(exhaustive)}`,
      );
    }
  }
}

/**
 * Every §6.1 sentence a full report needs: 0, 1 or 2 lines depending on
 * how many of the rentalStrategy-relevant rates are both present
 * (EngineResult.rentInputProvenance.longTerm/shortTerm - null for the
 * unused rate) and sourced from something other than the wijk reference.
 * Order matches the report's own long-term-then-short-term convention
 * elsewhere.
 */
export function translateRentInputProvenanceReport(
  report: RentInputProvenanceReport,
): string[] {
  const lines: string[] = [];
  if (report.longTerm !== null) {
    const line = translateRentProvenanceDisclosure("longTerm", report.longTerm);
    if (line !== null) lines.push(line);
  }
  if (report.shortTerm !== null) {
    const line = translateRentProvenanceDisclosure("shortTerm", report.shortTerm);
    if (line !== null) lines.push(line);
  }
  return lines;
}
