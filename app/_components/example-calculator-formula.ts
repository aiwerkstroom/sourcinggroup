/**
 * The landing page's fictional demonstration formula
 * (HOMEPAGE_UPGRADE_SPEC.md §4.2), approved by Samuel on 18 August 2026.
 *
 * THIS IS NOT THE MODEL. It exists to let a visitor feel the shape of a
 * calculation, not to approximate one. Every number below is invented for
 * this page.
 *
 * === Why this module imports nothing ===
 *
 * §4.2 is unambiguous: no runEngine(), no TSG_SCORE_DIMENSION_WEIGHTS, no
 * real anchor points. The surest way to satisfy that is to reach for
 * nothing at all, so this file has zero import statements - the same rule
 * example-score-ruler.tsx already follows, and
 * app/__tests__/page.test.tsx enforces it structurally.
 *
 * That matters more here than it did for the static example. This module
 * is client-bundled: the visitor's browser receives these anchors in
 * full. That is fine precisely because they are fictional, and it is why
 * the separation has to be airtight rather than merely intended - the
 * real curve reaching this file would be the real curve shipped to
 * everyone.
 *
 * === How it stays demonstrably different from the real curve ===
 *
 * Same *form* as SCORE_SPEC §2 (piecewise linear between anchors), which
 * §4.2 explicitly allows, with deliberately different numbers. Three
 * properties are pinned by __tests__/example-calculator-formula.test.ts,
 * which runs in Node and therefore may import the real parameters to
 * compare against:
 *
 *  1. No (input, score) pair here equals a real one.
 *  2. The signature values differ - the places where the real curve is
 *     recognisable. Real break-even cashflow scores 4,0; here it is 4,5.
 *     Real DSCR 1,00 scores 5,0; here 4,75. Real "requirement exactly
 *     met" scores 5,0; here 5,5.
 *  3. The endpoints differ: the real dimensions span 0,0-10,0, these span
 *     1,0-9,5. A demonstration that cannot reach either extreme reads as
 *     an illustration, and can never reproduce the real endpoints.
 *
 * === Why the total is an unweighted mean ===
 *
 * Not laziness - protection. UI_SPEC.md §5 keeps the real per-dimension
 * weights unpublished, and an arithmetic mean cannot leak them by
 * construction. Weighting this illustration "realistically" is the one
 * change that would turn it into a hint about the real model.
 */

/** One point on a piecewise-linear curve: an input value and the score it maps to. */
export interface ExampleAnchor {
  input: number;
  score: number;
}

export interface ExampleWijkType {
  /**
   * A category, never a place name. Inventing Spanish-sounding names
   * risked accidentally naming a real Valencia neighbourhood, which would
   * imply this illustration carries real area data. A Dutch category word
   * cannot be mistaken for one - and the formula test checks these
   * against the real thirteen anyway.
   */
  name: string;
  /** Fixed running costs as a fraction of rent. The wijk moves the cost side, never the rent the visitor typed. */
  costFraction: number;
}

export const EXAMPLE_WIJK_TYPES: readonly ExampleWijkType[] = [
  { name: "Woonwijk", costFraction: 0.25 },
  { name: "Kustzone", costFraction: 0.28 },
  { name: "Stadscentrum", costFraction: 0.3 },
];

/**
 * Monthly financing cost as a fraction of the price: 70% loan-to-value at
 * a flat 0,45% per month. Flat on purpose - a real annuity would be both
 * closer to the real model and harder for a visitor to follow, and
 * neither is what this is for.
 */
export const EXAMPLE_MONTHLY_DEBT_RATE = 0.00315;

/**
 * The fictional return requirement the "Rendement" dimension scores
 * against, in percentage points of gross yield. Deliberately not a fourth
 * input field: three fields is already the top of what §4.1 asks for, and
 * a fourth turns an illustration into a form.
 */
export const EXAMPLE_REQUIRED_YIELD_PERCENT = 5;

/** Neither depends on price, rent or wijk, so both are constants rather than invented relationships. */
export const EXAMPLE_FIXED_FEASIBILITY = 8;
export const EXAMPLE_FIXED_DATA_CERTAINTY = 6.5;

export const EXAMPLE_CASHFLOW_ANCHORS: readonly ExampleAnchor[] = [
  { input: -400, score: 1 },
  { input: -150, score: 3 },
  { input: 100, score: 5.5 },
  { input: 400, score: 7.5 },
  { input: 800, score: 9.5 },
];

export const EXAMPLE_DSCR_ANCHORS: readonly ExampleAnchor[] = [
  { input: 0.6, score: 1 },
  { input: 0.9, score: 3.5 },
  { input: 1.1, score: 6 },
  { input: 1.35, score: 8 },
  { input: 1.7, score: 9.5 },
];

