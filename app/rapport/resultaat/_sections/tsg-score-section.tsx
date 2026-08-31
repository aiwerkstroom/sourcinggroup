/**
 * §6.1 of UI_SPEC.md's report structure: "TSG-score — de vijf dimensies
 * visueel, de totaalscore, het percentiel."
 *
 * A plain function component, not a client component: it takes the
 * already-computed TsgScore and renders it, nothing more, so it can be
 * rendered on the server for the wizard's result page and, unchanged,
 * with react-dom/server in a golden-render test - and later from the same
 * markup Playwright turns into the PDF (CLAUDE.md §3, "één ontwerp, twee
 * outputs").
 *
 * === Two views of the same five numbers ===
 *
 * A radar first, for the shape - a lopsided pentagon shows where the
 * weakness is before any number is read - and the five rulers under it,
 * unchanged, for the detail. Nothing was removed: the rulers are still the
 * only place SCORE_SPEC §2's uneven grading slopes are visible at all, and
 * still the plainest text rendering of the five values. Each ruler stays
 * independent, on its own 0-10 scale.
 *
 * WHY THE ANGLES ARE EQUAL, AND WHY THAT NEEDS A CAPTION. Interview round
 * 2 originally ruled a radar out for a specific reason: equal-angle axes
 * read as equal weights, and the real weights are not equal
 * (SCORE_SPEC.md §3). Both other ways out were rejected on their merits -
 * angles proportional to the weights draw badly at five dimensions, and
 * publishing the weights is ruled out by SCORE_SPEC.md, which explains the
 * method in outline and deliberately does not publish the weighting.
 *
 * So the fix is a caption rather than a change of shape: the paragraph
 * under the chart states both that the chart shows a score per dimension
 * and that the dimensions do not weigh equally in the total. That
 * corrects the false inference the geometry would otherwise invite,
 * without giving the weighting away. The total is also printed as its own
 * figure above the chart, so nobody has to read it off an area.
 *
 * The caption is load-bearing, not decoration - without it the drawing
 * asserts something untrue about the model. __tests__/score-ruler.test.tsx
 * guards both halves of it against a silent refactor, the same way the
 * homepage test guards the FAQ against a roadmap claim creeping back in.
 *
 * The ruler itself (tick-marks at SCORE_SPEC §2's anchors, single accent
 * marker) lives in ScoreRuler - DESIGN_SPEC.md §4 asked for one component
 * called five times, so the dimension loop below stays a loop and the
 * drawing stays in one place. The radar lives in ScoreRadar, in two
 * variants: interactive on screen, static in the PDF (its own docstring
 * explains why that is a prop rather than a media query).
 *
 * Colour stays neutral. UI_SPEC.md §1 reserves colour for a pass/fail
 * signal (a threshold met or not); a dimension's magnitude is not a
 * threshold, so every ruler is drawn identically regardless of value - a
 * low score is not painted red.
 */

import { TSG_SCORE_DIMENSION_COPY_NL, TSG_SCORE_DIMENSION_ORDER } from "@/lib/copy/es/score";
import type { TsgScore } from "@/lib/rules/es/types";
import { ScoreRadar } from "../_components/score-radar";
import { ScoreRuler } from "../_components/score-ruler";
import { SCORE_RULER_TICKS } from "../_lib/score-ruler-ticks";
import { formatScore } from "../_lib/format";

export interface TsgScoreSectionProps {
  /**
   * The base scenario's score. Null exactly when SCORE_SPEC.md §2.3 has no
   * IRR to score - not a bad outcome, the absence of an answer (score.ts's
   * own docstring on ScenarioOutcome.score).
   */
  score: TsgScore | null;
  /** Null exactly when score is null - there is nothing to place in the reference distribution without a total. */
  percentile: number | null;
}

export function TsgScoreSection({ score, percentile }: TsgScoreSectionProps) {
  return (
    <section aria-labelledby="sectie-tsg-score" className="flex flex-col gap-6">
      <h2 id="sectie-tsg-score" className="text-text-faint text-xs tracking-widest uppercase">
        1. Yield &amp; Stone-score
      </h2>

      {score === null ? (
        <p className="text-text-muted max-w-prose text-sm leading-relaxed">
          Voor dit scenario bestaat geen rendementscijfer: geen enkele rentevoet brengt de
          kasstroomreeks op nul. Dat is geen zwakke uitkomst maar het ontbreken van een antwoord op
          de rendementsvraag, dus geeft dit rapport hier geen score — niet een verzonnen lage.
        </p>
      ) : (
        <ScoreBody score={score} percentile={percentile} />
      )}
    </section>
  );
}

/**
 * The score-present half. Split out only so `score` is non-null for the
 * whole body: the radar's points have to be derived before the JSX, and a
 * const inside a ternary branch is not something TypeScript narrows.
 */
function ScoreBody({ score, percentile }: { score: TsgScore; percentile: number | null }) {
  // Derived once and handed to both radar variants, so the two drawings
  // cannot disagree about what they are drawing.
  const radarPoints = TSG_SCORE_DIMENSION_ORDER.map((dimension) => ({
    label: TSG_SCORE_DIMENSION_COPY_NL[dimension].label,
    score: score.dimensions[dimension],
  }));

  return (
    <>
      <div className="flex items-baseline gap-4">
        <span className="tabular text-5xl font-semibold">{formatScore(score.total)}</span>
        {percentile !== null ? (
          <span className="text-text-muted text-sm">
            percentiel {percentile} van ons modelbereik
          </span>
        ) : null}
      </div>

      {/*
       * Both variants render, and the print classes decide which one an
       * output gets - the same technique ten-year-section.tsx uses for
       * its wide and narrow tables. Threading a flag down from the print
       * route instead would make every component in between carry a prop
       * about page media.
       */}
      <ScoreRadar points={radarPoints} variant="interactive" className="print:hidden" />
      <ScoreRadar points={radarPoints} variant="static" className="hidden print:block" />

      {/*
       * The caption that corrects what the shape would otherwise imply.
       * Equal angles are a drawing decision, not a statement about the
       * model: the dimensions do not count equally toward the total.
       * Making the angles proportional to the weights was ruled out (it
       * draws badly), and publishing the weights is ruled out by
       * SCORE_SPEC.md - the method is explained in outline, the weighting
       * itself is not published. So the correction is words, not
       * geometry. __tests__/score-ruler.test.tsx pins that both halves
       * stay: what the chart shows, and that equal angles are not equal
       * weights.
       */}
      <p className="text-text-faint max-w-prose text-xs leading-relaxed">
        Deze grafiek toont de score per dimensie, elk op een eigen schaal van 0 tot 10. De
        dimensies wegen niet gelijk mee in het totaal — gelijke hoeken betekenen dus geen gelijke
        weging, en het omsloten vlak is geen optelsom.
      </p>

      <div className="flex flex-col gap-6">
        {TSG_SCORE_DIMENSION_ORDER.map((dimension) => (
          <ScoreRuler
            key={dimension}
            label={TSG_SCORE_DIMENSION_COPY_NL[dimension].label}
            description={TSG_SCORE_DIMENSION_COPY_NL[dimension].description}
            score={score.dimensions[dimension]}
            ticks={SCORE_RULER_TICKS[dimension]}
          />
        ))}
      </div>
    </>
  );
}
