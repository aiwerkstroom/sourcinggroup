/**
 * Derives two of ModelSelections' mandatory fields from paid-form inputs
 * UI_SPEC.md §3 actually asks for, per interview round 1: the form does
 * not ask the customer to pick a renovation tier or a financing tier
 * directly.
 *
 * Both derivations read a mapping/rule from parameters.ts rather than
 * embedding one inline (CLAUDE.md §6). They are ordinary functions in the
 * calculation layer, not part of runEngine() - a caller (the paid form's
 * submit handler) runs them first and passes the results in as
 * ModelSelections.renovationStrategy/financingStrategy, the same fields
 * any other caller of runEngine() already supplies explicitly.
 */

import { FINANCING_STRATEGIES, FINANCING_TIER_SELECTION_TIE_BREAK, RENOVATION_TIER_BY_MAINTENANCE_CONDITION } from "./parameters";
import type {
  FinancingStrategyId,
  MaintenanceCondition,
  RenovationStrategyId,
  RenovationTierProvenance,
} from "./types";

/**
 * "Staat van onderhoud" -> renovation tier, via
 * RENOVATION_TIER_BY_MAINTENANCE_CONDITION (PLACEHOLDER). A one-line
 * lookup; kept as a function rather than inlined at the call site so the
 * derivation has one name a test and a caller can both refer to.
 */
export function deriveRenovationStrategy(condition: MaintenanceCondition): RenovationStrategyId {
  return RENOVATION_TIER_BY_MAINTENANCE_CONDITION.value[condition];
}

/**
 * The renovation tier the engine should actually use, plus how it was
 * arrived at (fase C stap 1). The customer's explicit choice wins over the
 * derivation whenever one was made; absent one, this is
 * deriveRenovationStrategy() with a provenance record wrapped around it.
 *
 * The derived value is reported under both statuses, deliberately: a
 * report that shows only the tier in force cannot tell the customer what
 * the model would have concluded on its own, and that comparison is the
 * whole point of asking. See RenovationTierProvenance.
 *
 * Same split as deriveRenovationStrategy() itself - this decides the tier
 * and records the provenance, and does not touch the tier's own
 * parameters. RENOVATION_STRATEGIES' capex/rentMultiplier/... stay
 * PLACEHOLDER and keep travelling to the customer through
 * placeholdersUsed; overriding *which* tier applies launders none of them.
 */
export function resolveRenovationTier(args: {
  maintenanceCondition: MaintenanceCondition;
  /** The wizard's optional explicit tier choice; absent means "derive it for me". */
  override?: RenovationStrategyId;
}): { strategy: RenovationStrategyId; provenance: RenovationTierProvenance } {
  const derivedValue = deriveRenovationStrategy(args.maintenanceCondition);
  if (args.override === undefined) {
    return { strategy: derivedValue, provenance: { status: "derived", derivedValue } };
  }
  return {
    strategy: args.override,
    provenance: { status: "customerChosen", derivedValue },
  };
}

/**
 * "Gewenste LTV" -> financing tier: the tier whose LTV
 * (FINANCING_STRATEGIES[id].ltv.value, 0.6/0.7/0.75) is numerically
 * closest to preferredLtv. On an exact tie - preferredLtv 0.65 or 0.725,
 * the two midpoints between adjacent tiers - FINANCING_TIER_SELECTION_TIE_BREAK
 * decides; "higher" is the parameter's current value.
 *
 * This picks the tier ModelSelections.financingStrategy needs for its
 * loanTermYears (25/20/15, one per tier and not otherwise derivable from
 * preferredLtv - see financing.ts's selectFinancing(), where loanTermYears
 * comes from the strategy id alone). It does not decide the LTV actually
 * used for the mortgage amount: that remains clampLtv()'s job in
 * financing.ts, reading constraints.preferredLtv directly. Two different
 * questions - which tier's contract terms apply, and how much to borrow -
 * that happen to read the same customer input.
 */
export function deriveFinancingStrategy(preferredLtv: number): FinancingStrategyId {
  const tiers: ReadonlyArray<{ id: FinancingStrategyId; ltv: number }> = [
    { id: "low", ltv: FINANCING_STRATEGIES.low.ltv.value },
    { id: "medium", ltv: FINANCING_STRATEGIES.medium.ltv.value },
    { id: "high", ltv: FINANCING_STRATEGIES.high.ltv.value },
  ];
  const preferHigherOnTie = FINANCING_TIER_SELECTION_TIE_BREAK.value === "higher";

  let best = tiers[0]!;
  let bestDistance = Math.abs(preferredLtv - best.ltv);
  // Tiers are ascending by ltv, so a later tier in this loop always has a
  // higher ltv than `best` - on a tie, switching to it is exactly what
  // "higher wins ties" means; never switching is exactly "lower wins ties".
  for (let i = 1; i < tiers.length; i++) {
    const tier = tiers[i]!;
    const distance = Math.abs(preferredLtv - tier.ltv);
    if (distance < bestDistance || (distance === bestDistance && preferHigherOnTie)) {
      best = tier;
      bestDistance = distance;
    }
  }
  return best.id;
}
