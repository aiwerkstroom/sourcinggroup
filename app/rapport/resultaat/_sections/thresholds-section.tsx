/**
 * §6.7 of UI_SPEC.md's report structure: "Toetsing aan de eigen
 * randvoorwaarden — gehaald of niet, per drempel."
 *
 * Plain function component, same reasoning as the sections before it: it
 * takes checks the calculation layer already computed (EquityFitCheck,
 * ReturnRequirementCheck, and ScenarioResult's own minMonthlyCashflow/
 * meetsMinMonthlyCashflow pair) and renders them, nothing more - no
 * threshold comparison happens in this file.
 *
 * This is the one section UI_SPEC.md §1 reserves colour for: a threshold
 * is either met or not, which is exactly the pass/fail signal that rule
 * describes, unlike the TSG-score bars (magnitude, not a threshold) or the
 * ten-year chart (three scenarios, not a verdict). A third state exists
 * and is not painted either colour: `null` means the check could not run
 * at all (no stated available equity, or no defined IRR to test against a
 * hurdle rate) - that is an absent answer, not a quiet "no".
 */

import type { EquityFitCheck, ReturnRequirementCheck } from "@/lib/rules/es/types";
import { formatEuro, formatPercent } from "../_lib/format";

export interface ThresholdsSectionProps {
  equityFit: EquityFitCheck;
  cashflow: {
    minMonthlyCashflow: number;
    monthlyCashflow: number;
    meetsMinMonthlyCashflow: boolean;
  };
  returnRequirement: ReturnRequirementCheck;
  /** The base scenario's IRR, for the rendementsdoelstelling row's "behaald" figure - undefined reads as "geen IRR". */
  irr: { defined: true; irr: number } | { defined: false };
}

type Status = "met" | "not-met" | "unknown";

function StatusBadge({ status }: { status: Status }) {
  if (status === "unknown") {
    return (
      <span className="bg-surface text-text-muted rounded-full px-2.5 py-1 text-xs font-medium">
        Onbekend
      </span>
    );
  }
  const met = status === "met";
  return (
    <span
      className={
        met
          ? "bg-signal-positive/10 text-signal-positive rounded-full px-2.5 py-1 text-xs font-medium"
          : "bg-signal-negative/10 text-signal-negative rounded-full px-2.5 py-1 text-xs font-medium"
      }
    >
      {met ? "Gehaald" : "Niet gehaald"}
    </span>
  );
}

function ThresholdRow({
  label,
  requirement,
  actual,
  status,
}: {
  label: string;
  requirement: string;
  actual: string;
  status: Status;
}) {
  return (
    <div className="border-border flex items-start justify-between gap-4 border-b py-3 last:border-b-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-text-muted text-xs">{requirement}</span>
        <span className="text-text-faint text-xs">{actual}</span>
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

export function ThresholdsSection({
  equityFit,
  cashflow,
  returnRequirement,
  irr,
}: ThresholdsSectionProps) {
  const equityStatus: Status =
    equityFit.fitsWithinAvailableEquity === null
      ? "unknown"
      : equityFit.fitsWithinAvailableEquity
        ? "met"
        : "not-met";

  const cashflowStatus: Status = cashflow.meetsMinMonthlyCashflow ? "met" : "not-met";

  const returnStatus: Status =
    returnRequirement.meetsMinRequiredReturn === null
      ? "unknown"
      : returnRequirement.meetsMinRequiredReturn
        ? "met"
        : "not-met";

  return (
    <section aria-labelledby="sectie-toetsing" className="flex flex-col gap-0">
      <h2 id="sectie-toetsing" className="text-text-faint mb-4 text-xs tracking-widest uppercase">
        7. Toetsing aan de randvoorwaarden
      </h2>

      <ThresholdRow
        label="Eigen vermogen"
        requirement={`Benodigd: ${formatEuro(equityFit.equityRequired)}`}
        actual={
          equityFit.equityAvailable === undefined
            ? "Geen beschikbaar eigen vermogen opgegeven."
            : `Beschikbaar: ${formatEuro(equityFit.equityAvailable)}`
        }
        status={equityStatus}
      />

      <ThresholdRow
        label="Maandcashflow"
        requirement={`Minimaal: ${formatEuro(cashflow.minMonthlyCashflow)}`}
        actual={`Basisscenario: ${formatEuro(cashflow.monthlyCashflow)}`}
        status={cashflowStatus}
      />

      <ThresholdRow
        label="Rendementsdoelstelling"
        requirement={`Minimaal: ${formatPercent(returnRequirement.minRequiredReturn)} IRR`}
        actual={irr.defined ? `Basisscenario: ${formatPercent(irr.irr)} IRR` : "Geen IRR bepaald."}
        status={returnStatus}
      />
    </section>
  );
}
