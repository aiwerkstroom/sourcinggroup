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

import type { RenovationStrategyId, RenovationTierProvenance } from "@/lib/rules/es/types";
import { RENOVATION_STRATEGY_CHOICE_COPY_NL } from "./selections";

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
