import { describe, expect, it } from "vitest";
import { deriveFinancingStrategy } from "@/lib/rules/es/derive-selections";
import { derivedAllInInterestRate } from "@/lib/rules/es/financing";
import { FINANCING_STRATEGIES } from "@/lib/rules/es/parameters";
import type { FinancingStrategyId } from "@/lib/rules/es/types";
import type { FinancingBand } from "../financing-bands";
import { pickFinancingBand } from "../financing-bands";

/**
 * Fase C stap 3. The picker exists so the client form never imports
 * parameters.ts, which means the covering rule is expressed twice: once in
 * deriveFinancingStrategy() and once as the order of the band array. This
 * file is what stops those two from drifting - it builds the bands exactly
 * as belegger/page.tsx does and checks the picker agrees with the
 * calculation layer across the whole range.
 */
const TIER_ORDER: readonly FinancingStrategyId[] = ["low", "medium", "high"];

const BANDS: readonly FinancingBand[] = TIER_ORDER.map((id) => ({
  maxLtv: FINANCING_STRATEGIES[id].ltv.value,
  loanTermYears: FINANCING_STRATEGIES[id].loanTermYears.value,
  allInRate: derivedAllInInterestRate({
    preferredLtv: FINANCING_STRATEGIES[id].ltv.value,
    strategy: id,
    residency: "nonResident",
  }),
}));

describe("pickFinancingBand - agrees with the calculation layer's own rule", () => {
  it("picks the band matching deriveFinancingStrategy() at every LTV from 0 to 1", () => {
    for (let ltv = 0; ltv <= 1.0001; ltv += 0.005) {
      const tier = deriveFinancingStrategy(ltv);
      const band = pickFinancingBand(BANDS, ltv)!;
      expect(band.maxLtv).toBe(FINANCING_STRATEGIES[tier].ltv.value);
      expect(band.loanTermYears).toBe(FINANCING_STRATEGIES[tier].loanTermYears.value);
    }
  });

  it("agrees at the two LTVs that used to split the term from the rate", () => {
    for (const ltv of [0.62, 0.72]) {
      const tier = deriveFinancingStrategy(ltv);
      expect(pickFinancingBand(BANDS, ltv)!.loanTermYears).toBe(
        FINANCING_STRATEGIES[tier].loanTermYears.value,
      );
    }
  });

  it("carries the all-in rate, not the base rate - what the customer is shown", () => {
    const band = pickFinancingBand(BANDS, 0.75)!;
    expect(band.allInRate).toBeGreaterThan(FINANCING_STRATEGIES.high.interestRate.value);
    expect(band.allInRate).toBeCloseTo(
      FINANCING_STRATEGIES.high.interestRate.value + 0.01,
      10,
    );
  });

  it("falls through to the highest band above every tier's LTV", () => {
    expect(pickFinancingBand(BANDS, 0.99)!.maxLtv).toBe(FINANCING_STRATEGIES.high.ltv.value);
  });

  it("returns null for an empty table rather than inventing a band", () => {
    expect(pickFinancingBand([], 0.7)).toBeNull();
  });
});
