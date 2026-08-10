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
 * Not every cashflow series has a defined IRR. If the nominal
 * (undiscounted) total return does not exceed the initial investment -
 * NPV at a 0% discount rate is not positive - no non-negative rate can
 * make the NPV zero, since discounting only ever shrinks future cashflows
 * further. That case returns `{ defined: false, ... }` explicitly; the
 * caller must not report a rate.
 */

import type { EngineResult, ExitResult, IrrResult, ProjectionYear } from "./types";

const MAX_BISECTION_ITERATIONS = 100;
const NPV_TOLERANCE = 1e-6;
const MAX_SEARCH_RATE = 100; // 10,000%; a bracket beyond this is not economically meaningful.

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
 * Solves for the IRR by bisection on NPV(rate) = 0, searching rate >= 0.
 * Returns `defined: false` when NPV(0) is not positive - the investment
 * never nominally breaks even, so no non-negative rate can zero the NPV.
 */
export function computeIrr(cashflows: readonly number[]): IrrResult {
  if (cashflows.length < 2) {
    return { defined: false, reason: "Need at least a year 0 outflow and one later cashflow." };
  }

  const npvAtZero = npv(0, cashflows);
  if (npvAtZero <= 0) {
    return {
      defined: false,
      reason:
        "The nominal (undiscounted) total return does not exceed the initial investment " +
        `(NPV at 0% = ${npvAtZero.toFixed(2)}); no non-negative rate solves NPV = 0.`,
    };
  }

  // NPV(0) > 0 and NPV(rate) -> -cashflows[0] as rate -> infinity (cashflows[0] < 0
  // here, since NPV(0) > 0 requires it), so a sign change exists somewhere in
  // (0, MAX_SEARCH_RATE] by the intermediate value theorem, unless the series
  // is pathological enough to not reach it within the search cap.
  let lo = 0;
  let hi = 1;
  let npvHi = npv(hi, cashflows);
  while (npvHi > 0) {
    hi *= 2;
    if (hi > MAX_SEARCH_RATE) {
      return {
        defined: false,
        reason: `No sign change found for a rate up to ${MAX_SEARCH_RATE * 100}%.`,
      };
    }
    npvHi = npv(hi, cashflows);
  }

  let iterations = 0;
  let mid = lo;
  while (iterations < MAX_BISECTION_ITERATIONS) {
    mid = (lo + hi) / 2;
    const npvMid = npv(mid, cashflows);
    if (Math.abs(npvMid) < NPV_TOLERANCE || hi - lo < 1e-14) {
      return { defined: true, irr: mid, iterations: iterations + 1 };
    }
    if (npvMid > 0) {
      lo = mid;
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
