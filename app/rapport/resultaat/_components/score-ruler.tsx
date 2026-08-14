/**
 * One dimension's score, drawn as a 0-10 ruler (DESIGN_SPEC.md §4,
 * "TSG-score dimensies — percentagebalk (Palantir-stijl)"). Replaces the
 * plain proportional bar the score section used before.
 *
 * The ruler answers a question the bar could not: a bar shows how far along
 * the scale a score sits, but not that the model's grading changes slope on
 * the way. Tick-marks at SCORE_SPEC §2's anchor points make those changes
 * visible - and their uneven spacing (cashflow's 7.5 sitting between 6 and
 * 9) is information, not an artefact.
 *
 * Plain function component taking anchors and score as props, per §4's own
 * instruction: one component, called five times with different tick sets.
 * It knows nothing about which dimension it is drawing, so a new dimension
 * needs no change here.
 *
 * Colour follows DESIGN_SPEC.md §1's rule strictly. The ruler and its ticks
 * are grey - they are scale, not signal - and only the marker carries the
 * single accent. The signal colours are absent by design: a dimension score
 * is a magnitude, not a threshold met or missed, and §1 forbids spending
 * them anywhere else ("niet voor de score-liniaal", in as many words).
 *
 * The grey is --color-text-faint (4.8:1 on a white card), not the lighter
 * border tones. A border tone reads fine as a hairline between table rows,
 * but at 1.5:1 it cannot carry the tick-marks: they are the information
 * here - where the model's grading changes slope - so they fall under
 * §6's 3:1 floor for graphical elements rather than being decoration. The
 * marker is distinguished by weight and length instead of by a second
 * colour, which keeps the whole ruler monochrome as §4 asks.
 *
 * Geometry: the SVG uses a 0-100 user space for x (score x 10) and stretches
 * to the container width via preserveAspectRatio="none". Every stroke sets
 * vector-effect="non-scaling-stroke", so the horizontal stretch cannot
 * thicken the lines - which is also why the marker is a vertical line rather
 * than §4's alternative triangle: a triangle would shear under that stretch.
 * Ticks at 0 and 10 sit exactly on the edges, so the SVG paints outside its
 * own box (overflow-visible) rather than clipping them in half.
 */

import { SCORE_RULER_MAX, SCORE_RULER_MIN } from "../_lib/score-ruler-ticks";
import { formatScore } from "../_lib/format";

/** User-space height. Width is always 100 (score x 10), so x maps 1:1 to a percentage. */
const VIEW_HEIGHT = 16;
const BASELINE_Y = 5;
const TICK_BOTTOM_Y = 11;
const MARKER_TOP_Y = 0;
const MARKER_BOTTOM_Y = 13;

export interface ScoreRulerProps {
  /** Dimension label, top left. */
  label: string;
  /** One-line explanation of what the dimension measures, under the label. */
  description: string;
  /** The achieved score, 0-10. */
  score: number;
  /** Where this dimension's anchors fall on the 0-10 scale (SCORE_RULER_TICKS). */
  ticks: readonly number[];
}

/** Score to user-space x. Clamped so a value outside 0-10 cannot draw off the ruler. */
function xFor(score: number): number {
  const clamped = Math.max(SCORE_RULER_MIN, Math.min(SCORE_RULER_MAX, score));
  return (clamped / SCORE_RULER_MAX) * 100;
}

export function ScoreRuler({ label, description, score, ticks }: ScoreRulerProps) {
  const markerX = xFor(score);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium">{label}</span>
        <span className="tabular text-sm font-medium">{formatScore(score)}</span>
      </div>
      <p className="text-text-faint text-xs">{description}</p>

      <svg
        role="img"
        aria-label={`${label}: ${formatScore(score)} van ${SCORE_RULER_MAX}`}
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