/** Input is gross yield minus EXAMPLE_REQUIRED_YIELD_PERCENT, in percentage points. */
export const EXAMPLE_RETURN_ANCHORS: readonly ExampleAnchor[] = [
  { input: -2.5, score: 1 },
  { input: -1, score: 3.5 },
  { input: 0, score: 5.5 },
  { input: 1.5, score: 7.5 },
  { input: 3.5, score: 9.5 },
];

/** An evenly spaced quarter-scale, matching none of the five real anchor sets. */
export const EXAMPLE_TICKS: readonly number[] = [0, 2.5, 5, 7.5, 10];

export const EXAMPLE_PRICE_RANGE = { min: 150_000, max: 600_000, step: 5_000 };
export const EXAMPLE_RENT_RANGE = { min: 500, max: 2_500, step: 50 };

export const EXAMPLE_DEFAULTS = {
  priceEUR: 300_000,
  rentPerMonthEUR: 1_400,
  wijk: "Woonwijk",
};

export interface ExampleDimension {
  label: string;
  description: string;
  score: number;
}

export interface ExampleOutcome {
  monthlyCashflowEUR: number;
  grossYieldPercent: number;
  dscr: number;
  dimensions: readonly ExampleDimension[];
  totalScore: number;
}

/**
 * Piecewise-linear interpolation, the same shape SCORE_SPEC §2 describes.
 * Below the first anchor and above the last, the curve is flat - which is
 * what keeps this illustration inside 1,0-9,5 no matter what is typed.
 */
function interpolate(anchors: readonly ExampleAnchor[], value: number): number {
  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;
  if (value <= first.input) return first.score;
  if (value >= last.input) return last.score;

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const low = anchors[i]!;
    const high = anchors[i + 1]!;
    if (value >= low.input && value <= high.input) {
      const t = (value - low.input) / (high.input - low.input);
      return low.score + t * (high.score - low.score);
    }
  }
  return last.score;
}

/** One decimal, the precision the rulers display. */
function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function findWijkType(name: string): ExampleWijkType {
  return EXAMPLE_WIJK_TYPES.find((wijk) => wijk.name === name) ?? EXAMPLE_WIJK_TYPES[0]!;
}

/**
 * The whole demonstration, in two steps.
 *
 * Dimension scores are rounded before the total is averaged from them, so
 * the five numbers on screen actually add up to the total on screen. An
 * illustration whose own figures do not reconcile would undercut the one
 * thing this page is trying to demonstrate.
 */
export function computeExampleOutcome(
  priceEUR: number,
  rentPerMonthEUR: number,
  wijkName: string,
): ExampleOutcome {
  const wijk = findWijkType(wijkName);

  // Step A - the fictional monthly cashflow.
  const monthlyDebt = EXAMPLE_MONTHLY_DEBT_RATE * priceEUR;
  const runningCosts = wijk.costFraction * rentPerMonthEUR;
  const monthlyCashflowEUR = rentPerMonthEUR - runningCosts - monthlyDebt;

  const grossYieldPercent = ((rentPerMonthEUR * 12) / priceEUR) * 100;
  const dscr = monthlyDebt === 0 ? 0 : rentPerMonthEUR / monthlyDebt;

  // Step B - five dimensions, three of which respond to the inputs.
  const dimensions: ExampleDimension[] = [
    {
      label: "Cashflow",
      description: "Blijft er maandelijks geld over na alle kosten?",
      score: roundToOneDecimal(interpolate(EXAMPLE_CASHFLOW_ANCHORS, monthlyCashflowEUR)),
    },
    {
      label: "Schuldbestendigheid",
      description: "Houdt de financiering stand bij tegenvallers?",
      score: roundToOneDecimal(interpolate(EXAMPLE_DSCR_ANCHORS, dscr)),
    },
    {
      label: "Rendement",
      description: "Weegt het rendement op tegen het risico?",
      score: roundToOneDecimal(
        interpolate(EXAMPLE_RETURN_ANCHORS, grossYieldPercent - EXAMPLE_REQUIRED_YIELD_PERCENT),
      ),
    },
    {
      label: "Haalbaarheid",
      description: "Deze demonstratie vraagt geen budget, dus dit cijfer staat vast.",
      score: EXAMPLE_FIXED_FEASIBILITY,
    },
    {
      label: "Datazekerheid",
      description: "Deze demonstratie gebruikt geen echte brondata, dus dit cijfer staat vast.",
      score: EXAMPLE_FIXED_DATA_CERTAINTY,
    },
  ];

  const totalScore = roundToOneDecimal(
    dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length,
  );

  return { monthlyCashflowEUR, grossYieldPercent, dscr, dimensions, totalScore };
}
