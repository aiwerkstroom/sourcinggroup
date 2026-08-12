/**
 * Dutch copy for the paid report's rent-override disclosures (interview
 * round 2/3 follow-up): the sentence §6.1 ("Uitkomst in één regel") shows
 * when the customer's own rent figure, not the neighbourhood reference,
 * drove the outcome.
 *
 * Unlike lib/copy/es/free-tier-disclosures.ts, the text here is not
 * static per key - it must carry the supplied rate, the deviation
 * percentage and the reference rate (this task's own requirement), so
 * this module formats numbers, not just switches on a key. The key
 * itself (RentOverrideDisclosureKey) still comes from the calculation
 * layer's rentOverrideDisclosureKey() (rent-provenance.ts): that decision
 * - which key, if any, applies - is model logic (reads
 * RENT_OVERRIDE_SIGNIFICANT_DEVIATION_THRESHOLD), so it lives in exactly
 * one place rather than being re-derived here from raw fields.
 */

import { rentOverrideDisclosureKey } from "../../rules/es/rent-provenance";
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
 * Translates one rate's override disclosure. Returns null exactly when
 * rentOverrideDisclosureKey() does - matchesReference and noReference
 * carry nothing in §6.1, per this task's instruction that only an actual
 * customer override is ever mentioned there.
 */
export function translateRentOverrideDisclosure(
  rate: Rate,
  provenance: RentInputProvenance,
): string | null {
  const key = rentOverrideDisclosureKey(provenance);
  if (key === null) return null;

  // Non-null by construction once key is non-null: rentOverrideDisclosureKey()
  // only returns a key when provenance.status === "customerOverride", which
  // is exactly the branch that populates referenceRentPerM2/deviationFraction.
  const reference = provenance.referenceRentPerM2!;
  const supplied = provenance.suppliedRentPerM2;
  const deviation = provenance.deviationFraction!;
  const direction = deviation > 0 ? "hoger dan" : "lager dan";

  switch (key) {
    case "rentOverrideSignificant":
      return (
        `U heeft zelf een ${rateLabel(rate)} ingevuld: ${formatEuroPerM2(supplied)} - ` +
        `${formatPercent(deviation)} ${direction} de wijkreferentie van ${formatEuroPerM2(reference)}. ` +
        `Deze uitkomst rekent met uw eigen waarde, niet met de wijkreferentie.`
      );
    case "rentOverrideMinor":
      return (
        `De ingevoerde ${rateLabel(rate)} (${formatEuroPerM2(supplied)}) wijkt licht af van de ` +
        `wijkreferentie (${formatEuroPerM2(reference)}).`
      );
    default: {
      const exhaustive: never = key;
      throw new Error(`Missing Dutch copy for rent override disclosure key: ${String(exhaustive)}`);
    }
  }
}

/**
 * Every §6.1 sentence a full report needs: 0, 1 or 2 lines depending on
 * how many of the rentalStrategy-relevant rates are both present
 * (EngineResult.rentInputProvenance.longTerm/shortTerm - null for the
 * unused rate) and actually overridden. Order matches the report's own
 * long-term-then-short-term convention elsewhere.
 */
export function translateRentInputProvenanceReport(
  report: RentInputProvenanceReport,
): string[] {
  const lines: string[] = [];
  if (report.longTerm !== null) {
    const line = translateRentOverrideDisclosure("longTerm", report.longTerm);
    if (line !== null) lines.push(line);
  }
  if (report.shortTerm !== null) {
    const line = translateRentOverrideDisclosure("shortTerm", report.shortTerm);
    if (line !== null) lines.push(line);
  }
  return lines;
}
