import { MAINTENANCE_CONDITION_ORDER } from "@/lib/copy/es/selections";
import { deriveRenovationStrategy } from "@/lib/rules/es/derive-selections";
import type { MaintenanceCondition, RenovationStrategyId } from "@/lib/rules/es/types";
import { StaatEnLastenForm } from "./staat-en-lasten-form";

/**
 * Step 2 - staat en lasten (UI_SPEC.md §3), including the permit gate.
 *
 * Server Component, like step 1: nothing from parameters.ts reaches the
 * browser. The Dutch labels come from the copy layer, which imports only
 * types.
 *
 * Fase C stap 1 added the one thing this step needs from the calculation
 * layer: the renovation-tier override's "afgeleid uit de staat van
 * onderhoud (X)" option has to name the tier the derivation lands on, and
 * that mapping lives in RENOVATION_TIER_BY_MAINTENANCE_CONDITION. Resolving
 * it *here* rather than in the form is what keeps the promise above intact
 * - importing deriveRenovationStrategy() into the client form instead pulls
 * parameters.ts into the browser bundle wholesale (tree-shaking does not
 * split that module), which would ship every capex figure, financing rate
 * and internal Excel cell reference to every visitor. It is three entries;
 * the server computes them once and the form does a plain lookup.
 */
const DERIVED_TIER_BY_CONDITION: Readonly<Record<MaintenanceCondition, RenovationStrategyId>> =
  Object.fromEntries(
    MAINTENANCE_CONDITION_ORDER.map((condition) => [condition, deriveRenovationStrategy(condition)]),
  ) as Record<MaintenanceCondition, RenovationStrategyId>;

export default function StaatEnLastenPage() {
  return <StaatEnLastenForm derivedTierByCondition={DERIVED_TIER_BY_CONDITION} />;
}
