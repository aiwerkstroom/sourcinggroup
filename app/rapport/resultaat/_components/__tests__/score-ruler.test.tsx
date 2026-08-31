import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TSG_SCORE_DIMENSION_COPY_NL, TSG_SCORE_DIMENSION_ORDER } from "@/lib/copy/es/score";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import type { TsgScoreDimension } from "@/lib/rules/es/types";
import { SCORE_RULER_TICKS } from "../../_lib/score-ruler-ticks";
import { TsgScoreSection } from "../../_sections/tsg-score-section";
import { ScoreRuler } from "../score-ruler";

/**
 * Golden-render check for the ruler's geometry, per dimension: every tick
 * lands where its anchor says, and the marker lands on the achieved score.
 *
 * The assertions read the SVG's own user-space coordinates rather than
 * pixels. The ruler is drawn in a 0-100 space where x = score x 10, so a
 * tick at 7.5 must sit at x=75 whatever width the container happens to
 * have - which is what makes this checkable at all without a browser.
 *
 * The reference case's own dimension scores (cashflow 1.5, debtResilience
 * 3.3, returnVsRequirement 6.5, feasibility 3.0, dataCertainty 2.4) are the
 * same figures tsg-score-section.test.tsx and engine.test.ts already pin.
 */
const REFERENCE_DIMENSIONS: Record<TsgScoreDimension, number> = {
  cashflow: 1.5,
  debtResilience: 3.3,
  returnVsRequirement: 6.5,
  feasibility: 3,
  dataCertainty: 2.4,
};

/** Pulls every `data-tick="N" ... x1="M"` pair out of the rendered SVG. */
function tickPositions(html: string): Array<{ tick: number; x: number }> {
  return [...html.matchAll(/data-tick="([-\d.]+)"[^>]*?x1="([-\d.]+)"/g)].map((m) => ({
    tick: Number.parseFloat(m[1]!),
    x: Number.parseFloat(m[2]!),
  }));
}

function markerPosition(html: string): { score: number; x: number } | null {
  const m = /data-marker="score" data-score="([-\d.]+)"[^>]*?x1="([-\d.]+)"/.exec(html);
  return m === null ? null : { score: Number.parseFloat(m[1]!), x: Number.parseFloat(m[2]!) };
}

describe("ScoreRuler - tick geometry per dimension", () => {
  it.each(TSG_SCORE_DIMENSION_ORDER)(
    "%s draws one tick per anchor, each at score x 10",
    (dimension) => {
      const ticks = SCORE_RULER_TICKS[dimension];
      const html = renderToStaticMarkup(
        <ScoreRuler
          label={TSG_SCORE_DIMENSION_COPY_NL[dimension].label}
          description={TSG_SCORE_DIMENSION_COPY_NL[dimension].description}
          score={REFERENCE_DIMENSIONS[dimension]}
          ticks={ticks}
        />,
      );

      const drawn = tickPositions(html);
      expect(drawn).toHaveLength(ticks.length);
      expect(drawn.map((d) => d.tick)).toEqual([...ticks]);
      for (const { tick, x } of drawn) {
        expect(x).toBeCloseTo(tick * 10, 10);
      }
      // The ruler spans the whole scale: first tick at the left edge, last at the right.
      expect(drawn[0]!.x).toBe(0);
      expect(drawn[drawn.length - 1]!.x).toBe(100);
    },
  );

  it("places cashflow's uneven anchors exactly, 7.5 included", () => {
    const html = renderToStaticMarkup(
      <ScoreRuler label="Cashflow" description="Kan de belegger het dragen?" score={1.5} ticks={SCORE_RULER_TICKS.cashflow} />,
    );
    expect(tickPositions(html).map((d) => d.x)).toEqual([0, 20, 40, 60, 75, 90, 100]);
  });

  it("draws feasibility's four discrete levels, not a continuous curve", () => {
    const html = renderToStaticMarkup(
      <ScoreRuler label="Haalbaarheid" description="Kan deze deal überhaupt?" score={3} ticks={SCORE_RULER_TICKS.feasibility} />,
    );
    expect(tickPositions(html).map((d) => d.x)).toEqual([0, 30, 70, 100]);
  });
});

