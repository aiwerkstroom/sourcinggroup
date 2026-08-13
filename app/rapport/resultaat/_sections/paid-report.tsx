/**
 * The nine-section paid report (UI_SPEC.md §6), assembled one section at
 * a time. A plain function component taking the engine's own output
 * types, not the wizard's client state - so it renders identically
 * whether called from the wizard's result page, from a golden-render
 * test via react-dom/server, or later from Playwright when the PDF is
 * generated from this same markup (CLAUDE.md §3).
 */

import type { EngineResult } from "@/lib/rules/es/types";
import { TsgScoreSection } from "./tsg-score-section";

export interface PaidReportProps {
  result: EngineResult;
}

export function PaidReport({ result }: PaidReportProps) {
  const base = result.scenarioOutcomes?.find((o) => o.scenario === "base") ?? null;

  return (
    <div className="flex flex-col gap-14">
      <TsgScoreSection score={base?.score ?? null} percentile={base?.percentile ?? null} />

      <p className="border-border text-text-muted rounded-md border border-dashed px-4 py-3 text-xs leading-relaxed">
        Secties 2 t/m 9 (uitkomst in één regel, scenario&apos;s, cashflowopbouw, tienjarige reeks,
        exit, toetsing, aannames, wat niet geverifieerd is) volgen hierna.
      </p>
    </div>
  );
}
