/**
 * Renovation strategies. Replicates Costs & Income!B66:H84 and the
 * selection cells D87-D97.
 */

import { RENOVATION_STRATEGIES } from "./parameters";
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
    return {
      id,
      label: s.label,
      capex: s.capex,
      rentMultiplier: s.rentMultiplier,
      maintenanceFactor: s.maintenanceFactor,
      utilitiesEfficiency: s.utilitiesEfficiency,
      timeToRentMonths: s.timeToRentMonths,
      withinMaxRenovationBudget: s.capex <= constraints.maxRenovationBudget,
    };
  });
}

export function selectRenovation(
  id: RenovationStrategyId,
  constraints: Pick<InvestorConstraints, "maxRenovationBudget">,
): RenovationStrategyResult {
  const table = renovationStrategyTable(constraints);
  const found = table.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown renovation strategy: ${id}`);
  return found;
}
