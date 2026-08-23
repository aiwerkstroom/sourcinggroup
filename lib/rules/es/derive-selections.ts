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

import {
  FINANCING_STRATEGIES,
  RENOVATION_DURATION_MONTHS_BY_TIER,
  RENOVATION_TIER_BY_MAINTENANCE_CONDITION,
} from "./parameters";
import type {
  FinancingStrategyId,
  MaintenanceCondition,
  RenovationDurationProvenance,
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
 * The renovation's duration in months, plus how it was arrived at (fase C
 * stap 2). Mirrors resolveRenovationTier() exactly: the customer's figure
 * wins when given, RENOVATION_DURATION_MONTHS_BY_TIER's default applies
 * otherwise, and the default is reported either way.
 *
 * Takes the tier rather than the maintenanceCondition on purpose. The two
 * overrides are independent, and the duration must follow the tier
 * *actually in force* - a customer who overrode the tier to "heavy" and
 * left the duration alone should get heavy's five months, not the three
 * their "redelijke staat" answer would have implied. Callers therefore
 * resolve the tier first and pass its result in.
 */
export function resolveRenovationDuration(args: {
  /** The tier in force - resolveRenovationTier()'s own `strategy`, not the derived one. */
  tier: RenovationStrategyId;
  /** The wizard's optional explicit figure; absent means "use the tier's default". */
  override?: number;
}): { months: number; provenance: RenovationDurationProvenance } {
  const derivedValue = RENOVATION_DURATION_MONTHS_BY_TIER.value[args.tier];
  if (args.override === undefined) {
    return { months: derivedValue, provenance: { status: "derived", derivedValue } };
  }
  return {
    months: args.override,
    provenance: { status: "customerChosen", derivedValue },
  };
}

/**
 * "Gewenste LTV" -> financing tier: the first tier whose own LTV covers
 * the LTV the customer wants (FINANCING_STRATEGIES[id].ltv.value,
 * 0.6/0.7/0.75), falling through to the highest tier above that.
 *
 * This picks the tier ModelSelections.financingStrategy needs for its
 * loanTermYears (25/20/15, one per tier and not otherwise derivable from
 * preferredLtv - see financing.ts's selectFinancing(), where loanTermYears
 * comes from the strategy id alone). It does not decide the LTV actually
 * used for the mortgage amount: that remains clampLtv()'s job in
 * financing.ts, reading constraints.preferredLtv directly. Two different
 * questions - which tier's contract terms apply, and how much to borrow -
 * that happen to read the same customer input.
 *
 * Fase C stap 3 changed this from "nearest tier LTV" to the covering rule
 * above, which is the rule financing.ts's selectInterestRate() has always
 * used for the rate (Excel D123). The two disagreed for any preferredLtv
 * strictly between two tiers, and the customer got the mismatch: at 0.62,
 * the low tier's 25-year term with the medium tier's 2.85% rate. Fase C
 * stap 3 makes that pairing visible in the wizard, so the disagreement had
 * to go. Aligning the tier to the rate's rule (rather than the reverse)
 * keeps the rate tracking the leverage actually taken on - and is the more
 * defensible reading anyway: a tier that caps at 60% cannot fund 62%.
 *
 * A covering rule has no ties, which is why FINANCING_TIER_SELECTION_TIE_BREAK
 * no longer exists - it only ever answered a question "nearest" could ask.
 */
export function deriveFinancingStrategy(preferredLtv: number): FinancingStrategyId {
  if (preferredLtv <= FINANCING_STRATEGIES.low.ltv.value) return "low";
  if (preferredLtv <= FINANCING_STRATEGIES.medium.ltv.value) return "medium";
  return "high";
}
