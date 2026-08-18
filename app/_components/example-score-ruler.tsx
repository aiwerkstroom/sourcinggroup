/**
 * A local, fictional-only copy of the report's ScoreRuler visual form
 * (DESIGN_SPEC.md §4: "TSG-score dimensies — percentagebalk
 * (Palantir-stijl)"), used only by the landing page's example section
 * (LANDING_SPEC.md §5).
 *
 * Deliberately not a re-export of, or import from,
 * app/rapport/resultaat/_components/score-ruler.tsx: that component
 * imports SCORE_RULER_MIN/MAX from _lib/score-ruler-ticks.ts, the same
 * module that also holds SCORE_RULER_TICKS - the report's real
 * per-dimension anchor points. LANDING_SPEC.md §5 is explicit that this
 * section may not import or touch real anchor points ("geen echte
 * ankerpunten... importeren of raken"), so this file keeps its own
 * trivial 0-10 scale as local constants and has zero import from
 * lib/rules/es or any app/rapport-internal module. Same SVG geometry as
 * the real ruler - ticks, baseline, a single accent marker - so the
 * illustration reads as the same kind of visual a paying customer later
 * sees; only the numbers a caller supplies are fictional.
 */

const VIEW_HEIGHT = 16;
const BASELINE_Y = 5;
const TICK_BOTTOM_Y = 11;
const MARKER_TOP_Y = 0;
const MARKER_BOTTOM_Y = 13;
const SCALE_MIN = 0;
const SCALE_MAX = 10;

export interface ExampleScoreRulerProps {
  /** Dimension label, top left. */
  label: string;
  /** One-line explanation of what the dimension measures, under the label. */
  description: string;
  /** A fictional score, 0-10 - never a real computed value. */
  score: number;
  /** Fictional tick positions - never SCORE_RULER_TICKS' real anchors. */
  ticks: readonly number[];
}

function xFor(value: number): number {
  const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, value));
  return (clamped / SCALE_MAX) * 100;
}

function formatFictionalScore(score: number): string {
  return score.toFixed(1).replace(".", ",");
}

export function ExampleScoreRuler({ label, description, score, ticks }: ExampleScoreRulerProps) {
  const markerX = xFor(score);
  const scoreLabel = formatFictionalScore(score);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="tabular text-sm font-medium">{scoreLabel}</span>
      </div>
      <p className="text-text-faint text-xs">{description}</p>

      <svg
        role="img"
        aria-label={`${label}: ${scoreLabel} van ${SCALE_MAX} - fictief voorbeeld`}
        viewBox={`0 0 100 ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-4 w-full overflow-visible"
      >
        <line
          x1={0}
          y1={BASELINE_Y}
          x2={100}
          y2={BASELINE_Y}
          stroke="var(--color-text-faint)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />

        {ticks.map((tick) => (
          <line
            key={tick}
            data-tick={tick}
            x1={xFor(tick)}
            y1={BASELINE_Y}
            x2={xFor(tick)}
            y2={TICK_BOTTOM_Y}
            stroke="var(--color-text-faint)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <line
          data-marker="score"
          data-score={score}
          x1={markerX}
          y1={MARKER_TOP_Y}
          x2={markerX}
          y2={MARKER_BOTTOM_Y}
          stroke="var(--color-accent)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
