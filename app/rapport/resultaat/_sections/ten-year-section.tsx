/**
 * §6.5 of UI_SPEC.md's report structure: "De tienjarige reeks — met jaar 5
 * gemarkeerd, geëxtrapoleerde jaren aangeduid."
 *
 * Two parts in one section, same source data: a table with every
 * scenario's year-by-year figures, and an SVG line chart of the monthly
 * cashflow trend. Both plain function components, same reasoning as the
 * sections before them - they take EngineResult.scenarioOutcomes as-is and
 * render it, so the golden-render test, the wizard's result page and the
 * later PDF all see the identical markup (CLAUDE.md §3).
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
 * The three scenario colours are the app's own signal palette
 * (globals.css): conservative in signal-negative, optimistic in
 * signal-positive, base in signal-neutral - not a rule this report bends
 * (UI_SPEC.md §1 reserves colour for pass/fail signals elsewhere), but a
 * deliberate choice for this one chart, where the three lines' relative
 * standing is exactly what "worse / middle / better" already means.
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
import type { ScenarioId, ScenarioOutcome } from "@/lib/rules/es/types";
import { formatEuro } from "../_lib/format";

const MONTHS_PER_YEAR = 12;

export interface TenYearSectionProps {
  /** Exactly three outcomes, conservative/base/optimistic - the order EngineResult.scenarioOutcomes already arrives in. */
  outcomes: readonly ScenarioOutcome[];
}

const SCENARIO_COLOR: Readonly<Record<ScenarioId, string>> = {
  conservative: "var(--color-signal-negative)",
  base: "var(--color-signal-neutral)",
  optimistic: "var(--color-signal-positive)",
};

function euroInt(value: number): string {
  return formatEuro(Math.round(value));
}

