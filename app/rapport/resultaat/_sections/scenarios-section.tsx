/**
 * §6.3 of UI_SPEC.md's report structure: "De drie scenario's naast elkaar
 * — conservatief, basis, optimistisch."
 *
 * Plain function component, same reasoning as sections 1 and 2. Minimal
 * per scenario, as this task specifies: maandcashflow, DSCR, IRR, score -
 * no dimension breakdown here, that already lives in section 1 for the
 * base scenario, and repeating it three times would just be section 1
 * restated instead of a comparison.
 *
 * A table, not cards - interview round 3 settled this for exactly this
 * section ("de drie scenario's naast elkaar" and the ten-year table were
 * the two named): the table keeps its shape and scrolls horizontally
 * within its own container on a narrow screen, rather than reflowing into
 * a different layout that a PDF export would need a second version of.
 *
 * Table style (DESIGN_SPEC.md §4): row dividers, no vertical borders; the
 * header carries darker text and the accent-coloured underline,
 * distinguishing it from an ordinary row without a second border colour;
 * number cells stay tabular-nums (globals.css sets that on every `table`
 * by default - the explicit `.tabular` class on the numeric cells below is
 * redundant with that default and kept only so a cell still reads
 * correctly if it is ever copied outside a table context).
 */

import { SCENARIO_ID_COPY_NL } from "@/lib/copy/es/scenarios";
import type { IrrResult, ScenarioId } from "@/lib/rules/es/types";
import { formatEuro, formatPercent, formatScore } from "../_lib/format";

export interface ScenarioRow {
  scenario: ScenarioId;
  monthlyCashflow: number;
  dscr: number;
  irr: IrrResult;
  /** ScenarioOutcome.score?.total - null under the same condition TsgScoreSection treats as absent (SCORE_SPEC.md §2.3). */
  scoreTotal: number | null;
}

export interface ScenariosSectionProps {
  /** Exactly three rows, conservative/base/optimistic - the order result.scenarios already arrives in. */
  rows: readonly ScenarioRow[];
}

export function ScenariosSection({ rows }: ScenariosSectionProps) {
  return (
    <section aria-labelledby="sectie-scenarios" className="flex flex-col gap-4">
      <h2 id="sectie-scenarios" className="text-text-faint text-xs tracking-widest uppercase">
        3. De drie scenario&apos;s
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full min-w-lg border-collapse text-sm">
          <thead>
            <tr className="border-accent text-text border-b-2 text-left">
              <th scope="col" className="px-4 py-3 font-medium">
                Scenario
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Maandcashflow
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                DSCR
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                IRR
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.scenario} className="border-border border-b last:border-b-0">
                <td className="px-4 py-3">{SCENARIO_ID_COPY_NL[row.scenario]}</td>
                <td className="tabular px-4 py-3 text-right">
                  {formatEuro(row.monthlyCashflow)}
                </td>
                <td className="tabular px-4 py-3 text-right">
                  {row.dscr.toFixed(2).replace(".", ",")}
                </td>
                <td className="tabular px-4 py-3 text-right">
                  {row.irr.defined ? formatPercent(row.irr.irr) : "—"}
                </td>
                <td className="tabular px-4 py-3 text-right">
                  {row.scoreTotal !== null ? formatScore(row.scoreTotal) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
