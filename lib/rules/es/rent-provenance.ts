/**
 * Provenance of the rent rate(s) the paid form's belegger step lets the
 * customer override (interview round 2/3 follow-up): the wijk reference
 * pre-fills the field, the customer may type over it.
 *
 * No separate "did the customer touch this field" signal has to travel
 * from the form. PropertyInput.neighborhood already exists, and
 * NEIGHBORHOOD_RENT_LONG_TERM/SHORT_TERM are already keyed by
 * neighbourhood name, so this module simply compares what was supplied
 * against what the table says for that neighbourhood - a value equal to
 * the table's is "matchesReference" regardless of whether the customer
 * left it untouched or retyped the same number; a value the table cannot
 * produce is "customerOverride".
 *
 * Computed once per rate, not per scenario: the input rate itself does
 * not vary by conservative/base/optimistic (only the scenario multiplier
 * does), so runEngine() attaches one RentInputProvenanceReport to
 * EngineResult rather than duplicating it three times.
 */

import {
  NEIGHBORHOOD_RENT_LONG_TERM,
  NEIGHBORHOOD_RENT_SHORT_TERM,
  RENT_OVERRIDE_SIGNIFICANT_DEVIATION_THRESHOLD,
} from "./parameters";
import type {
  RentalStrategy,
  RentInputProvenance,
  RentInputProvenanceReport,
  RentOverrideDisclosureKey,
} from "./types";

function provenanceFor(referenceTable: Readonly<Record<string, number>>, args: {
  neighborhood: string | undefined;
  suppliedRentPerM2: number;
}): RentInputProvenance {
  const referenceRentPerM2 =
    args.neighborhood !== undefined ? (referenceTable[args.neighborhood] ?? null) : null;

  if (referenceRentPerM2 === null) {
    return {
      status: "noReference",
      referenceRentPerM2: null,
      suppliedRentPerM2: args.suppliedRentPerM2,
      deviationFraction: null,
      significantDeviation: false,
    };
  }

  if (args.suppliedRentPerM2 === referenceRentPerM2) {
    return {
      status: "matchesReference",
      referenceRentPerM2,
      suppliedRentPerM2: args.suppliedRentPerM2,
      deviationFraction: 0,
      significantDeviation: false,
    };
  }

  const deviationFraction = (args.suppliedRentPerM2 - referenceRentPerM2) / referenceRentPerM2;
  return {
    status: "customerOverride",
    referenceRentPerM2,
    suppliedRentPerM2: args.suppliedRentPerM2,
    deviationFraction,
    significantDeviation:
      Math.abs(deviationFraction) >= RENT_OVERRIDE_SIGNIFICANT_DEVIATION_THRESHOLD.value,
  };
}

/**
 * Provenance for the rate(s) `rentalStrategy` actually uses. Mirrors
 * outcome.ts's collectPlaceholders pattern: longTerm is reported only for
 * longTerm/hybrid, shortTerm only for shortTerm/hybrid - the unused rate
 * stays null rather than reporting on a figure that never entered the
 * outcome (income.ts computes both IncomeLines unconditionally, but only
 * the selected strategy's figure feeds scenarios.ts onward).
 */
export function computeRentInputProvenance(args: {
  neighborhood: string | undefined;
  rentPerM2LongTerm: number;
  rentPerM2ShortTerm: number;
  rentalStrategy: RentalStrategy;
}): RentInputProvenanceReport {
  const usesLongTerm = args.rentalStrategy === "longTerm" || args.rentalStrategy === "hybrid";
  const usesShortTerm = args.rentalStrategy === "shortTerm" || args.rentalStrategy === "hybrid";

  return {
    longTerm: usesLongTerm
      ? provenanceFor(NEIGHBORHOOD_RENT_LONG_TERM.value, {
          neighborhood: args.neighborhood,
          suppliedRentPerM2: args.rentPerM2LongTerm,
        })
      : null,
    shortTerm: usesShortTerm
      ? provenanceFor(NEIGHBORHOOD_RENT_SHORT_TERM.value, {
          neighborhood: args.neighborhood,
          suppliedRentPerM2: args.rentPerM2ShortTerm,
        })
      : null,
  };
}

/**
 * Which of the two §6.1 disclosure keys, if any, one rate's provenance
 * triggers. Null for matchesReference/noReference - §6.1 carries nothing
 * about rent provenance unless the customer's own figure is in play.
 */
export function rentOverrideDisclosureKey(
  provenance: RentInputProvenance,
): RentOverrideDisclosureKey | null {
  if (provenance.status !== "customerOverride") return null;
  return provenance.significantDeviation ? "rentOverrideSignificant" : "rentOverrideMinor";
}
