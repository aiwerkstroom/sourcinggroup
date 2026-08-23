/**
 * Dutch copy for the renovation tier's provenance (fase C stap 1;
 * UI_SPEC.md: Nederlands in de UI, CLAUDE.md §6: Engels in de rekenlaag).
 * Same split as every other disclosure module: the calculation layer emits
 * a RenovationTierProvenance record, this file is the only place it
 * becomes a sentence.
 *
 * Two sentences rather than one, because the two statuses say genuinely
 * different things and neither is a negation of the other:
 *
 * - "derived" is a caveat. The tier rests on
 *   RENOVATION_TIER_BY_MAINTENANCE_CONDITION, a PLACEHOLDER - an unverified
 *   claim that a given state of repair implies a given amount of work - so
 *   this sentence tells the customer the model concluded it and how.
 * - "customerChosen" is the opposite in kind: reassuring, not cautioning.
 *   It reports that the figure came from something better than the model's
 *   own lookup. The same asymmetry rentFromActualCurrentRent already has
 *   against the rent-override keys.
 *
 * The derived value is named under both statuses. Under "customerChosen"
 * that is the whole point - a report that shows only the tier in force
 * cannot tell the customer what the model would have said instead, and
 * that contrast is what makes the override auditable rather than silent.
 */

import type {
  RenovationDurationProvenance,
  RenovationStrategyId,
  RenovationTierProvenance,
} from "@/lib/rules/es/types";
import { RENOVATION_STRATEGY_CHOICE_COPY_NL } from "./selections";

/** Matches projection.ts's own year-1 window; the overflow note below measures against it. */
const MONTHS_PER_YEAR = 12;

/** Lower-case tier name for mid-sentence use, e.g. "het scenario grondig". */
function tierName(tier: RenovationStrategyId): string {
  return RENOVATION_STRATEGY_CHOICE_COPY_NL[tier].label.toLowerCase();
}

/**
 * §6.8's line about where the renovation tier came from. Returns null when
 * there is no derivation to report on at all - EngineResult
 * .renovationTierProvenance is null for every caller that supplied a tier
 * directly with no "staat van onderhoud" behind it.
 */
export function translateRenovationTierProvenanceNote(
  provenance: RenovationTierProvenance | null,
  /** The tier the engine actually used - ModelSelections.renovationStrategy. */
  strategyInForce: RenovationStrategyId,
): string | null {
  if (provenance === null) return null;

  if (provenance.status === "derived") {
    return (
      `Het renovatiescenario (${tierName(provenance.derivedValue)}) is door het model afgeleid ` +
      `uit de staat van onderhoud die u opgaf, niet door u zelf gekozen. Die vertaalslag is een ` +
      `schatting: dezelfde staat kan in de praktijk meer of minder werk vragen.`
    );
  }

  // Chosen and derived can coincide - the customer may deliberately pick
  // the tier the lookup would also have produced. That is still a choice,
  // and reads as one, but a sentence contrasting it with itself would be
  // nonsense, so that case gets its own shorter wording.
  if (provenance.derivedValue === strategyInForce) {
    return (
      `U koos het renovatiescenario ${tierName(strategyInForce)} zelf. Dat is hetzelfde scenario ` +
      `dat het model uit de staat van onderhoud zou hebben afgeleid.`
    );
  }

  return (
    `U koos het renovatiescenario ${tierName(strategyInForce)} zelf; uit de staat van onderhoud ` +
    `zou het model ${tierName(provenance.derivedValue)} hebben afgeleid. Er is met uw keuze ` +
    `gerekend.`
  );
}

/**
 * §6.8's line about the renovation's duration (fase C stap 2). Same two
 * statuses as the tier above, and the same asymmetry: "derived" is a
 * caveat about an unverified figure, "customerChosen" reports that the
 * number came from the customer instead.
 */
export function translateRenovationDurationProvenanceNote(
  provenance: RenovationDurationProvenance | null,
  /** The duration actually used, in months. */
  monthsInForce: number,
): string | null {
  if (provenance === null) return null;
  const m = (n: number) => `${n} ${n === 1 ? "maand" : "maanden"}`;

  if (provenance.status === "derived") {
    return (
      `De doorlooptijd van de verbouwing (${m(provenance.derivedValue)}) is een schatting bij het ` +
      `gekozen renovatiescenario, niet een planning van uw aannemer. Zolang er verbouwd wordt is ` +
      `er geen huurinkomen.`
    );
  }

  if (provenance.derivedValue === monthsInForce) {
    return (
      `U gaf zelf ${m(monthsInForce)} verbouwtijd op. Dat is gelijk aan de schatting die bij dit ` +
      `renovatiescenario hoort.`
    );
  }

  return (
    `U gaf zelf ${m(monthsInForce)} verbouwtijd op; bij dit renovatiescenario schat het model ` +
    `${m(provenance.derivedValue)}. Er is met uw opgave gerekend.`
  );
}

/**
 * The one case the year-1 proration cannot represent (fase C stap 2): a
 * renovation plus lease-up that together run past the first year. Only
 * year 1 is prorated, so the months beyond twelve fall outside the model
 * rather than reducing year 2 - which would flatter the projection if it
 * went unsaid. Returns null whenever the two fit inside the year, which is
 * every ordinary case.
 *
 * Not folded into the note above: this is a limitation of the projection,
 * not a statement about where a figure came from, and a reader skimming
 * for provenance should not have to find it there.
 */
export function translateRenovationVacancyOverflowNote(
  durationMonths: number,
  leaseUpMonths: number,
): string | null {
  const total = durationMonths + leaseUpMonths;
  if (total <= MONTHS_PER_YEAR) return null;
  const spill = total - MONTHS_PER_YEAR;
  return (
    `De verbouwing en de aanloopperiode beslaan samen ${total} maanden. Het eerste jaar is ` +
    `daarmee volledig zonder huurinkomsten, en de resterende ` +
    `${spill} ${spill === 1 ? "maand" : "maanden"} vallen in jaar 2 - die zijn niet in deze ` +
    `projectie verwerkt, want alleen het eerste jaar wordt naar rato berekend. De werkelijke ` +
    `opbrengst van jaar 2 ligt dus lager dan hier staat.`
  );
}
