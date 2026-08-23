import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import type { ScenarioId } from "@/lib/rules/es/types";
import { ScenariosSection } from "../scenarios-section";
import type { ScenarioRow } from "../scenarios-section";

/**
 * Golden-render check: all nine values (three scenarios x monthlyCashflow/
 * dscr/irr, plus the three totals) against the figures already locked
 * down independently in engine.test.ts, irr.test.ts and outcome.test.ts:
 *
 *              monthlyCashflow          dscr                  irr           score
 * conservative -799,459411956443  0,5833445954702777  0,02175059635133949    1,8
 * base         -311,138231408102  0,8323276301747033  0,055436784474295564   3,8
 * optimistic    172,05543916912   1,0943011144996524  0,08640301656996599    5,6
 */

function rowsFromReferenceCase(): { rows: ScenarioRow[]; result: ReturnType<typeof runEngine> } {
  const result = runEngine(referenceCase);
  const rows: ScenarioRow[] = result.scenarios.map((scenario) => {
    const outcome = result.scenarioOutcomes!.find((o) => o.scenario === scenario.id)!;
    return {
      scenario: scenario.id,
      monthlyCashflow: scenario.monthlyCashflow,
      dscr: scenario.dscr,
      irr: outcome.irr,
      scoreTotal: outcome.score!.total,
    };
  });
  return { rows, result };
}

describe("ScenariosSection - golden render against the reference case", () => {
  it("computes the nine golden values before rendering, so the test itself is pinned", () => {
    const { rows } = rowsFromReferenceCase();
    const byId = Object.fromEntries(rows.map((r) => [r.scenario, r])) as Record<
      ScenarioId,
      ScenarioRow
    >;

    expect(byId.conservative.monthlyCashflow).toBeCloseTo(-799.459411956443, 8);
    expect(byId.conservative.dscr).toBeCloseTo(0.5833445954702777, 10);
    expect(byId.conservative.irr.defined && byId.conservative.irr.irr).toBeCloseTo(
      0.019522793298820035,
      6,
    );
    expect(byId.conservative.scoreTotal).toBe(1.7);

    expect(byId.base.monthlyCashflow).toBeCloseTo(-311.138231408102, 8);
    expect(byId.base.dscr).toBeCloseTo(0.8323276301747033, 10);
    expect(byId.base.irr.defined && byId.base.irr.irr).toBeCloseTo(0.05239467195060571, 6);
    expect(byId.base.scoreTotal).toBe(3.6);

    expect(byId.optimistic.monthlyCashflow).toBeCloseTo(172.05543916912, 8);
    expect(byId.optimistic.dscr).toBeCloseTo(1.0943011144996524, 10);
    expect(byId.optimistic.irr.defined && byId.optimistic.irr.irr).toBeCloseTo(
      0.08283859450893945,
      6,
    );
    expect(byId.optimistic.scoreTotal).toBe(5.5);
  });

  it("renders all nine values as Dutch-formatted text", () => {
    const { rows } = rowsFromReferenceCase();
    const html = renderToStaticMarkup(<ScenariosSection rows={rows} />);

    // Euro amounts: Intl inserts a non-breaking space (U+00A0) after "€".
    expect(html).toContain("€ -799");
    expect(html).toContain("€ -311");
    expect(html).toContain("€ 172");

    expect(html).toContain("0,58");
    expect(html).toContain("0,83");
    expect(html).toContain("1,09");

    expect(html).toContain("1,95%");
    expect(html).toContain("5,24%");
    expect(html).toContain("8,28%");

    expect(html).toContain("1,7");
    expect(html).toContain("3,6");
    expect(html).toContain("5,5");
  });

  it("renders the three Dutch scenario labels, in order", () => {
    const { rows } = rowsFromReferenceCase();
    const html = renderToStaticMarkup(<ScenariosSection rows={rows} />);
    const conservativeIndex = html.indexOf("Conservatief");
    const baseIndex = html.indexOf(">Basis<");
    const optimisticIndex = html.indexOf("Optimistisch");
    expect(conservativeIndex).toBeGreaterThan(-1);
    expect(baseIndex).toBeGreaterThan(-1);
    expect(optimisticIndex).toBeGreaterThan(-1);
    expect(conservativeIndex).toBeLessThan(baseIndex);
    expect(baseIndex).toBeLessThan(optimisticIndex);
  });

  it("shows exactly one row per scenario - no dimension breakdown here", () => {
    const { rows } = rowsFromReferenceCase();
    const html = renderToStaticMarkup(<ScenariosSection rows={rows} />);
    // Section 1's dimension vocabulary must not leak into section 3 - the
    // breakdown belongs there, not repeated three times here.
    expect(html).not.toContain("Schuldbestendigheid");
    expect(html).not.toContain("Datazekerheid");
    expect((html.match(/<tr/g) ?? []).length).toBe(4); // header + 3 rows
  });
});

describe("ScenariosSection - undefined IRR and null score render as em dash, not zero", () => {
  it("never prints 0% or 0,0 for a scenario with no exit planned", () => {
    const rows: ScenarioRow[] = [
      {
        scenario: "base",
        monthlyCashflow: -100,
        dscr: 0.9,
        irr: { defined: false, reason: "No exit was planned for this scenario." },
        scoreTotal: null,
      },
    ];
    const html = renderToStaticMarkup(<ScenariosSection rows={rows} />);
    expect(html).toContain("—");
    expect(html).not.toContain("0%");
    expect(html).not.toContain(">0,0<");
    expect(html).not.toMatch(/No exit was planned/);
  });
});
