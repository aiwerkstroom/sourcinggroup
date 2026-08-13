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
 * Bars, not a radar chart or a stacked total: interview round 2 chose
 * horizontal bars specifically because they cannot be misread as summing
 * to the total the way a radar's enclosed area or a stacked bar would -
 * the five weights that produce the total are exactly what UI_SPEC.md §5
 * says stays unpublished. Each bar is independent, on its own 0–10 scale.
 *
 * Colour stays neutral. UI_SPEC.md §1 reserves colour for a pass/fail
 * signal (a threshold met or not); a dimension's magnitude is not a
 * threshold, so every bar uses the same foreground tone regardless of
 * value - a low score is not painted red.
 */

import { TSG_SCORE_DIMENSION_COPY_NL, TSG_SCORE_DIMENSION_ORDER } from "@/lib/copy/es/score";
import type { TsgScore } from "@/lib/rules/es/types";
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

function DimensionBar({ dimension, value }: { dimension: keyof TsgScore["dimensions"]; value: number }) {
  const copy = TSG_SCORE_DIMENSION_COPY_NL[dimension];
  // Scores are already clamped to 0-10 by piecewiseLinear (score.ts), but
  // the bar width computation clamps again so a future change to that
  // guarantee cannot silently draw a bar past the track's edges.
  const widthPercent = Math.max(0, Math.min(10, value)) * 10;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium">{copy.label}</span>
        <span className="tabular text-sm">{formatScore(value)}</span>
      </div>
      <p className="text-text-faint text-xs">{copy.description}</p>
      <div
        role="img"
        aria-label={`${copy.label}: ${formatScore(value)} van 10`}
        className="bg-surface border-border h-2 overflow-hidden rounded-full border"
      >
        <div className="bg-text h-full rounded-full" style={{ width: `${widthPercent}%` }} />
      </div>
    </div>
  );
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

          <div className="flex flex-col gap-5">
            {TSG_SCORE_DIMENSION_ORDER.map((dimension) => (
              <DimensionBar key={dimension} dimension={dimension} value={score.dimensions[dimension]} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
