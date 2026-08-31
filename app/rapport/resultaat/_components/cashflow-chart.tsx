/**
 * The monthly cashflow per year, as three stacked small-multiple area
 * charts - one per scenario, on one shared y-scale. Replaces
 * CashflowTrendChart (three overlaid lines) in §6.5's section, and sits
 * ABOVE the ten-year table, which stays exactly as it was.
 *
 * === Why three panels and not three lines ===
 *
 * The thing this chart exists to show is where cashflow crosses from
 * negative to positive, and the reference case makes the case for
 * separating the scenarios: conservative never crosses in ten years,
 * base crosses only in year 10 and only by EUR 39 a month, optimistic
 * crosses in year 2. That contrast is the story. Three overlaid lines
 * cannot tell it and cannot be tinted by sign at the same time - the
 * fills would sit on top of each other.
 *
 * The scale is shared across all three panels deliberately: panels with
 * their own scales would make three very different outcomes look alike.
 *
 * === Colour ===
 *
 * Sign, not scenario. Below zero is sage at 25%, above zero is the dark
 * green accent at 40% - measured 18 L* points apart, so the two read as
 * clearly different tints rather than as one colour at two strengths.
 * Faint below the line, solid above it, which matches how the two states
 * feel. No gold: it clears neither the 4,5:1 text bar nor the 3:1 bar
 * for meaningful graphics on a light ground.
 *
 * Signal colours are deliberately NOT used, even though "cashflow turned
 * positive" is arguably a threshold. The old chart spent them on the
 * three scenarios; this one spends nothing, keeping UI_SPEC.md §1's
 * reservation intact and leaving section 7's badges the only place in
 * the report where a colour means pass or fail.
 *
 * === The extrapolation boundary is IN the chart, on purpose ===
 *
 * Years 6-10 are extrapolated (indexation.ts's own flag, carried through
 * to ScenarioOutcome.years). That is not a footnote detail here: in the
 * reference case the base scenario's crossover - the single most
 * important moment this chart shows - happens in year 10, which is
 * extrapolated. A reader who took that crossing for measured data would
 * be reading more into it than the model supports. So each panel draws
 * the boundary after year 5 and dashes the outline beyond it, and the
 * caption says what that means. The table below keeps its own year-5
 * underline and its `e` markers unchanged; this is the same fact drawn
 * rather than a second, competing rule.
 *
 * === Two variants, one component ===
 *
 * The same split as ScoreRadar, for the same reason: `interactive`
 * reveals a year's exact amount on hover or keyboard focus;`static`
 * prints every amount permanently, because the PDF is rendered by a
 * headless browser that never hovers and never focuses.
 *
 * Plain function component, no "use client" - hover and focus are the
 * CSS in globals.css, so this stays server-rendered and costs the client
 * bundle nothing. It imports nothing from lib/rules/es.
 */

import { formatEuro } from "../_lib/format";

export interface CashflowChartYear {
  yearNumber: number;
  /** Monthly cashflow after tax, in euro. Negative below the line. */
  monthlyCashflow: number;
  /** True for years past the sourced Correction Factors series. */
  extrapolated: boolean;
}

export interface CashflowChartPanel {
  /** Scenario label, drawn as the panel's title. */
  label: string;
  years: readonly CashflowChartYear[];
}

export interface CashflowChartProps {
  /** One panel per scenario, in report order. */
  panels: readonly CashflowChartPanel[];
  variant: "interactive" | "static";
  className?: string;
}

const VIEW_W = 640;
const MARGIN = { top: 8, right: 16, bottom: 26, left: 68 };
const PANEL_TITLE_H = 16;
const PLOT_H = 92;
const PANEL_GAP = 12;
const PLOT_W = VIEW_W - MARGIN.left - MARGIN.right;

/** Fill opacities, chosen by measurement - see the docstring. */
const NEGATIVE_OPACITY = 0.25;
const POSITIVE_OPACITY = 0.4;

function panelTop(index: number): number {
  return MARGIN.top + index * (PANEL_TITLE_H + PLOT_H + PANEL_GAP);
}
function plotTop(index: number): number {
  return panelTop(index) + PANEL_TITLE_H;
}

function viewHeight(panelCount: number): number {
  return plotTop(panelCount - 1) + PLOT_H + MARGIN.bottom;
}

interface Scale {
  min: number;
  max: number;
}

/** One point in plot space, carrying its value so a crossing can be interpolated. */
interface PlotPoint {
  x: number;
  value: number;
}

/**
 * Splits a series into runs of one sign, inserting the exact zero
 * crossing where it changes. That is what lets each run be filled as its
 * own polygon without a clipPath - and a clipPath would need a unique id
 * per instance, which would make this a client component for no reason.
 */