describe("ScoreRuler - marker position", () => {
  it.each(TSG_SCORE_DIMENSION_ORDER)("%s puts the marker on the achieved score", (dimension) => {
    const score = REFERENCE_DIMENSIONS[dimension];
    const html = renderToStaticMarkup(
      <ScoreRuler
        label={TSG_SCORE_DIMENSION_COPY_NL[dimension].label}
        description={TSG_SCORE_DIMENSION_COPY_NL[dimension].description}
        score={score}
        ticks={SCORE_RULER_TICKS[dimension]}
      />,
    );

    const marker = markerPosition(html);
    expect(marker).not.toBeNull();
    expect(marker!.score).toBe(score);
    expect(marker!.x).toBeCloseTo(score * 10, 10);
  });

  it("clamps a marker that would fall outside the 0-10 scale", () => {
    const over = markerPosition(
      renderToStaticMarkup(<ScoreRuler label="x" description="y" score={12} ticks={[0, 10]} />),
    );
    const under = markerPosition(
      renderToStaticMarkup(<ScoreRuler label="x" description="y" score={-3} ticks={[0, 10]} />),
    );
    expect(over!.x).toBe(100);
    expect(under!.x).toBe(0);
  });

  it("sits at the extremes exactly for 0 and 10", () => {
    expect(
      markerPosition(renderToStaticMarkup(<ScoreRuler label="x" description="y" score={0} ticks={[0, 10]} />))!.x,
    ).toBe(0);
    expect(
      markerPosition(renderToStaticMarkup(<ScoreRuler label="x" description="y" score={10} ticks={[0, 10]} />))!.x,
    ).toBe(100);
  });
});

