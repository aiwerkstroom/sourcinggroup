/**
 * Split out of rent-provenance.ts for one reason: this function needs
 * nothing from parameters.ts, and rent-provenance.ts imports
 * NEIGHBORHOOD_RENT_LONG_TERM/SHORT_TERM and
 * RENT_OVERRIDE_SIGNIFICANT_DEVIATION_THRESHOLD for computeRentInputProvenance().
 * Report code that only needs the key decision - not the comparison
 * itself - must not import a module that also imports parameters.ts:
 * `next build`'s client bundle for /rapport/resultaat was found to
 * include the full RENOVATION_STRATEGIES object (capex figures,
 * PLACEHOLDER reasoning text) despite nothing in the report layer
 * reading it, because it shares parameters.ts with the two constants
 * this file's sibling genuinely needs. Splitting the pure decision out
 * removes the shared module from the dependency graph entirely, rather
 * than trusting the bundler's tree-shaking to prove per-binding
 * reachability inside one large file - the same discipline
 * field-validation.ts already documents for the same reason.
 *
 * rent-provenance.ts re-exports this, so nothing server-side needs to
 * change its import path; only client-reachable report code should
 * import from here directly.
 */

import type { RentInputProvenance, RentProvenanceDisclosureKey } from "./types";

/**
 * Which §6.1 disclosure key, if any, one rate's provenance triggers.
 *
 * Null for matchesReference and noReference - §6.1 carries nothing about
 * rent provenance when the model's own reference drove the outcome.
 * "actualCurrentRent" does emit a key, but a reassuring one: it reports a
 * stronger input than the model could supply, not a weaker one.
 */
export function rentProvenanceDisclosureKey(
  provenance: RentInputProvenance,
): RentProvenanceDisclosureKey | null {
  if (provenance.status === "actualCurrentRent") return "rentFromActualCurrentRent";
  if (provenance.status !== "customerOverride") return null;
  return provenance.significantDeviation ? "rentOverrideSignificant" : "rentOverrideMinor";
}