function splitBySign(points: readonly PlotPoint[]): Array<{ positive: boolean; run: PlotPoint[] }> {
  const runs: Array<{ positive: boolean; run: PlotPoint[] }> = [];
  let current: PlotPoint[] = [];
  let positive = false;

  const flush = () => {
    if (current.length > 1) runs.push({ positive, run: current });
  };

  points.forEach((point, i) => {
    if (i === 0) {
      current = [point];
      positive = point.value >= 0;
      return;
    }
    const previous = points[i - 1]!;
    const crossed =
      (previous.value < 0 && point.value > 0) || (previous.value > 0 && point.value < 0);

    if (crossed) {
      const t = Math.abs(previous.value) / (Math.abs(previous.value) + Math.abs(point.value));
      const crossing: PlotPoint = { x: previous.x + (point.x - previous.x) * t, value: 0 };
      current.push(crossing);
      flush();
      current = [crossing, point];
      positive = point.value > 0;
    } else {
      current.push(point);
    }
  });

  flush();
  return runs;
}

export function CashflowChart({ panels, variant, className }: CashflowChartProps) {
  const isStatic = variant === "static";
  const viewH = viewHeight(panels.length);

  // One scale over every panel: separate scales would flatten the very
  // differences this chart is drawn to show.
  const allValues = panels.flatMap((p) => p.years.map((y) => y.monthlyCashflow));
  const rawMin = Math.min(...allValues, 0);
  const rawMax = Math.max(...allValues, 0);
  const headroom = (rawMax - rawMin) * 0.12 || 1;
  const scale: Scale = { min: rawMin - headroom, max: rawMax + headroom };

  const years = panels[0]?.years.map((y) => y.yearNumber) ?? [];
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  const xFor = (yearNumber: number): number =>
    maxYear === minYear
      ? MARGIN.left + PLOT_W / 2
      : MARGIN.left + ((yearNumber - minYear) / (maxYear - minYear)) * PLOT_W;

  const yFor = (value: number, index: number): number =>
    plotTop(index) + (1 - (value - scale.min) / (scale.max - scale.min)) * PLOT_H;

  // The boundary between sourced and extrapolated years, drawn between
  // the last sourced year and the first extrapolated one.
  const firstExtrapolated = panels[0]?.years.find((y) => y.extrapolated)?.yearNumber ?? null;
  const boundaryX =
    firstExtrapolated === null ? null : (xFor(firstExtrapolated - 1) + xFor(firstExtrapolated)) / 2;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${viewH}`}
        className="h-auto w-full overflow-visible"
        data-cashflow-chart={variant}
      >
        {panels.map((panel, index) => {
          const zeroY = yFor(0, index);
          const points: PlotPoint[] = panel.years.map((y) => ({
            x: xFor(y.yearNumber),
            value: y.monthlyCashflow,
          }));
          const sourced = panel.years.filter((y) => !y.extrapolated);
          const extrapolated = panel.years.filter((y) => y.extrapolated);
          const lineOf = (ys: readonly CashflowChartYear[]) =>
            ys
              .map((y) => `${xFor(y.yearNumber).toFixed(1)},${yFor(y.monthlyCashflow, index).toFixed(1)}`)
              .join(" ");
          // The dashed part starts at the last sourced year, so the two
          // halves of the line join rather than leaving a gap.
          const extrapolatedLine =
            extrapolated.length > 0 && sourced.length > 0
              ? lineOf([sourced[sourced.length - 1]!, ...extrapolated])
              : lineOf(extrapolated);

          return (
            <g key={panel.label} data-cashflow-panel={panel.label}>
              <text
                x={MARGIN.left}
                y={panelTop(index) + 11}
                className="fill-text text-[11px] font-medium"
              >
                {panel.label}
              </text>

              <g aria-hidden="true">
                {/* The filled area, split at every zero crossing so each run carries its own tint. */}
                {splitBySign(points).map((segment, s) => {
                  const top = segment.run
                    .map((p) => `${p.x.toFixed(1)},${yFor(p.value, index).toFixed(1)}`)
                    .join(" ");
                  const first = segment.run[0]!;
                  const last = segment.run[segment.run.length - 1]!;
                  const base = `${last.x.toFixed(1)},${zeroY.toFixed(1)} ${first.x.toFixed(1)},${zeroY.toFixed(1)}`;
                  return (
                    <polygon
                      key={`${panel.label}-fill-${s}`}
                      data-cashflow-fill={segment.positive ? "positive" : "negative"}
                      points={`${top} ${base}`}
                      fill={
                        segment.positive ? "var(--color-accent)" : "var(--color-border-strong)"
                      }
                      fillOpacity={segment.positive ? POSITIVE_OPACITY : NEGATIVE_OPACITY}
                    />
                  );
                })}

                {/* The zero line: the reference everything on this chart is read against. */}
                <line
                  data-cashflow-zero=""
                  x1={MARGIN.left}
                  y1={zeroY}
                  x2={VIEW_W - MARGIN.right}
                  y2={zeroY}
                  stroke="var(--color-text-faint)"
                  strokeWidth={1}
                />
                <text
                  x={MARGIN.left - 8}
                  y={zeroY + 3}
                  textAnchor="end"
                  className="fill-text-faint text-[9px]"
                >
                  € 0
                </text>

                {/* Sourced years solid, extrapolated years dashed. */}
                <polyline
                  points={lineOf(sourced)}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth={1.75}
                  strokeLinejoin="round"
                />
                {extrapolated.length > 0 ? (
                  <polyline
                    data-cashflow-extrapolated=""
                    points={extrapolatedLine}
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth={1.75}
                    strokeDasharray="4 3"
                    strokeLinejoin="round"
                  />
                ) : null}

                {boundaryX !== null ? (
                  <line
                    data-cashflow-boundary=""
                    x1={boundaryX}
                    y1={plotTop(index)}
                    x2={boundaryX}
                    y2={plotTop(index) + PLOT_H}
                    stroke="var(--color-border-strong)"
                    strokeWidth={1}
                    strokeDasharray="2 3"
                  />
                ) : null}

                {/* Scale ends, on the first panel only - the scale is shared, so repeating them would only add noise. */}
                {index === 0 ? (
                  <>
                    <text
                      x={MARGIN.left - 8}
                      y={yFor(scale.max, 0) + 8}
                      textAnchor="end"
                      className="fill-text-faint text-[9px]"
                    >
                      {formatEuro(Math.round(scale.max))}
                    </text>
                    <text
                      x={MARGIN.left - 8}
                      y={yFor(scale.min, 0) - 2}
                      textAnchor="end"
                      className="fill-text-faint text-[9px]"
                    >
                      {formatEuro(Math.round(scale.min))}
                    </text>
                  </>
                ) : null}
              </g>

              {/*
               * The data points: focusable, each labelled, so every
               * amount is reachable by keyboard and by screen reader.
               */}
              {panel.years.map((year) => {
                const cx = xFor(year.yearNumber);
                const cy = yFor(year.monthlyCashflow, index);
                const amount = formatEuro(Math.round(year.monthlyCashflow));
                const reading = `${panel.label}, jaar ${year.yearNumber}: ${amount} per maand${
                  year.extrapolated ? ", geëxtrapoleerd" : ""
                }`;
                const tipWidth = reading.length * 5.3 + 12;
                // Keep the readout inside the box at both ends.
                const tipX = Math.min(
                  Math.max(cx, MARGIN.left + tipWidth / 2),
                  VIEW_W - MARGIN.right - tipWidth / 2,
                );
                return (
                  <g
                    key={year.yearNumber}
                    data-cashflow-point={`${panel.label}-${year.yearNumber}`}
                    data-year={year.yearNumber}
                    data-value={year.monthlyCashflow}
                    role="img"
                    aria-label={reading}
                    tabIndex={isStatic ? undefined : 0}
                  >
                    <circle cx={cx} cy={cy} r={13} fill="transparent" />
                    <circle data-cashflow-focus-ring="" cx={cx} cy={cy} r={7} fill="none" />
                    <circle cx={cx} cy={cy} r={2.5} fill="var(--color-accent)" />

                    {isStatic ? (
                      <text
                        data-cashflow-value={`${panel.label}-${year.yearNumber}`}
                        x={cx}
                        y={cy - 7}
                        textAnchor="middle"
                        className="fill-text text-[8px] font-medium"
                      >
                        {amount}
                      </text>
                    ) : (
                      <g data-cashflow-tip="">
                        <rect
                          x={tipX - tipWidth / 2}
                          y={cy - 27}
                          width={tipWidth}
                          height={18}
                          rx={3}
                          fill="var(--color-accent)"
                        />
                        <text
                          x={tipX}
                          y={cy - 14}
                          textAnchor="middle"
                          className="fill-surface text-[9px] font-medium"
                        >
                          {reading}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Year axis, once, under the last panel. */}
        <g aria-hidden="true">
          {years.map((yearNumber) => (
            <text
              key={yearNumber}
              x={xFor(yearNumber)}
              y={viewH - MARGIN.bottom + 14}
              textAnchor="middle"
              className="fill-text-faint text-[9px]"
            >
              {yearNumber}
            </text>
          ))}
          <text
            x={VIEW_W - MARGIN.right}
            y={viewH - MARGIN.bottom + 26}
            textAnchor="end"
            className="fill-text-faint text-[9px]"
          >
            jaar
          </text>
        </g>
      </svg>
    </div>
  );
}
