/**
 * The one-line verdict of UI_SPEC.md §6.2: "het lichte oordeel" - a single
 * sober sentence, built from the base scenario's three core figures
 * (maandcashflow, DSCR, IRR), not an appraisal.
 *
 * UI_SPEC.md §1 sets the bar directly: "Cijfers voeren het woord, het
 * oordeel is licht. Geen verkooppraat, geen alarm, geen aanbeveling om te
 * kopen." So this function never uses an evaluative adjective ("zwak",
 * "sterk", "teleurstellend") - it states each figure and its relation to
 * its own threshold (0 for cashflow, 1,0 for DSCR, the investor's hurdle
 * for IRR), plainly.
 *
 * The connecting word between the operating picture (cashflow + DSCR) and
 * the return picture (IRR vs. hurdle) is chosen structurally, not
 * subjectively: "maar" when the two pictures disagree (one clears its bar,
 * the other doesn't), "en" when they agree. UI_SPEC.md §7 gives exactly
 * this shape as its own example of what the report should surface without
 * interpreting it: "Een pand met een lage cashflowscore maar een hoge
 * rendementsscore... is een ander verhaal dan een pand dat op alles laag
 * scoort. Het rapport laat dat zien zonder het te interpreteren." - "maar"
 * in the spec's own description of the surprising case, "op alles laag"
 * for the case with nothing to contrast.
 */

import type { IrrResult } from "@/lib/rules/es/types";
import { formatEuro, formatPercent } from "./format";

export interface OneLineVerdictInput {
  monthlyCashflow: number;
  dscr: number;
  irr: IrrResult;
  /** ReturnRequirementCheck.meetsMinRequiredReturn - null exactly when irr.defined is false. */
  meetsMinRequiredReturn: boolean | null;
}

function operatingClears(monthlyCashflow: number, dscr: number): boolean {
  return monthlyCashflow >= 0 && dscr >= 1.0;
}

function cashflowClause(monthlyCashflow: number): string {
  if (monthlyCashflow > 0) return `een positieve maandcashflow van ${formatEuro(monthlyCashflow)}`;
  if (monthlyCashflow < 0) return `een negatieve maandcashflow van ${formatEuro(monthlyCashflow)}`;
  return "een maandcashflow van precies € 0 (break-even)";
}

function dscrClause(dscr: number): string {
  const value = dscr.toFixed(2).replace(".", ",");
  if (dscr > 1.0) return `een DSCR van ${value}, boven de 1,0`;
  if (dscr < 1.0) return `een DSCR van ${value}, onder de 1,0`;
  return `een DSCR van exact 1,0`;
}

function irrClause(irr: number, meetsMinRequiredReturn: boolean): string {
  const value = formatPercent(irr);
  return meetsMinRequiredReturn
    ? `een IRR van ${value}, die de rendementseis haalt`
    : `een IRR van ${value}, die de rendementseis niet haalt`;
}

/**
 * Null exactly when the base scenario has no IRR (SCORE_SPEC.md §2.3),
 * mirroring TsgScoreSection's own null case rather than inventing a
 * different message for the same underlying absence.
 */
export function buildOneLineVerdict(input: OneLineVerdictInput): string | null {
  const operating = `${cashflowClause(input.monthlyCashflow)} en ${dscrClause(input.dscr)}`;

  if (!input.irr.defined || input.meetsMinRequiredReturn === null) {
    return `Het basisscenario geeft ${operating}. Er is geen IRR: geen enkele rentevoet brengt de kasstroomreeks op nul, dus het rendement ten opzichte van de eis is niet te bepalen.`;
  }

  const opClears = operatingClears(input.monthlyCashflow, input.dscr);
  const connector = opClears === input.meetsMinRequiredReturn ? "en" : "maar";
  const irr = irrClause(input.irr.irr!, input.meetsMinRequiredReturn);

  return `Het basisscenario geeft ${operating}, ${connector} ${irr}.`;
}
