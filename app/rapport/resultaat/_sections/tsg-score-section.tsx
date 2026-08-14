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
 * Five independent rulers, not a radar chart or a stacked total: interview
 * round 2 ruled those out specifically because they can be misread as
 * summing to the total the way a radar's enclosed area or a stacked bar
 * would - the five weights that produce the total are exactly what
 * UI_SPEC.md §5 says stays unpublished. Each ruler is independent, on its
 * own 0–10 scale.
 *
 * The ruler itself (tick-marks at SCORE_SPEC §2's anchors, single accent
 * marker) lives in ScoreRuler - DESIGN_SPEC.md §4 asked for one component
 * called five times, so the dimension loop below stays a loop and the
 * drawing stays in one place.
 *
 * Colour stays neutral. UI_SPEC.md §1 reserves colour for a pass/fail
 * signal (a threshold met or not); a dimension's magnitude is not a
 * threshold, so every ruler is drawn identically regardless of value - a
 * low score is not painted red.
 */

import { TSG_SCORE_DIMENSION_COPY_NL, TSG_SCORE_DIMENSION_ORDER } from "@/lib/copy/es/score";
import type { TsgScore } from "@/lib/rules/es/types";
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
        1. TSG-score
      </h2>

      {score === null ? (
        <p className="text-text-muted max-w-prose text-sm leading-relaxed">
          Voor dit scenario bestaat geen rendementscijfer: geen enkele rentevoet brengt de
          kasstroomreeks op nul. Dat is geen zwakke uitkomst maar het ontbreken van een antwoord op
          de rendementsvraag, dus geeft dit rapport hier geen score — niet een verzonnen lage.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-4">
            <span className="tabular text-5xl font-semibold">{formatScore(score.total)}</span>
            {percentile !== null ? (
              <span className="text-text-muted text-sm">
                percentiel {percentile} van ons modelbereik
              </span>
            ) : null}
          </div>

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
      )}
    </section>
  );
}
