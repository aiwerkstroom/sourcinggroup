/**
 * Dutch copy for the financing terms' provenance (fase C stap 3;
 * UI_SPEC.md: Nederlands in de UI, CLAUDE.md §6: Engels in de rekenlaag).
 *
 * The same asymmetry the renovation-tier and -duration notes have, with
 * one difference worth stating: what "derived" means here is weaker than
 * a caveat about an unverified figure. The tier's rate is SOURCED and its
 * term is an explicit product definition, so the derived case is not
 * flagged as shaky - it is flagged as *generic*, which is a different
 * complaint. A customer with a real offer has better information; a
 * customer without one is not being handed a guess.
 *
 * The rate is always spoken about as all-in, because that is what the
 * customer was shown and what they would have typed. Saying "3,2% plus
 * 1,0% opslag" here would invite them to compare a base rate against
 * their own all-in quote.
 */

import type { FinancingTermsProvenance } from "@/lib/rules/es/types";

/** "3,85%" - Dutch decimal comma, at most two decimals. */
function percent(fraction: number): string {
  return `${(fraction * 100).toLocaleString("nl-NL", { maximumFractionDigits: 2 })}%`;
}

function years(n: number): string {
  return `${n} jaar`;
}

/**
 * §6.8's line about where the mortgage rate and term came from. Returns
 * null when nobody was asked - EngineResult.financingTermsProvenance is
 * null for callers that supplied a tier directly.
 *
 * One sentence covering both halves rather than two, because they are one
 * decision to the customer ("do I have an offer or not") even though the
 * model lets them override the two independently.
 */
export function translateFinancingTermsProvenanceNote(
  provenance: FinancingTermsProvenance | null,
  /** The rate and term actually used - the all-in rate, matching what the customer saw. */
  inForce: { allInRate: number; loanTermYears: number },
): string | null {
  if (provenance === null) return null;

  const rateChosen = provenance.interestRate.status === "customerChosen";
  const termChosen = provenance.loanTermYears.status === "customerChosen";

  if (!rateChosen && !termChosen) {
    return (
      `De rente (${percent(inForce.allInRate)}) en looptijd (${years(inForce.loanTermYears)}) ` +
      `zijn afgeleid uit de LTV die u wilde financieren, niet uit een offerte. Het zijn de ` +
      `voorwaarden die bij dat leenniveau horen in ons model; uw bank kan u iets anders bieden.`
    );
  }

  if (rateChosen && termChosen) {
    return (
      `U gaf zelf een rente van ${percent(inForce.allInRate)} en een looptijd van ` +
      `${years(inForce.loanTermYears)} op. Daar is mee gerekend, in plaats van met de ` +
      `${percent(provenance.interestRate.derivedValue)} over ` +
      `${years(provenance.loanTermYears.derivedValue)} die uit uw gewenste LTV zouden volgen.`
    );
  }

  if (rateChosen) {
    return (
      `U gaf zelf een rente van ${percent(inForce.allInRate)} op - daar is mee gerekend, in ` +
      `plaats van met de ${percent(provenance.interestRate.derivedValue)} die uit uw gewenste ` +
      `LTV zou volgen. De looptijd (${years(inForce.loanTermYears)}) is wel afgeleid.`
    );
  }

  return (
    `U gaf zelf een looptijd van ${years(inForce.loanTermYears)} op - daar is mee gerekend, in ` +
    `plaats van met de ${years(provenance.loanTermYears.derivedValue)} die uit uw gewenste LTV ` +
    `zou volgen. De rente (${percent(inForce.allInRate)}) is wel afgeleid.`
  );
}

/**
 * The one thing about an own-rate override a customer could reasonably
 * get wrong: whether the non-resident surcharge still gets added. It does
 * not - a quoted rate is all-in - and saying so is cheaper than letting
 * someone wonder whether their 3,6% quietly became 4,6%.
 *
 * Only shown when the rate was actually overridden; there is nothing to
 * clarify otherwise.
 */
export function translateAllInRateNote(
  provenance: FinancingTermsProvenance | null,
): string | null {
  if (provenance === null || provenance.interestRate.status !== "customerChosen") return null;
  return (
    "De rente die u opgaf is als all-in behandeld: er is geen opslag voor niet-ingezetenen " +
    "bovenop gerekend, omdat een bank die opslag al in haar aanbod verwerkt."
  );
}
