import { MAINTENANCE_CONDITION_ORDER, RENOVATION_STRATEGY_ORDER } from "@/lib/copy/es/selections";
import { deriveRenovationStrategy } from "@/lib/rules/es/derive-selections";
import { RENOVATION_DURATION_MONTHS_BY_TIER } from "@/lib/rules/es/parameters";
import type { MaintenanceCondition, RenovationStrategyId } from "@/lib/rules/es/types";
import { StaatEnLastenForm } from "./staat-en-lasten-form";

/**
 * Step 2 - staat en lasten (UI_SPEC.md §3), including the permit gate.
 *
 * Server Component, like step 1: nothing from parameters.ts reaches the
 * browser. The Dutch labels come from the copy layer, which imports only
 * types.
 *
 * Fase C stap 1 and 2 each added one thing this step needs from the
 * calculation layer - the maintenance-condition -> tier mapping, and the
 * tier -> duration mapping - and both are resolved *here* rather than in
 * the form for the same reason: importing either into the client form
 * pulls parameters.ts into the browser bundle wholesale (tree-shaking does
 * not split that module), which would ship every capex figure, financing
 * rate and internal Excel cell reference to every visitor. Between them
 * they are six numbers; the server resolves them once and the form does a
 * plain lookup. staat-en-lasten-form.test.tsx has a regression guard on
 * exactly this.
 */
const DERIVED_TIER_BY_CONDITION: Readonly<Record<MaintenanceCondition, RenovationStrategyId>> =
  Object.fromEntries(
    MAINTENANCE_CONDITION_ORDER.map((condition) => [condition, deriveRenovationStrategy(condition)]),
  ) as Record<MaintenanceCondition, RenovationStrategyId>;

const DEFAULT_DURATION_BY_TIER: Readonly<Record<RenovationStrategyId, number>> = Object.fromEntries(
  RENOVATION_STRATEGY_ORDER.map((tier) => [tier, RENOVATION_DURATION_MONTHS_BY_TIER.value[tier]]),
) as Record<RenovationStrategyId, number>;

export default function StaatEnLastenPage() {
  return (
    <StaatEnLastenForm
      derivedTierByCondition={DERIVED_TIER_BY_CONDITION}
      defaultDurationByTier={DEFAULT_DURATION_BY_TIER}
    />
  );
}
