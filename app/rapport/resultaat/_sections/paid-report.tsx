/**
 * The nine-section paid report (UI_SPEC.md §6), assembled one section at
 * a time. A plain function component taking the engine's own output
 * types, not the wizard's client state - so it renders identically
 * whether called from the wizard's result page, from a golden-render
 * test via react-dom/server, or later from Playwright when the PDF is
 * generated from this same markup (CLAUDE.md §3).
 */

import type { EngineResult } from "@/lib/rules/es/types";
import { Card } from "../_components/card";
import { AssumptionsSection } from "./assumptions-section";
import { CashflowBreakdownSection } from "./cashflow-breakdown-section";
import { ExitSection } from "./exit-section";
import { OneLineOutcomeSection } from "./one-line-outcome-section";
import { PlaceholdersSection } from "./placeholders-section";
import type { ScenarioRow } from "./scenarios-section";
import { ScenariosSection } from "./scenarios-section";
import { TenYearSection } from "./ten-year-section";
import { ThresholdsSection } from "./thresholds-section";
import { TsgScoreSection } from "./tsg-score-section";

export interface PaidReportProps {
  result: EngineResult;
}

const NO_EXIT_PLANNED = { defined: false, reason: "No exit was planned for this scenario." } as const;

/**
 * Sections 5-7 all read from EngineResult.scenarioOutcomes, which is null
 * exactly when EngineInput.exitPlanning was not supplied (MODEL_SPEC_FASE1B
 * §5 gives those assumptions no default). The wizard always collects them
 * in step 4 before calling the engine, so this path is a defensive
 * fallback for a directly-constructed EngineResult, not a state a customer
 * reaches - but the report must still say something true rather than
 * render nothing or crash.
 */
function NoExitPlanningNotice({ sectionNumber, title }: { sectionNumber: number; title: string }) {
  const headingId = `sectie-${sectionNumber}-geen-exit`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-text-faint text-xs tracking-widest uppercase">
        {sectionNumber}. {title}
      </h2>
      <p className="text-text-muted max-w-prose text-sm leading-relaxed">
        Zonder exitaannames (verkoopkosten, plusvalía) kan het model dit onderdeel niet
        doorrekenen - dezelfde aannames die de IRR nodig heeft.
      </p>
    </section>
  );
}

export function PaidReport({ result }: PaidReportProps) {
  const base = result.scenarioOutcomes?.find((o) => o.scenario === "base") ?? null;
  // The steady-state monthlyCashflow/dscr live on ScenarioResult
  // (scenarios.ts), not on ScenarioOutcome - the same split
  // outcome.ts itself relies on when it scores a scenario.
  const baseScenario = result.scenarios.find((s) => s.id === "base")!;

  // result.scenarios and result.scenarioOutcomes are both built via
  // SCENARIO_ORDER.map() in the calculation layer, so zipping them by
  // array position (not a lookup) already yields conservative/base/
  // optimistic order without this layer needing its own copy of that
  // order.
  const rows: ScenarioRow[] = result.scenarios.map((scenario) => {
    const outcome = result.scenarioOutcomes?.find((o) => o.scenario === scenario.id) ?? null;
    return {
      scenario: scenario.id,
      monthlyCashflow: scenario.monthlyCashflow,
      dscr: scenario.dscr,
      irr: outcome?.irr ?? NO_EXIT_PLANNED,
      scoreTotal: outcome?.score?.total ?? null,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <Card size="large">
        <TsgScoreSection score={base?.score ?? null} percentile={base?.percentile ?? null} />
      </Card>

      <Card>
        <OneLineOutcomeSection
          monthlyCashflow={baseScenario.monthlyCashflow}
          dscr={baseScenario.dscr}
          irr={base?.irr ?? NO_EXIT_PLANNED}
          meetsMinRequiredReturn={base?.returnRequirement.meetsMinRequiredReturn ?? null}
          rentInputProvenance={result.rentInputProvenance}
        />
      </Card>

      <Card>
        <ScenariosSection rows={rows} />
      </Card>

      <Card>
        <CashflowBreakdownSection
          scenario={baseScenario}
          fixedCosts={result.fixedOperatingCosts}
          annualIncomeTax={result.tax.taxDueBase}
        />
      </Card>

      <Card>
        {result.scenarioOutcomes !== null ? (
          <TenYearSection outcomes={result.scenarioOutcomes} />
        ) : (
          <NoExitPlanningNotice sectionNumber={5} title="De tienjarige reeks" />
        )}
      </Card>

      <Card>
        {base !== null ? (
          <ExitSection exit={base.exit} />
        ) : (
          <NoExitPlanningNotice sectionNumber={6} title="Exit" />
        )}
      </Card>

      <Card>
        {base !== null ? (
          <ThresholdsSection
            equityFit={base.equityFit}
            cashflow={{
              minMonthlyCashflow: baseScenario.minMonthlyCashflow,
              monthlyCashflow: baseScenario.monthlyCashflow,
              meetsMinMonthlyCashflow: baseScenario.meetsMinMonthlyCashflow,
            }}
            returnRequirement={base.returnRequirement}
            irr={base.irr}
          />
        ) : (
          <NoExitPlanningNotice sectionNumber={7} title="Toetsing aan de randvoorwaarden" />
        )}
      </Card>

      <Card>
        {base !== null ? (
          <AssumptionsSection assumptionsUsed={base.assumptionsUsed} />
        ) : (
          <NoExitPlanningNotice sectionNumber={8} title="Aannames en bronnen" />
        )}
      </Card>

      <Card>
        {base !== null ? (
          <PlaceholdersSection placeholdersUsed={base.placeholdersUsed} />
        ) : (
          <NoExitPlanningNotice sectionNumber={9} title="Wat niet geverifieerd is" />
        )}
      </Card>
    </div>
  );
}
