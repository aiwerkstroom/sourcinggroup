/**
 * Renovation strategies. Replicates Costs & Income!B66:H84 and the
 * selection cells D87-D97.
 *
 * One field has no Excel counterpart: durationMonths (fase C stap 2). The
 * workbook models the renovation as taking no time - it has a capex column
 * and a lease-up column, no doorlooptijd - so year 1 was prorated by the
 * lease-up alone and the months the property spends as a building site
 * counted as rented. RENOVATION_DURATION_MONTHS_BY_TIER supplies a default
 * per tier and the customer can replace it; the two vacancies are additive
 * (see that parameter, and projection.ts's year-1 proration).
 */

import { RENOVATION_DURATION_MONTHS_BY_TIER, RENOVATION_STRATEGIES } from "./parameters";
import type {
  InvestorConstraints,
  RenovationStrategyId,
  RenovationStrategyResult,
} from "./types";

export function renovationStrategyTable(
  constraints: Pick<InvestorConstraints, "maxRenovationBudget">,
): RenovationStrategyResult[] {
  return (Object.keys(RENOVATION_STRATEGIES) as RenovationStrategyId[]).map((id) => {
    const s = RENOVATION_STRATEGIES[id];
    const capex = s.capex.value;
    return {
      id,
      label: s.label,
      capex,
      rentMultiplier: s.rentMultiplier.value,
      maintenanceFactor: s.maintenanceFactor.value,
      utilitiesEfficiency: s.utilitiesEfficiency.value,
      timeToRentMonths: s.timeToRentMonths.value,
      durationMonths: RENOVATION_DURATION_MONTHS_BY_TIER.value[id],
      withinMaxRenovationBudget: capex <= constraints.maxRenovationBudget,
    };
  });
}

/**
 * The selected tier, with the customer's own renovation duration
 * substituted when they supplied one (fase C stap 2). The override
 * applies only to the selected tier: the comparison table above keeps
 * each tier's own default, because a customer's figure is about the work
 * they intend to do, not a correction to the other tiers' estimates.
 */
export function selectRenovation(
  id: RenovationStrategyId,
  constraints: Pick<InvestorConstraints, "maxRenovationBudget">,
  durationMonthsOverride?: number,
): RenovationStrategyResult {
  const table = renovationStrategyTable(constraints);
  const found = table.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown renovation strategy: ${id}`);
  if (durationMonthsOverride === undefined) return found;
  return { ...found, durationMonths: durationMonthsOverride };
}
