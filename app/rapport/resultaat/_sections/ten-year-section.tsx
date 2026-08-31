/**
 * §6.5 of UI_SPEC.md's report structure: "De tienjarige reeks — met jaar 5
 * gemarkeerd, geëxtrapoleerde jaren aangeduid."
 *
 * Two parts in one section, same source data: the cashflow chart first,
 * for the story, and the table under it, for the detail - the same order
 * the score section uses for its radar and rulers. Both plain function
 * components, same reasoning as the sections before them - they take
 * EngineResult.scenarioOutcomes as-is and render it, so the golden-render
 * test, the wizard's result page and the later PDF all see the identical
 * markup (CLAUDE.md §3).
 *
 * NOTHING WAS REMOVED FROM THE TABLE, and that was checked rather than
 * assumed. It carries five metrics per scenario per year, and four of the
 * five appear nowhere else in the report: gross rent and NOI exist only
 * as a single steady-state year in section 4, the mortgage balance only
 * as its exit value in section 6, and equity built appears in no other
 * section at all. Replacing the table with a chart of one metric would
 * have dropped 120 of its 150 figures. So the chart was added above it,
 * and the table doubles as the chart's text alternative.
 *
 * The chart it replaces (CashflowTrendChart) drew all three scenarios as
 * overlaid lines coloured per scenario. That could not also tint by sign
 * - three sign-tinted fills would sit on top of each other - so it became
 * three stacked panels on one shared scale. See cashflow-chart.tsx.
 *
 * ScenarioOutcome.years already carries `extrapolated` per year
 * (indexation.ts's isExtrapolated, via projection.ts and outcome.ts) - this
 * section marks years beyond the sourced Correction Factors series because
 * the engine says so, not via a hardcoded "year > 5" check that would
 * silently go stale if CORRECTION_FACTORS_LAST_YEAR ever moved. Year 5 is
 * underlined for the same reason it happens to be the last non-extrapolated
 * year in the reference case: it is the boundary the data itself reports,
 * read off `extrapolated` turning true one row later - not a second,
 * independent "year === 5" rule that could disagree with it.
 *
 * The signal palette is no longer spent here. The old chart used it for
 * the three scenarios; the new one encodes sign in the brand's own sage
 * and dark green and uses no signal colour at all - so section 7's
 * badges are once again the only place in the report where a colour
 * means pass or fail, and UI_SPEC.md §1's reservation needs no exception.
 *
 * Table style (DESIGN_SPEC.md §4): the compound two-row header (scenario
 * groups over their five metrics each) gets one accent-coloured underline
 * at its own bottom edge - on the second header row, not the first, since
 * that is where the header block actually ends and the body begins. The
 * lighter border between the two header rows stays the neutral tone: it
 * separates two header tiers, not header from data, so it does not carry
 * the same accent weight. Body rows keep a plain row divider, no vertical
 * rules anywhere.
 */

import { SCENARIO_ID_COPY_NL } from "@/lib/copy/es/scenarios";
import type { ScenarioOutcome } from "@/lib/rules/es/types";
import { CashflowChart } from "../_components/cashflow-chart";
import { formatEuro } from "../_lib/format";

const MONTHS_PER_YEAR = 12;

export interface TenYearSectionProps {
  /** Exactly three outcomes, conservative/base/optimistic - the order EngineResult.scenarioOutcomes already arrives in. */
  outcomes: readonly ScenarioOutcome[];
}

function euroInt(value: number): string {
  return formatEuro(Math.round(value));
}

/** The year cell both table shapes share: the number, year 5's underline, and the extrapolated marker. */
function YearCell({ year }: { year: ScenarioOutcome["years"][number] }) {
  return (
    <td className="px-4 py-3">
      <span className={year.yearNumber === 5 ? "underline decoration-1 underline-offset-2" : undefined}>
        {year.yearNumber}
      </span>
      {year.extrapolated ? <span className="text-text-faint ml-1 text-xs italic">e</span> : null}
    </td>
  );
}

const METRIC_LABELS = [
  "Bruto huur",
  "NOI",
  "Cashflow na belasting",
  "Hypotheekschuld",
  "Eigen vermogen opgebouwd",
] as const;

function metricCells(y: ScenarioOutcome["years"][number], keyBase: string) {
  const values = [y.grossIncome, y.noi, y.cashflowAfterTax, y.mortgageBalance, y.equityBuilt];
  return METRIC_LABELS.map((label, i) => (
    <td key={`${keyBase}-${label}`} className="tabular px-4 py-3 text-right">
      {euroInt(values[i]!)}
    </td>
  ));
}

const TABLE_FOOTNOTE = (
  <p className="text-text-faint mt-3 max-w-prose text-xs leading-relaxed">
    Jaar 5 is onderstreept: de laatste jaargang binnen de brondata (Correction Factors). Jaren
    gemarkeerd met <span className="italic">e</span> liggen daarna en zijn geëxtrapoleerd met
    dezelfde jaarlijkse groei, niet apart onderbouwd.
  </p>
);

/**
 * The screen table: one row per year, all three scenarios side by side
 * (sixteen columns). Deliberately print:hidden - measured at 1628px
 * rendered width against the reference case, far past what any page
 * format's printable area can hold even in landscape, and print has no
 * scrollbar to fall back on the way the screen's overflow-x-auto does.
 * PrintTenYearTables (below) is print's own, narrower replacement, not a
 * CSS shrink of this one - the fase 3 design checkpoint that decided
 * landscape for the report as a whole also decided section 5 still needed
 * a genuinely different print shape on top of that.
 */