describe("ScoreRuler - colour discipline (DESIGN_SPEC.md §1)", () => {
  it("draws the ruler and ticks in grey and only the marker in the accent", () => {
    const html = renderToStaticMarkup(
      <ScoreRuler label="Cashflow" description="Kan de belegger het dragen?" score={1.5} ticks={SCORE_RULER_TICKS.cashflow} />,
    );
    // One accent stroke: the marker. Everything else is the neutral grey.
    expect((html.match(/var\(--color-accent\)/g) ?? []).length).toBe(1);
    expect((html.match(/var\(--color-text-faint\)/g) ?? []).length).toBe(
      SCORE_RULER_TICKS.cashflow.length + 1, // ticks + baseline
    );
    // Not the border tones: at ~1.5:1 they fall under §6's 3:1 floor for a
    // graphical element that carries meaning (see the component docstring).
    expect(html).not.toContain("--color-border");
    // Signal colours are forbidden here - a magnitude is not a threshold.
    expect(html).not.toContain("--color-signal");
  });

  it("labels the ruler for assistive tech and shows the score as text", () => {
    const html = renderToStaticMarkup(
      <ScoreRuler label="Rendement" description="Wordt het risico beloond?" score={6.5} ticks={SCORE_RULER_TICKS.returnVsRequirement} />,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Rendement: 6,5 van 10"');
    expect(html).toContain("Rendement");
    expect(html).toContain("Wordt het risico beloond?");
    expect(html).toContain(">6,5<");
  });
});

describe("TsgScoreSection - renders five rulers from the reference case", () => {
  it("draws one ruler per dimension, each with its own tick set", () => {
    const result = runEngine(referenceCase);
    const base = result.scenarioOutcomes!.find((o) => o.scenario === "base")!;
    const html = renderToStaticMarkup(
      <TsgScoreSection score={base.score} percentile={base.percentile} />,
    );

    // Five rulers, counted by their own marker rather than by <svg>: the
    // section also draws the radar (twice - one variant per medium), so a
    // bare <svg> count would stop meaning "one ruler per dimension".
    expect((html.match(/data-marker="score"/g) ?? []).length).toBe(5);
    expect((html.match(/data-radar="/g) ?? []).length).toBe(2);
    expect((html.match(/<svg/g) ?? []).length).toBe(7);

    const expectedTicks = TSG_SCORE_DIMENSION_ORDER.reduce(
      (sum, d) => sum + SCORE_RULER_TICKS[d].length,
      0,
    );
    expect((html.match(/data-tick=/g) ?? []).length).toBe(expectedTicks);

    // Each dimension's marker is at its own engine-computed score.
    for (const dimension of TSG_SCORE_DIMENSION_ORDER) {
      const score = base.score!.dimensions[dimension];
      expect(score).toBe(REFERENCE_DIMENSIONS[dimension]);
      expect(html).toContain(`data-score="${score}"`);
    }
  });
});

/**
 * The radar's caption, guarded the way app/__tests__/page.test.tsx guards
 * the FAQ against a roadmap claim: by asserting what must be said AND
 * what must not be implied.
 *
 * This caption is load-bearing rather than decorative. The radar draws
 * five axes at equal angles because proportional angles read badly at
 * five dimensions - but the dimensions do not weigh equally in the total
 * (SCORE_SPEC.md §3), and equal angles invite exactly that inference. The
 * caption is the only thing correcting it, since the weighting itself is
 * deliberately not published. Delete it in a refactor and the chart goes
 * back to asserting something untrue about the model, silently.
 */
describe("TsgScoreSection - the radar's caption cannot silently disappear", () => {
  const html = renderToStaticMarkup(
    (() => {
      const base = runEngine(referenceCase).scenarioOutcomes!.find((o) => o.scenario === "base")!;
      return <TsgScoreSection score={base.score} percentile={base.percentile} />;
    })(),
  );
  // Tags stripped so a line break inside the JSX cannot fail a match.
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#x27;/g, " ").replace(/\s+/g, " ");

  it("(a) says what the chart shows", () => {
    expect(text).toMatch(/score per dimensie/i);
  });

  it("(b) says the dimensions do NOT weigh equally in the total", () => {
    // The correction itself. Phrasing may be reworded; the claim may not
    // be dropped, so this matches the assertion rather than a sentence.
    expect(text).toMatch(/wegen niet gelijk mee|niet gelijk mee in het totaal/i);
  });

  it("spells out that equal angles are not equal weights", () => {
    expect(text).toMatch(/gelijke hoeken/i);
    expect(text).toMatch(/geen gelijke weging/i);
  });

  it("still does not publish the weighting - the whole reason a caption was needed", () => {
    // SCORE_SPEC.md §3's actual weights, as percentages and as decimals.
    // If any of these ever appears in this section, the caption has
    // stopped protecting what it exists to protect.
    for (const leak of ["30%", "20%", "15%", "0,30", "0,20", "0,15", "0.3", "0.2", "0.15"]) {
      expect(text, `the weighting must stay unpublished, found ${leak}`).not.toContain(leak);
    }
  });

  it("sits with the chart rather than after the rulers, so it is read before the shape is trusted", () => {
    const captionAt = html.indexOf("score per dimensie");
    const firstRulerAt = html.indexOf('data-marker="score"');
    const radarAt = html.indexOf('data-radar="');
    expect(captionAt).toBeGreaterThan(-1);
    expect(radarAt).toBeGreaterThan(-1);
    expect(captionAt).toBeGreaterThan(radarAt); // under the chart
    expect(captionAt).toBeLessThan(firstRulerAt); // before the rulers
  });

  it("is in the report's caption register, not shouted and not hidden", () => {
    // The same text-text-faint/text-xs treatment every other caption in
    // the report uses - visible small print, not a footnote nobody reads
    // and not a warning banner.
    const captionAt = html.indexOf("score per dimensie");
    const opening = html.lastIndexOf("<p", captionAt);
    const markup = html.slice(opening, captionAt);
    expect(markup).toContain("text-text-faint");
    expect(markup).toContain("text-xs");
  });
});
