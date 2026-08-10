/**
 * IRR on equity, per scenario (MODEL_SPEC_FASE1B §6):
 *
 *   jaar 0   : -(eigen inbreng + renovatie)
 *   jaar 1..n: netto cashflow na belasting
 *   jaar n   : + netto verkoopopbrengst
 *
 * "Eigen inbreng + renovatie" is exactly AcquisitionCosts.equityRequired:
 * that figure already sums the investor's cash outlay beyond the mortgage,
 * renovation costs included (Excel-verified, MODEL_SPEC.md §11 D153).
 * Splitting it into two terms here would either double-count or require a
 * second computation of a value the engine already produces once.
 *
 * No spreadsheet IRR function is reimplemented; NPV is solved by
 * bisection, chosen over Newton-Raphson because it needs no derivative and
 * cannot diverge once a valid bracket is found - the point of a self-serve
 * tool is not producing a number when the underlying investment doesn't
 * support one, and bisection makes that failure mode explicit rather than
 * a Newton step silently wandering off.
 *
 * A negative rate is a real, informative answer - "the investment lost
 * value in real terms" is a different (and more useful) statement than
 * "no solution". A cashflow series with exactly one sign change (the
 * usual shape here: an equity outflow, then a stream that turns positive
 * once the sale proceeds land) is "conventional": NPV(rate) is strictly
 * monotonic on (-1, infinity), so a root always exists somewhere in that
 * range, whether positive, zero, or negative. The search therefore covers
 * negative rates down to -99% (rate = -1 is a singularity: NPV blows up),
 * not just rate >= 0.
 *
 * `{ defined: false, ... }` is reserved for the case that actually has no
 * root: a cashflow series that never changes sign (all outflows, or all
 * inflows). No discount rate, positive or negative, can zero the NPV of a
 * series where every term has the same sign.
 */

import type { EngineResult, ExitResult, IrrResult, ProjectionYear } from "./types";

const MAX_BISECTION_ITERATIONS = 100;
const NPV_TOLERANCE = 1e-6;
const MIN_SEARCH_RATE = -0.99; // rate -1 is a singularity (division by zero); -99% is the practical floor.
const MAX_SEARCH_RATE = 100; // 10,000%; a bracket beyond this is not economically meaningful.

/**
 * A coarse but wide rate grid used to bracket the root before bisecting.
 * Fine enough near 0% (where real-world IRRs usually land) and wide
 * enough to reach both MIN_SEARCH_RATE and MAX_SEARCH_RATE.
 */
const SEARCH_GRID: readonly number[] = [
  MIN_SEARCH_RATE,
  -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1, -0.05, -0.01,
  0,
  0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.75,
  1, 1.5, 2, 3, 5, 10, 20, 50, MAX_SEARCH_RATE,
];

/** Number of sign changes in a cashflow series, ignoring zero-valued entries. */
export function countSignChanges(cashflows: readonly number[]): number {
  const nonZero = cashflows.filter((cf) => cf !== 0);
  let changes = 0;
  for (let i = 1; i < nonZero.length; i++) {
    if (Math.sign(nonZero[i]!) !== Math.sign(nonZero[i - 1]!)) changes++;
  }
  return changes;
}

/**
 * Year 0..n equity cashflows: -(equity invested), then each year's
 * after-tax cashflow, with the net sale proceeds added to the final year
 * only (MODEL_SPEC_FASE1B §6).
 */
export function buildEquityCashflows(args: {
  /** AcquisitionCosts.equityRequired - the investor's cash outlay at acquisition, renovation included. */
  equityInvested: number;
  years: ReadonlyArray<Pick<ProjectionYear, "cashflowAfterTax">>;
  netSaleProceeds: ExitResult["netSaleProceeds"];
}): number[] {
  if (args.years.length === 0) {
    throw new Error("buildEquityCashflows needs at least one projection year");
  }
  const cashflows = [-args.equityInvested];
  args.years.forEach((year, i) => {
    const isFinalYear = i === args.years.length - 1;
    cashflows.push(year.cashflowAfterTax + (isFinalYear ? args.netSaleProceeds : 0));
  });
  return cashflows;
}

/** Net present value of a year 0..n cashflow series at a given annual rate. */
export function npv(rate: number, cashflows: readonly number[]): number {
  return cashflows.reduce((sum, cf, t) => sum + cf / (1 + rate) ** t, 0);
}

/**
 * Solves for the IRR by bisection on NPV(rate) = 0, searching rates from
 * MIN_SEARCH_RATE to MAX_SEARCH_RATE - including negative rates, which are
 * real answers, not failures. See the module docstring for why
 * `defined: false` is reserved for series with zero sign changes.
 */
export function computeIrr(cashflows: readonly number[]): IrrResult {
  if (cashflows.length < 2) {
    return { defined: false, reason: "Need at least a year 0 outflow and one later cashflow." };
  }

  if (countSignChanges(cashflows) === 0) {
    return {
      defined: false,
      reason: "The cashflow series never changes sign; no rate can make NPV = 0.",
    };
  }

  // Scan the grid for an exact hit or a bracket with an opposite-sign NPV.
  let lo: number | undefined;
  let hi: number | undefined;
  let npvLo = 0;
  for (let i = 0; i < SEARCH_GRID.length; i++) {
    const rate = SEARCH_GRID[i]!;
    const value = npv(rate, cashflows);
    if (Math.abs(value) < NPV_TOLERANCE) {
      return { defined: true, irr: rate, iterations: 0 };
    }
    if (i > 0) {
      const prevRate = SEARCH_GRID[i - 1]!;
      const prevValue = npv(prevRate, cashflows);
      if (Math.sign(value) !== Math.sign(prevValue)) {
        lo = prevRate;
        hi = rate;
        npvLo = prevValue;
        break;
      }
    }
  }

  if (lo === undefined || hi === undefined) {
    // A genuine sign change exists in the cashflows, but the NPV curve
    // didn't cross zero anywhere in [-99%, 10,000%] - possible with more
    // than one sign change in the cashflows (multiple IRRs, or roots
    // outside this range). Reported as not defined rather than a guess.
    return {
      defined: false,
      reason: `No NPV sign change found across the searched rate range (${MIN_SEARCH_RATE * 100}% to ${MAX_SEARCH_RATE * 100}%).`,
    };
  }

  let iterations = 0;
  let mid = lo;
  while (iterations < MAX_BISECTION_ITERATIONS) {
    mid = (lo + hi) / 2;
    const npvMid = npv(mid, cashflows);
    if (Math.abs(npvMid) < NPV_TOLERANCE || hi - lo < 1e-14) {
      return { defined: true, irr: mid, iterations: iterations + 1 };
    }
    if (Math.sign(npvMid) === Math.sign(npvLo)) {
      lo = mid;
      npvLo = npvMid;
    } else {
      hi = mid;
    }
    iterations++;
  }
  return { defined: true, irr: mid, iterations };
}

/** Convenience: IRR for one scenario, built straight from the engine's exit and projection results. */
export function computeScenarioIrr(args: {
  equityInvested: EngineResult["acquisition"]["equityRequired"];
  years: ReadonlyArray<Pick<ProjectionYear, "cashflowAfterTax">>;
  exit: Pick<ExitResult, "netSaleProceeds">;
}): IrrResult {
  const cashflows = buildEquityCashflows({
    equityInvested: args.equityInvested,
    years: args.years,
    netSaleProceeds: args.exit.netSaleProceeds,
  });
  return computeIrr(cashflows);
}