export function TenYearTable({ outcomes }: TenYearSectionProps) {
  const rowCount = outcomes[0]?.years.length ?? 0;

  return (
    <div className="overflow-x-auto print:hidden">
      <table className="w-full min-w-4xl border-collapse text-sm">
        <thead>
          <tr className="text-text text-left">
            <th scope="col" rowSpan={2} className="px-4 py-3 align-bottom font-medium">
              Jaar
            </th>
            {outcomes.map((outcome) => (
              <th
                key={outcome.scenario}
                scope="colgroup"
                colSpan={5}
                className="border-border border-b px-4 py-3 text-center font-medium"
              >
                {SCENARIO_ID_COPY_NL[outcome.scenario]}
              </th>
            ))}
          </tr>
          <tr className="border-accent text-text-muted border-b-2 text-left text-xs">
            {outcomes.map((outcome) =>
              METRIC_LABELS.map((label) => (
                <th key={`${outcome.scenario}-${label}`} scope="col" className="px-4 py-3 text-right font-medium">
                  {label}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }, (_, i) => {
            const first = outcomes[0]!.years[i]!;
            return (
              <tr key={first.yearNumber} className="border-border border-b last:border-b-0">
                <YearCell year={first} />
                {outcomes.flatMap((outcome) =>
                  metricCells(outcome.years[i]!, `${first.yearNumber}-${outcome.scenario}`),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Print's own replacement for the screen table above: the same thirty
 * scenario-years, as three compact six-column tables (Jaar + the same
 * five metrics), one per scenario, stacked instead of side by side. Each
 * is under 700px at this padding - comfortable even in portrait, so
 * landscape gives it room to spare. hidden on screen (the wide table
 * already serves that reader); print:block only when printing.
 */
function PrintTenYearTables({ outcomes }: TenYearSectionProps) {
  return (
    <div className="hidden print:block">
      <div className="flex flex-col gap-6">
        {outcomes.map((outcome) => (
          <table
            key={outcome.scenario}
            className="w-full max-w-lg border-collapse text-sm break-inside-avoid"
          >
            <thead>
              <tr className="border-accent text-text border-b-2 text-left">
                <th scope="col" colSpan={6} className="px-4 py-2 font-medium">
                  {SCENARIO_ID_COPY_NL[outcome.scenario]}
                </th>
              </tr>
              <tr className="text-text-muted text-left text-xs">
                <th scope="col" className="px-4 py-2 font-medium">
                  Jaar
                </th>
                {METRIC_LABELS.map((label) => (
                  <th key={label} scope="col" className="px-4 py-2 text-right font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {outcome.years.map((year) => (
                <tr key={year.yearNumber} className="border-border border-b last:border-b-0">
                  <YearCell year={year} />
                  {metricCells(year, `print-${outcome.scenario}-${year.yearNumber}`)}
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}

function TenYearTables(props: TenYearSectionProps) {
  return (
    <>
      <TenYearTable {...props} />
      <PrintTenYearTables {...props} />
      {TABLE_FOOTNOTE}
    </>
  );
}

export function TenYearSection({ outcomes }: TenYearSectionProps) {
  // Derived once and handed to both chart variants, so the two drawings
  // cannot disagree about what they are drawing.
  const panels = outcomes.map((outcome) => ({
    label: SCENARIO_ID_COPY_NL[outcome.scenario],
    years: outcome.years.map((year) => ({
      yearNumber: year.yearNumber,
      // Monthly, matching sections 2 and 3's headline figures rather
      // than the table's annual columns directly below.
      monthlyCashflow: year.cashflowAfterTax / MONTHS_PER_YEAR,
      extrapolated: year.extrapolated,
    })),
  }));

  return (
    <section aria-labelledby="sectie-tienjarige-reeks" className="flex flex-col gap-6">
      <h2 id="sectie-tienjarige-reeks" className="text-text-faint text-xs tracking-widest uppercase">
        5. De tienjarige reeks
      </h2>

      {/*
       * Chart first for the story, table under it for the detail - the
       * same order the score section uses for its radar and rulers. The
       * table is unchanged and stays the full record: it is the only
       * place in the report carrying gross rent, NOI, mortgage balance
       * and equity built per year, and equity built appears nowhere else
       * at all. It doubles as this chart's text alternative.
       */}
      <CashflowChart panels={panels} variant="interactive" className="print:hidden" />
      {/*
       * No break-inside-avoid here, and that was measured rather than
       * assumed: the printed chart renders 543px tall against landscape
       * A4's 703px printable height and currently lands whole on page 5.
       * Adding break-inside-avoid changed the rendered PDF by not one
       * byte - this section is a flex container, and Chromium does not
       * honour break-inside on flex items. If the chart ever does end up
       * straddling a page break, the fix is to take it out of the flex
       * flow first; the property on its own will not do anything.
       */}
      <CashflowChart panels={panels} variant="static" className="hidden print:block" />

      <p className="text-text-faint max-w-prose text-xs leading-relaxed">
        Maandcashflow na belasting per scenario, alle drie op dezelfde schaal. De donkere vlakken
        liggen boven nul, de lichte eronder — waar een vlak de nullijn kruist, slaat de cashflow om.
        Vanaf de stippellijn zijn de jaren geëxtrapoleerd: die omslag rust dus op doorgetrokken
        groei, niet op brondata. De tabel hieronder geeft dezelfde reeks als cijfers, met vier
        andere posten erbij.
      </p>

      <TenYearTables outcomes={outcomes} />
    </section>
  );
}
