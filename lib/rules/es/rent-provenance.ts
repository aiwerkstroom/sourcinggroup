/**
 * Provenance of the rent rate(s) the paid form's belegger step lets the
 * customer set (interview round 2/3, extended with "actualCurrentRent").
 *
 * Three of the four statuses are derived. The wijk reference pre-fills the
 * field and the customer may type over it, so comparing what was supplied
 * against NEIGHBORHOOD_RENT_LONG_TERM/SHORT_TERM for the given
 * neighbourhood is enough to tell matchesReference, customerOverride and
 * noReference apart - no "did the customer touch this field" signal has to
 * travel from the form, since PropertyInput.neighborhood and the tables
 * are already keyed the same way.
 *
 * "actualCurrentRent" is the exception, and the asymmetry is worth naming:
 * it cannot be derived. A rent this building is actually being let at may
 * land above the wijk average, below it, or exactly on it, so the number
 * alone carries no trace of where it came from. It is therefore declared
 * by the caller (ModelSelections.rentPerM2FromActualCurrentRent) and this
 * module reports it without comparison - no deviation, no threshold, since
 * an observed fact about this specific property has nothing to deviate
 * from.
 *
 * Computed once per rate, not per scenario: the input rate itself does not
 * vary by conservative/base/optimistic (only the scenario multiplier
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
  RentProvenanceDisclosureKey,
} from "./types";

function provenanceFor(
  referenceTable: Readonly<Record<string, number>>,
  args: {
    neighborhood: string | undefined;
    suppliedRentPerM2: number;
    fromActualCurrentRent: boolean;
  },
): RentInputProvenance {
  const referenceRentPerM2 =
    args.neighborhood !== undefined ? (referenceTable[args.neighborhood] ?? null) : null;

  // Checked before the reference comparisons: an observed rent is not an
  // estimate that happens to differ from the table, so it is never
  // reported as matching or deviating from it, even when the numbers
  // coincide. The reference is still carried when known - §6.8 may show
  // what reference existed - but as context, not as a yardstick.
  if (args.fromActualCurrentRent) {
    return {
      status: "actualCurrentRent",
      referenceRentPerM2,
      suppliedRentPerM2: args.suppliedRentPerM2,
      deviationFraction: null,
      significantDeviation: false,
    };
  }

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
 *
 * `fromActualCurrentRent` names at most one rate, and only that rate skips
 * the reference comparison. Naming a rate the strategy does not use has no
 * effect at all, for the same reason the unused rate is not reported: it
 * never reached the outcome.
 */
export function computeRentInputProvenance(args: {
  neighborhood: string | undefined;
  rentPerM2LongTerm: number;
  rentPerM2ShortTerm: number;
  rentalStrategy: RentalStrategy;
  /** ModelSelections.rentPerM2FromActualCurrentRent - which rate, if any, is the property's observed current rent. */
  fromActualCurrentRent?: "longTerm" | "shortTerm";
}): RentInputProvenanceReport {
  const usesLongTerm = args.rentalStrategy === "longTerm" || args.rentalStrategy === "hybrid";
  const usesShortTerm = args.rentalStrategy === "shortTerm" || args.rentalStrategy === "hybrid";

  return {
    longTerm: usesLongTerm
      ? provenanceFor(NEIGHBORHOOD_RENT_LONG_TERM.value, {
          neighborhood: args.neighborhood,
          suppliedRentPerM2: args.rentPerM2LongTerm,
          fromActualCurrentRent: args.fromActualCurrentRent === "longTerm",
        })
      : null,
    shortTerm: usesShortTerm
      ? provenanceFor(NEIGHBORHOOD_RENT_SHORT_TERM.value, {
          neighborhood: args.neighborhood,
          suppliedRentPerM2: args.rentPerM2ShortTerm,
          fromActualCurrentRent: args.fromActualCurrentRent === "shortTerm",
        })
      : null,
  };
}

/**
 * Which §6.1 disclosure key, if any, one rate's provenance triggers.
 *
 * Null for matchesReference and noReference - §6.1 carries nothing about
 * rent provenance when the model's own reference drove the outcome.
 * "actualCurrentRent" does emit a key, but a reassuring one: it reports a
 * stronger input than the model could supply, not a weaker one.
 */
export function rentProvenanceDisclosureKey(
  provenance: RentInputProvenance,
): RentProvenanceDisclosureKey | null {
  if (provenance.status === "actualCurrentRent") return "rentFromActualCurrentRent";
  if (provenance.status !== "customerOverride") return null;
  return provenance.significantDeviation ? "rentOverrideSignificant" : "rentOverrideMinor";
}
