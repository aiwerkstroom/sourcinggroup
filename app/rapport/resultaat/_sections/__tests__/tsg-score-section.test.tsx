import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import { TsgScoreSection } from "../tsg-score-section";

/**
 * Golden-render check: the reference case's base-scenario score
 * (SCORE_SPEC.md §4 / outcome.test.ts's own golden values - total 3,8,
 * percentile 70, dimensions 1,5 / 3,3 / 6,5 / 3,0 / 2,8) must appear in
 * the rendered HTML. Rendered with react-dom/server rather than a DOM
 * testing library - no new dependency, and it is exactly what a
 * server-rendered report page (and later, its PDF) actually produces.
 *
 * Runs against the real engine, not hand-typed fixtures: any regression
 * in the calculation layer or in this component shows up here the same
 * way it would in outcome.test.ts.
 */

function renderBaseScore() {
  const result = runEngine(referenceCase);
  const base = result.scenarioOutcomes!.find((o) => o.scenario === "base")!;
  const html = renderToStaticMarkup(
    <TsgScoreSection score={base.score} percentile={base.percentile} />,
  );
  return { html, base };
}

describe("TsgScoreSection - golden render against the reference case", () => {
  it("renders the total score and percentile", () => {
    const { html, base } = renderBaseScore();
    expect(base.score!.total).toBe(3.8);
    expect(base.percentile).toBe(70);
    expect(html).toContain("3,8");
    expect(html).toContain("percentiel 70 van ons modelbereik");
  });

  it("renders all five dimension scores at their golden values", () => {
    const { html, base } = renderBaseScore();
    expect(base.score!.dimensions).toEqual({
      cashflow: 1.5,
      debtResilience: 3.3,
      returnVsRequirement: 6.5,
      feasibility: 3.0,
      dataCertainty: 2.8,
    });
    expect(html).toContain("1,5");
    expect(html).toContain("3,3");
    expect(html).toContain("6,5");
    expect(html).toContain("3,0");
    expect(html).toContain("2,8");
  });

  it("renders the five Dutch labels and their UI_SPEC.md §5 descriptions", () => {
    const { html } = renderBaseScore();
    expect(html).toContain("Cashflow");
    expect(html).toContain("Kan de belegger het dragen?");
    expect(html).toContain("Schuldbestendigheid");
    expect(html).toContain("Houdt het stand bij tegenwind?");
    expect(html).toContain("Rendement");
    expect(html).toContain("Wordt het risico beloond?");
    expect(html).toContain("Haalbaarheid");
    expect(html).toContain("Kan deze deal überhaupt?");
    expect(html).toContain("Datazekerheid");
    expect(html).toContain("Hoe stevig staan de cijfers?");
  });

  it("never renders the word 'percentiel' when percentile is null", () => {
    const html = renderToStaticMarkup(<TsgScoreSection score={null} percentile={null} />);
    expect(html).not.toContain("percentiel");
  });

  it("renders no dimension bars and no numeric score when score is null", () => {
    const html = renderToStaticMarkup(<TsgScoreSection score={null} percentile={null} />);
    expect(html).not.toContain("Cashflow");
    expect(html).toContain("geen score");
  });

  it("does not leak the engine's internal English IRR reason into the Dutch page", () => {
    const html = renderToStaticMarkup(<TsgScoreSection score={null} percentile={null} />);
    expect(html).not.toMatch(/NPV|cashflow series|sign change/i);
  });
});

describe("TsgScoreSection - marker position reflects the score across the 0-10 track", () => {
  /*
   * This assertion used to read the inline `width:0%` / `width:100%` of the
   * old proportional bar. DESIGN_SPEC.md §4 replaced that bar with a ruler
   * (ScoreRuler), so the mechanism moved from a div's CSS width to a marker's
   * x in the SVG's 0-100 user space. The intent is unchanged and still worth
   * asserting here at section level - a score of 0 sits hard left, a score of
   * 10 hard right, a mid score in between - so the test is rewritten rather
   * than dropped. The ruler's own geometry is covered in depth by
   * score-ruler.test.tsx.
   */
  it("puts the 0-score marker at the left edge and the 10-score marker at the right", () => {
    const html = renderToStaticMarkup(
      <TsgScoreSection
        score={{
          dimensions: {
            cashflow: 0,
            debtResilience: 10,
            returnVsRequirement: 5,
            feasibility: 5,
            dataCertainty: 5,
          },
          total: 5.0,
        }}
        percentile={50}
      />,
    );

    const markers = [...html.matchAll(/data-marker="score" data-score="([-\d.]+)" x1="([-\d.]+)"/g)].map(
      (m) => ({ score: Number.parseFloat(m[1]!), x: Number.parseFloat(m[2]!) }),
    );

    expect(markers).toHaveLength(5);
    expect(markers.find((m) => m.score === 0)!.x).toBe(0);
    expect(markers.find((m) => m.score === 10)!.x).toBe(100);
    expect(markers.filter((m) => m.score === 5).every((m) => m.x === 50)).toBe(true);
  });
});
