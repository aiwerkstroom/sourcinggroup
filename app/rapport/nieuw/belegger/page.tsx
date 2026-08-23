import { derivedAllInInterestRate } from "@/lib/rules/es/financing";
import { FINANCING_STRATEGIES } from "@/lib/rules/es/parameters";
import type { FinancingStrategyId } from "@/lib/rules/es/types";
import { FIXED_RESIDENCY } from "../_lib/build-engine-input";
import type { FinancingBand } from "../_lib/financing-bands";
import { BeleggerForm } from "./belegger-form";

/**
 * Step 3 - de belegger (UI_SPEC.md §3), with the rental strategy behind
 * the permit gate step 2 closed.
 *
 * Server Component. The rent pre-fill it needs depends on answers held in
 * client state (wijk, area, letting status), so it cannot be computed
 * here - the client asks for it through the Server Action in actions.ts
 * instead, which keeps parameters.ts server-side either way.
 *
 * Fase C stap 3 added the one thing this step needs *live* from
 * parameters.ts: the rate and term a typed LTV implies, shown as the
 * customer types. Resolving it here per keystroke is impossible, and
 * importing the derivation into the client form would ship the whole
 * parameter database to the browser (see _lib/financing-bands.ts). So the
 * three tiers are flattened into bands here, once, and the form does a
 * pure lookup over them.
 *
 * Ascending by LTV, because pickFinancingBand() reads "first band that
 * covers this LTV" - the order is the rule.
 */
const TIER_ORDER: readonly FinancingStrategyId[] = ["low", "medium", "high"];

const FINANCING_BANDS: readonly FinancingBand[] = TIER_ORDER.map((id) => ({
  maxLtv: FINANCING_STRATEGIES[id].ltv.value,
  loanTermYears: FINANCING_STRATEGIES[id].loanTermYears.value,
  // All-in, not the base rate: it is what the customer's own quote is
  // comparable to, and what they would be overriding.
  allInRate: derivedAllInInterestRate({
    preferredLtv: FINANCING_STRATEGIES[id].ltv.value,
    strategy: id,
    residency: FIXED_RESIDENCY,
  }),
}));

export default function BeleggerPage() {
  return <BeleggerForm financingBands={FINANCING_BANDS} />;
}
