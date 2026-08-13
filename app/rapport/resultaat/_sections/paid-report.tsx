/**
 * The nine-section paid report (UI_SPEC.md §6), assembled one section at
 * a time. A plain function component taking the engine's own output
 * types, not the wizard's client state - so it renders identically
 * whether called from the wizard's result page, from a golden-render
 * test via react-dom/server, or later from Playwright when the PDF is
 * generated from this same markup (CLAUDE.md §3).
 */

import type { EngineResult } from "@/lib/rules/es/types";
import { OneLineOutcomeSection } from "./one-line-outcome-section";
import { TsgScoreSection } from "./tsg-score-section";

export interface PaidReportProps {
  result: EngineResult;
}

export function PaidReport({ result }: PaidReportProps) {
  const base = result.scenarioOutcomes?.find((o) => o.scenario === "base") ?? null;
  // The steady-state monthlyCashflow/dscr live on ScenarioResult
  // (scenarios.ts), not on ScenarioOutcome - the same split
  // outcome.ts itself relies on when it scores a scenario.
  const baseScenario = result.scenarios.find((s) => s.id === "base")!;

  return (
    <div className="flex flex-col gap-14">
      <TsgScoreSection score={base?.score ?? null} percentile={base?.percentile ?? null} />

      <OneLineOutcomeSection
        monthlyCashflow={baseScenario.monthlyCashflow}
        dscr={baseScenario.dscr}
        irr={base?.irr ?? { defined: false, reason: "No exit was planned for this scenario." }}
        meetsMinRequiredReturn={base?.returnRequirement.meetsMinRequiredReturn ?? null}
        rentInputProvenance={result.rentInputProvenance}
      />

      <p className="border-border text-text-muted rounded-md border border-dashed px-4 py-3 text-xs leading-relaxed">
        Secties 3 t/m 9 (scenario&apos;s, cashflowopbouw, tienjarige reeks, exit, toetsing,
        aannames, wat niet geverifieerd is) volgen hierna.
      </p>
    </div>
  );
}
