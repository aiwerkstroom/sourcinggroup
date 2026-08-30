/**
 * The five score dimensions as a radar (spider) chart, in the Yield &
 * Stone palette. An addition to §6.1's score section, drawn above the
 * five ScoreRulers - which stay exactly where they were. See
 * tsg-score-section.tsx for what each of the two is for.
 *
 * Plain function component, no "use client": the hover and focus
 * behaviour is CSS only (the [data-radar-point] rules in globals.css), so
 * this renders on the server, works before - and without - JavaScript,
 * and adds nothing to the client bundle. It imports nothing from
 * lib/rules/es; the caller passes already-resolved labels and scores.
 *
 * === Two variants, one component ===
 *
 * `variant="interactive"` is the screen version: axis labels always
 * visible (a radar without them is unreadable), the exact score revealed
 * on hover or keyboard focus of a point.
 *
 * `variant="static"` is the print version: every score permanently
 * printed beside its axis point. The PDF is rendered by a headless
 * browser, where hover does not exist and focus is never given - so the
 * screen version would print five unlabelled dots. This is an explicit
 * variant rather than a media query inside one drawing, because "which
 * information is on the page" is a different decision from "how wide is
 * the page", and only the caller knows which output it is building.
 *
 * === Accessibility ===
 *
 * The chart is not the only carrier of its own data, and that holds in
 * three independent ways: each point is focusable and carries its own
 * aria-label ("Cashflow: 1,5 van 10"), the static variant prints the
 * numbers, and the section this sits in still renders all five
 * ScoreRulers underneath with their labels and values as text.
 *
 * The SVG is deliberately NOT role="img" and NOT aria-hidden. Both would
 * be wrong here: role="img" is a leaf role, so it would hide the very
 * points that carry the values, and aria-hidden on a subtree containing
 * focusable elements is a WCAG 4.1.2 failure outright. Instead the
 * scaffolding (rings, spokes, the filled area) is aria-hidden as the
 * decoration it is, and only the five points are exposed.
 *
 * === Colour ===
 *
 * Sage fill at 25%, dark-green outline, sand grid - all from the palette
 * tokens, no literal hexes. Gold appears nowhere: it clears neither the
 * 4,5:1 text bar nor the 3:1 bar for meaningful graphics on a light
 * ground (DESIGN_SPEC.md §1's own measurement), so it cannot be a data
 * colour.
 *
 * The fill is the same colour at every score. It never shifts with the
 * value, so it carries no pass/fail meaning - the same discipline
 * ScoreRuler follows, and the reason UI_SPEC.md §1's reservation of
 * colour for thresholds is not broken by a green chart. The grid rings
 * are sand (1,5:1), which is decoration rather than information here:
 * unlike ScoreRuler's tick-marks, they are not the only way to read a
 * value, since every value is also present as text.
 */

import { formatScore } from "../_lib/format";

export interface ScoreRadarPoint {
  /** Dimension label, drawn outside its axis. */
  label: string;
  /** The achieved score, 0-10. */
  score: number;
}

export interface ScoreRadarProps {
  /** The five dimensions, in report order. Any count >= 3 draws correctly. */
  points: readonly ScoreRadarPoint[];
  /**
   * "interactive" reveals a score on hover/focus (screen); "static"
   * prints every score permanently (PDF). See the docstring.
   */
  variant: "interactive" | "static";
  /** Wrapper classes - the caller decides which variant shows when (print:hidden and friends). */
  className?: string;
}

const SCALE_MAX = 10;
/** Rings at every second whole point: a coarse scale, not a precise readout. */
const RINGS = [2, 4, 6, 8, 10] as const;

// User space. Wide enough that "Schuldbestendigheid" - the longest label,
// and unluckily on the widest axis - still fits inside the box.
const VIEW_W = 480;
const VIEW_H = 320;
const CX = 240;
const CY = 150;
const R = 100;
const LABEL_R = 124;

/** Angle of axis i, starting at the top and going clockwise. */
function angleOf(index: number, count: number): number {
  return -Math.PI / 2 + (index * 2 * Math.PI) / count;
}

