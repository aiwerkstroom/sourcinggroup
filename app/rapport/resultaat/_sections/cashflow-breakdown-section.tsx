/**
 * §6.4 of UI_SPEC.md's report structure: "Opbouw van de cashflow — van
 * bruto huur naar netto, elke post zichtbaar."
 *
 * Plain function component, same reasoning as the sections before it: it
 * takes figures the engine already computed for the base scenario and
 * renders them, nothing more. Every cost category ScenarioResult and
 * EngineResult.fixedOperatingCosts carry gets its own row - no merging,
 * per this task's instruction - and every figure is monthly (annual ÷ 12),
 * the unit this report's other headline figures already use.
 *
 * Two subtotals mark where this walk crosses ground the report has already
 * shown. "Cashflow vóór belasting" lands on exactly the figure sections 2
 * and 3 report as the base scenario's monthly cashflow - that number is
 * pre-tax (MODEL_SPEC_FASE1B §4's cashflow/DSCR threshold checks are
 * pre-tax checks). This section then adds one more row, the annual income
 * tax (TaxResult.taxDueBase), to reach a genuinely net, after-tax monthly
 * figure that section 2's headline does not carry. Labelling both
 * subtotals explicitly turns what would otherwise read as two
 * contradictory "maandcashflow" numbers into one legible walk.
 */

import type { FixedOperatingCosts, ScenarioResult, TaxResult } from "@/lib/rules/es/types";
import { formatEuro } from "../_lib/format";

const MONTHS_PER_YEAR = 12;

export interface CashflowBreakdownSectionProps {
  /** Base scenario's steady-state figures. */
  scenario: Pick<
    ScenarioResult,
    | "grossIncome"
    | "propertyManagement"
    | "maintenance"
    | "utilities"
    | "noi"
    | "annualDebtService"
    | "annualCashflow"
  >;
  /** Base-year fixed cost breakdown - constant across scenarios, so it is not scenario-specific. */
  fixedCosts: Pick<
    FixedOperatingCosts,
    "propertyTaxIBI" | "insurance" | "bankAccountFee" | "communityFees"
  >;
  /** Base scenario's annual income tax. */
  annualIncomeTax: TaxResult["taxDueBase"];
}

function Row({ label, annualAmount }: { label: string; annualAmount: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-text-muted text-sm">{label}</span>
      <span className="tabular text-sm">{formatEuro(annualAmount / MONTHS_PER_YEAR)}</span>
    </div>
  );
}

function Subtotal({
  label,
  annualAmount,
  note,
}: {
  label: string;
  annualAmount: number;
  note?: string;
}) {
  return (
    <div className="border-border flex flex-col gap-0.5 border-t pt-2 pb-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="tabular text-sm font-medium">
          {formatEuro(annualAmount / MONTHS_PER_YEAR)}
        </span>
      </div>
      {note !== undefined ? <p className="text-text-faint text-xs">{note}</p> : null}
    </div>
  );
}

export function CashflowBreakdownSection({
  scenario,
  fixedCosts,
  annualIncomeTax,
}: CashflowBreakdownSectionProps) {
  const cashflowAfterTax = scenario.annualCashflow - annualIncomeTax;

  return (
    <section aria-labelledby="sectie-cashflow-opbouw" className="flex flex-col gap-0">
      <h2 id="sectie-cashflow-opbouw" className="text-text-faint mb-4 text-xs tracking-widest uppercase">
        4. Opbouw van de cashflow
      </h2>

      <Row label="Bruto huurinkomsten" annualAmount={scenario.grossIncome} />
      <Row label="Management fee" annualAmount={-scenario.propertyManagement} />
      <Row label="Onderhoud" annualAmount={-scenario.maintenance} />
      <Row label="Nutsvoorzieningen" annualAmount={-scenario.utilities} />
      <Row label="Gemeentelijke belasting (IBI)" annualAmount={-fixedCosts.propertyTaxIBI} />
      <Row label="Verzekeringen" annualAmount={-fixedCosts.insurance} />
      <Row label="Bankkosten" annualAmount={-fixedCosts.bankAccountFee} />
      <Row label="Gastos de comunidad" annualAmount={-fixedCosts.communityFees} />

      <Subtotal label="Bedrijfsresultaat (NOI)" annualAmount={scenario.noi} />

      <Row label="Hypotheekaflossing (rente en aflossing)" annualAmount={-scenario.annualDebtService} />

      <Subtotal
        label="Cashflow vóór belasting"
        annualAmount={scenario.annualCashflow}
        note="Dit is de maandcashflow uit secties 2 en 3, vóór de jaarlijkse inkomstenbelasting."
      />

      <Row label="Inkomstenbelasting" annualAmount={-annualIncomeTax} />

      <Subtotal label="Netto maandcashflow (na belasting)" annualAmount={cashflowAfterTax} />
    </section>
  );
}
