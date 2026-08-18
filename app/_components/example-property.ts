/**
 * The landing page's fictional example (LANDING_SPEC.md §5), kept in its
 * own module so the golden test can import these values and assert
 * directly on them - that they collide with no real mock listing and no
 * real anchor set - rather than re-stating them as literals in the test.
 *
 * Every value here is invented for this page. This module deliberately
 * has no imports at all: §5 forbids the example from importing or
 * touching TSG_SCORE_DIMENSION_WEIGHTS, real anchor points, or real
 * Parameter objects, and the surest way to satisfy that is to reach for
 * nothing. app/__tests__/page.test.tsx enforces the emptiness of this
 * file's import list, so a future edit cannot quietly add one.
 *
 * Two of these values were corrected after the first draft, both caught
 * by the checks in that test rather than by eye:
 *
 * - The price/area pair was €245.000 at 85 m², which is exactly
 *   source-mock.ts's mock-003 (an appartement at that price and built
 *   area). §5 asks for "geen bestaande mock-listing hergebruikt", so it
 *   moved to a price and area no listing uses.
 * - EXAMPLE_TICKS was [0, 2, 4, 6, 8, 10], which is exactly
 *   SCORE_RULER_TICKS.dataCertainty - a real anchor set, the one thing
 *   §5 names outright. It is now a plain quarter-scale, matching none of
 *   the five real sets.
 *
 * The five dimension labels do mirror the real report's vocabulary. That
 * is intentional and permitted: UI_SPEC.md §5 withholds the per-dimension
 * weights, not the dimension names, which every paying customer already
 * sees. Reusing the names is what makes the illustration recognisable as
 * the same kind of score; the descriptions are written fresh here rather
 * than imported from lib/copy/es/score.ts, again so this module reaches
 * for nothing.
 */

/**
 * A neutral quarter-scale placeholder, not a real anchor set. The real
 * rulers' ticks are unevenly spaced because the model's grading changes
 * slope; an evenly spaced scale is visibly a stand-in.
 */
export const EXAMPLE_TICKS = [0, 2.5, 5, 7.5, 10];

export const EXAMPLE_PROPERTY = {
  priceEUR: 268500,
  builtAreaM2: 92,
  description: "Appartement in Valencia · 92 m² · € 268.500",
  totalScore: 7.3,
  percentile: 64,
  outcome:
    "Een positieve maandcashflow en een dekkingsgraad boven 1,0, samen met een rendement dat de eis haalt.",
};

export const EXAMPLE_DIMENSIONS = [
  {
    label: "Cashflow",
    description: "Blijft er maandelijks geld over na alle kosten?",
    score: 6.8,
  },
  {
    label: "Schuldbestendigheid",
    description: "Houdt de financiering stand bij tegenvallers?",
    score: 7.1,
  },
  {
    label: "Rendement",
    description: "Weegt het rendement op tegen het risico?",
    score: 7.6,
  },
  {
    label: "Haalbaarheid",
    description: "Is deze financiering haalbaar zoals ingevuld?",
    score: 8.0,
  },
  {
    label: "Datazekerheid",
    description: "Hoe stevig staan de gebruikte cijfers?",
    score: 6.9,
  },
];