function pointAt(angle: number, radius: number): { x: number; y: number } {
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

/** Radius for a score, clamped so a value outside 0-10 cannot draw off the grid. */
function radiusFor(score: number): number {
  return (Math.max(0, Math.min(SCALE_MAX, score)) / SCALE_MAX) * R;
}

function polygon(count: number, radius: number): string {
  return Array.from({ length: count }, (_, i) => {
    const p = pointAt(angleOf(i, count), radius);
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(" ");
}

/** Horizontal anchoring follows the axis direction, so labels lean away from the chart. */
function anchorFor(cos: number): "start" | "middle" | "end" {
  if (cos > 0.1) return "start";
  if (cos < -0.1) return "end";
  return "middle";
}

export function ScoreRadar({ points, variant, className }: ScoreRadarProps) {
  const count = points.length;
  const isStatic = variant === "static";

  const valuePolygon = points
    .map((p, i) => {
      const at = pointAt(angleOf(i, count), radiusFor(p.score));
      return `${at.x.toFixed(2)},${at.y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className={className}>
      {/*
       * Capped and centred rather than filling the column. Left at full
       * width the chart is ~2/3 as tall as it is wide, which on the
       * report's content width is tall enough to push the rest of the
       * score section onto its own page - measured: the PDF went from 13
       * pages to 15, with the total, the radar and the rulers each
       * landing on a different one. A chart this simple does not need
       * more room than this, and the section stays together.
       */}
      <div className="mx-auto w-full max-w-sm">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-auto w-full overflow-visible"
          data-radar={variant}
        >
          {/*
           * The scaffolding: grid, spokes and the filled shape itself. All
           * aria-hidden - it is the picture of the data, and the data
           * itself is exposed through the labelled points below.
           */}
          <g aria-hidden="true">
            {RINGS.map((ring) => (
              <polygon
                key={ring}
                data-radar-ring={ring}
                points={polygon(count, radiusFor(ring))}
                fill="none"
                stroke="var(--color-border)"
                strokeWidth={1}
              />
            ))}

            {points.map((p, i) => {
              const outer = pointAt(angleOf(i, count), R);
              return (
                <line
                  key={p.label}
                  data-radar-spoke={p.label}
                  x1={CX}
                  y1={CY}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="var(--color-border)"
                  strokeWidth={1}
                />
              );
            })}

            {/*
             * The shape itself. Sage at 25% so the grid stays readable
             * through it; the dark-green outline is what actually carries
             * the silhouette.
             */}
            <polygon
              data-radar-area=""
              points={valuePolygon}
              fill="var(--color-border-strong)"
              fillOpacity={0.25}
              stroke="var(--color-accent)"
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </g>

          {/* Axis labels, always visible in both variants - a radar without them says nothing. */}
          <g aria-hidden="true">
            {points.map((p, i) => {
              const angle = angleOf(i, count);
              const at = pointAt(angle, LABEL_R);
              const cos = Math.cos(angle);
              const sin = Math.sin(angle);
              // Nudge vertically so a label never sits on its own axis line.
              const dy = sin < -0.3 ? -2 : sin > 0.3 ? 10 : 4;
              return (
                <text
                  key={p.label}
                  data-radar-label={p.label}
                  x={at.x}
                  y={at.y + dy}
                  textAnchor={anchorFor(cos)}
                  className="fill-text-muted text-[12px]"
                >
                  {p.label}
                  {isStatic ? (
                    <tspan
                      data-radar-value={p.label}
                      x={at.x}
                      dy={15}
                      className="fill-text text-[12px] font-semibold"
                    >
                      {formatScore(p.score)}
                    </tspan>
                  ) : null}
                </text>
              );
            })}
          </g>

          {/*
           * The points. These are the accessible layer: focusable, each
           * with its own label, so the values are reachable by keyboard and
           * by screen reader without a mouse ever being involved.
           */}
          {points.map((p, i) => {
            const angle = angleOf(i, count);
            const at = pointAt(angle, radiusFor(p.score));
            const reading = `${p.label}: ${formatScore(p.score)} van ${SCALE_MAX}`;
            const tipWidth = reading.length * 6.1 + 14;
            return (
              <g
                key={p.label}
                data-radar-point={p.label}
                data-score={p.score}
                role="img"
                aria-label={reading}
                tabIndex={isStatic ? undefined : 0}
              >
                {/*
                 * An invisible, generous hit area. The visible dot is 4
                 * units across, far under the 44px target DESIGN_SPEC.md
                 * §6 asks for, so the thing you actually point at is this.
                 */}
                <circle cx={at.x} cy={at.y} r={16} fill="transparent" />
                <circle data-radar-focus-ring="" cx={at.x} cy={at.y} r={9} fill="none" />
                <circle cx={at.x} cy={at.y} r={4} fill="var(--color-accent)" />

                {/*
                 * The hover/focus readout. Rendered only for the
                 * interactive variant - in print the value is already
                 * beside the axis label, and a second copy would be noise.
                 */}
                {isStatic ? null : (
                  <g data-radar-tip="">
                    <rect
                      x={at.x - tipWidth / 2}
                      y={at.y - 34}
                      width={tipWidth}
                      height={22}
                      rx={4}
                      fill="var(--color-accent)"
                    />
                    <text
                      x={at.x}
                      y={at.y - 19}
                      textAnchor="middle"
                      className="fill-surface text-[12px] font-medium"
                    >
                      {reading}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