export function TenYearTable({ outcomes }: TenYearSectionProps) {
  const rowCount = outcomes[0]?.years.length ?? 0;

  return (
    <div className="overflow-x-auto">
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
              [
                "Bruto huur",
                "NOI",
                "Cashflow na belasting",
                "Hypotheekschuld",
                "Eigen vermogen opgebouwd",
              ].map((label) => (
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
            const isYearFive = first.yearNumber === 5;
            return (
              <tr key={first.yearNumber} className="border-border border-b last:border-b-0">
                <td className="px-4 py-3">
                  <span className={isYearFive ? "underline decoration-1 underline-offset-2" : undefined}>
                    {first.yearNumber}
                  </span>
                  {first.extrapolated ? (
                    <span className="text-text-faint ml-1 text-xs italic">e</span>
                  ) : null}
                </td>
                {outcomes.flatMap((outcome) => {
                  const y = outcome.years[i]!;
                  const keyBase = `${first.yearNumber}-${outcome.scenario}`;
                  return [
                    <td key={`${keyBase}-gross`} className="tabular px-4 py-3 text-right">
                      {euroInt(y.grossIncome)}
                    </td>,
                    <td key={`${keyBase}-noi`} className="tabular px-4 py-3 text-right">
                      {euroInt(y.noi)}
                    </td>,
                    <td key={`${keyBase}-cfat`} className="tabular px-4 py-3 text-right">
                      {euroInt(y.cashflowAfterTax)}
                    </td>,
                    <td key={`${keyBase}-mortgage`} className="tabular px-4 py-3 text-right">
                      {euroInt(y.mortgageBalance)}
                    </td>,
                    <td key={`${keyBase}-equity`} className="tabular px-4 py-3 text-right">
                      {euroInt(y.equityBuilt)}
                    </td>,
                  ];
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-text-faint mt-3 max-w-prose text-xs leading-relaxed">
        Jaar 5 is onderstreept: de laatste jaargang binnen de brondata (Correction Factors). Jaren
        gemarkeerd met <span className="italic">e</span> liggen daarna en zijn geëxtrapoleerd met
        dezelfde jaarlijkse groei, niet apart onderbouwd.
      </p>
    </div>
  );
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 320;
const MARGIN = { top: 16, right: 16, bottom: 28, left: 64 };

export function CashflowTrendChart({ outcomes }: TenYearSectionProps) {
  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

  const series = outcomes.map((outcome) => ({
    scenario: outcome.scenario,
    points: outcome.years.map((y) => ({
      yearNumber: y.yearNumber,
      monthlyCashflow: y.cashflowAfterTax / MONTHS_PER_YEAR,
    })),
  }));

  const yearNumbers = series[0]?.points.map((p) => p.yearNumber) ?? [];
  const minYear = Math.min(...yearNumbers);
  const maxYear = Math.max(...yearNumbers);

  const allValues = series.flatMap((s) => s.points.map((p) => p.monthlyCashflow));
  const rawMin = Math.min(...allValues, 0);
  const rawMax = Math.max(...allValues, 0);
  // A little headroom so the extreme points do not sit on the plot's edge.
  const padding = (rawMax - rawMin) * 0.08 || 1;
  const valueMin = rawMin - padding;
  const valueMax = rawMax + padding;

  const xFor = (yearNumber: number): number => {
    if (maxYear === minYear) return MARGIN.left + plotWidth / 2;
    return MARGIN.left + ((yearNumber - minYear) / (maxYear - minYear)) * plotWidth;
  };
  const yFor = (value: number): number => {
    if (valueMax === valueMin) return MARGIN.top + plotHeight / 2;
    return MARGIN.top + (1 - (value - valueMin) / (valueMax - valueMin)) * plotHeight;
  };

  const zeroY = yFor(0);
  const showZeroLine = valueMin < 0 && valueMax > 0;

  return (
    <div className="flex flex-col gap-3">
      <svg
        role="img"
        aria-label="Cashflow-trend per scenario, maandcashflow na belasting, jaar 1 tot en met 10"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full max-w-2xl"
      >
        {/* Axes */}
        <line
          x1={MARGIN.left}
          y1={MARGIN.top}
          x2={MARGIN.left}
          y2={CHART_HEIGHT - MARGIN.bottom}
          stroke="var(--color-border)"
        />
        <line
          x1={MARGIN.left}
          y1={CHART_HEIGHT - MARGIN.bottom}
          x2={CHART_WIDTH - MARGIN.right}
          y2={CHART_HEIGHT - MARGIN.bottom}
          stroke="var(--color-border)"
        />

        {showZeroLine ? (
          <line
            x1={MARGIN.left}
            y1={zeroY}
            x2={CHART_WIDTH - MARGIN.right}
            y2={zeroY}
            stroke="var(--color-border)"
            strokeDasharray="3 3"
          />
        ) : null}

        {/* Y-axis reference labels: min, zero (if in range) and max */}
        <text x={MARGIN.left - 8} y={yFor(valueMax) + 4} textAnchor="end" className="fill-text-faint text-[10px]">
          {euroInt(valueMax)}
        </text>
        {showZeroLine ? (
          <text x={MARGIN.left - 8} y={zeroY + 4} textAnchor="end" className="fill-text-faint text-[10px]">
            {euroInt(0)}
          </text>
        ) : null}
        <text x={MARGIN.left - 8} y={yFor(valueMin) + 4} textAnchor="end" className="fill-text-faint text-[10px]">
          {euroInt(valueMin)}
        </text>

        {/* X-axis year labels */}
        {yearNumbers.map((yearNumber) => (
          <text
            key={yearNumber}
            x={xFor(yearNumber)}
            y={CHART_HEIGHT - MARGIN.bottom + 16}
            textAnchor="middle"
            className="fill-text-faint text-[10px]"
          >
            {yearNumber}
          </text>
        ))}

        {series.map((s) => (
          <g key={s.scenario} data-scenario={s.scenario}>
            <polyline
              data-scenario={s.scenario}
              points={s.points.map((p) => `${xFor(p.yearNumber)},${yFor(p.monthlyCashflow)}`).join(" ")}
              fill="none"
              stroke={SCENARIO_COLOR[s.scenario]}
              strokeWidth={2}
            />
            {s.points.map((p) => (
              <circle
                key={p.yearNumber}
                data-scenario={s.scenario}
                data-year={p.yearNumber}
                data-value={p.monthlyCashflow}
                cx={xFor(p.yearNumber)}
                cy={yFor(p.monthlyCashflow)}
                r={2.5}
                fill={SCENARIO_COLOR[s.scenario]}
              />
            ))}
          </g>
        ))}
      </svg>

      <ul className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
        {outcomes.map((outcome) => (
          <li key={outcome.scenario} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: SCENARIO_COLOR[outcome.scenario] }}
            />
            <span className="text-text-muted">{SCENARIO_ID_COPY_NL[outcome.scenario]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TenYearSection({ outcomes }: TenYearSectionProps) {
  return (
    <section aria-labelledby="sectie-tienjarige-reeks" className="flex flex-col gap-6">
      <h2 id="sectie-tienjarige-reeks" className="text-text-faint text-xs tracking-widest uppercase">
        5. De tienjarige reeks
      </h2>

      <TenYearTable outcomes={outcomes} />
      <CashflowTrendChart outcomes={outcomes} />
    </section>
  );
}
