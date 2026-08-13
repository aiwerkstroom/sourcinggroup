/**
 * Dutch labels for the three scenarios (UI_SPEC.md §6.3: "conservatief,
 * basis, optimistisch"). Same pattern as the rest of lib/copy/es: a
 * Record over the calculation layer's own ScenarioId union, so an added
 * scenario fails to compile without a translation.
 *
 * No order array here: result.scenarios and result.scenarioOutcomes are
 * both built via SCENARIO_ORDER.map() in the calculation layer
 * (scenarios.ts, engine.ts), so they already arrive in
 * conservative/base/optimistic order - re-importing SCENARIO_ORDER itself
 * would mean importing parameters.ts into report code that a client
 * component reaches, for an ordering the data already carries.
 */

import type { ScenarioId } from "../../rules/es/types";

export const SCENARIO_ID_COPY_NL: Readonly<Record<ScenarioId, string>> = {
  conservative: "Conservatief",
  base: "Basis",
  optimistic: "Optimistisch",
};
