import { describe, expect, it } from "vitest";
import { acquisitionCostRates, acquisitionCosts } from "../acquisition";
import { ACQUISITION_RATES, BANK_FEE, LEGAL_ADVICE_FEE } from "../parameters";
import { renovationStrategyTable, selectRenovation } from "../renovation";
import { fixedOperatingCosts, utilitiesBaseAnnual } from "../operating";
import { referenceCase } from "./referencecase";

// Golden values: corrected TSG_Model_v3.xlsx, Costs & Income!B125:D179.
describe("acquisition costs (reference case)", () => {
  const acq = acquisitionCosts({
    purchasePrice: 330000,
    renovationCosts: 55000,
    mortgageAmount: 247500,
    constraints: referenceCase.constraints,
  });

  it("computes each cost line (D131-D143)", () => {
    expect(acq.transferTaxITP).toBeCloseTo(33000, 9);
    // Zero, deliberately diverging from the workbook's 4950 - AJD is not
    // owed on a resale purchase deed. See acquisition.ts's chargedRates()
    // and MODEL_SPEC.md §22.
    expect(acq.stampDutyAJD).toBe(0);
    expect(acq.notaryFee).toBeCloseTo(1650, 9);
    expect(acq.registrationFee).toBeCloseTo(990, 9);
    expect(acq.legalAdvice).toBeCloseTo(3300, 9);
    expect(acq.agencyFees).toBeCloseTo(16500, 9);
    expect(acq.bankFee).toBe(100);
  });

  it("computes total acquisition costs 440540 - the workbook's 445490 less the AJD double count", () => {
    expect(acq.total).toBeCloseTo(440540, 9);
  });

  it("computes equity required 193040 - the workbook's 197990 less the AJD double count", () => {
    expect(acq.equityRequired).toBeCloseTo(193040, 9);
  });

  it("passes both budget checks (H149/H151)", () => {
    expect(acq.withinTotalBudget).toBe(true);
    expect(acq.renovationWithinBudget).toBe(true);
  });
});

describe("renovation strategies (Costs & Income!B66:H84)", () => {
  const table = renovationStrategyTable({ maxRenovationBudget: 60000 });

  it("checks capex against the max renovation budget: Yes / Yes / No (D72/F72/H72)", () => {
    expect(table.map((s) => s.withinMaxRenovationBudget)).toEqual([true, true, false]);
  });

  it("selects the Light strategy with neutral multipliers", () => {
    const light = selectRenovation("light", { maxRenovationBudget: 60000 });
    expect(light.capex).toBe(55000);
    expect(light.rentMultiplier).toBe(1);
    expect(light.maintenanceFactor).toBe(1);
    expect(light.utilitiesEfficiency).toBe(1);
  });
});

describe("operating cost blocks", () => {
  it("computes the utilities base: 21.5 €/m² x 133 = 2859.5 (H60)", () => {
    expect(utilitiesBaseAnnual(133)).toBeCloseTo(2859.5, 9);
  });

  it("computes fixed operating costs, Excel parity (D159-D167): communityFeesAnnual 0, since the Excel has no such line", () => {
    const fixed = fixedOperatingCosts({
      purchasePrice: 330000,
      mortgageAmount: 247500,
      effectiveInterestRate: 0.042,
      communityFeesAnnual: 0,
    });
    expect(fixed.propertyTaxIBI).toBeCloseTo(1320, 9);
    expect(fixed.insurance).toBe(1030);
    expect(fixed.bankAccountFee).toBe(100);
    expect(fixed.communityFees).toBe(0);
    expect(fixed.mortgageInterest).toBeCloseTo(10395, 9);
    expect(fixed.total).toBeCloseTo(12845, 9);
  });

  it("adds gastos de comunidad on top of the Excel-parity total, unindexed (MODEL_SPEC.md §15 - new fixed cost, no Excel counterpart)", () => {
    const fixed = fixedOperatingCosts({
      purchasePrice: 330000,
      mortgageAmount: 247500,
      effectiveInterestRate: 0.042,
      communityFeesAnnual: 900,
    });
    expect(fixed.communityFees).toBe(900);
    expect(fixed.total).toBeCloseTo(12845 + 900, 9);
  });

  it("approximates IBI with the purchase price when no cadastralValue is given (0.4% x 330000 = 1320, same as Excel parity)", () => {
    const fixed = fixedOperatingCosts({
      purchasePrice: 330000,
      mortgageAmount: 247500,
      effectiveInterestRate: 0.042,
      communityFeesAnnual: 0,
    });
    expect(fixed.propertyTaxIBI).toBeCloseTo(1320, 9);
  });

  it("computes IBI over suelo + construcción when cadastralValue is given (MODEL_SPEC.md §16), not over the purchase price", () => {
    // A cadastral value well below market price, as is typical in Spain:
    // (120000 + 80000) x 0.4% = 800, not 330000 x 0.4% = 1320.
    const fixed = fixedOperatingCosts({
      purchasePrice: 330000,
      mortgageAmount: 247500,
      effectiveInterestRate: 0.042,
      communityFeesAnnual: 0,
      cadastralValue: { suelo: 120000, construccion: 80000 },
    });
    expect(fixed.propertyTaxIBI).toBeCloseTo(800, 9);
  });
});

/**
 * The acquisition cost rates as a headline figure for the free
 * indication. The point of deriving them rather than writing "11-12%"
 * into the copy is that the free page and the paid report then cannot
 * quote different numbers - so what these tests pin hardest is that the
 * rates really are the same ones acquisitionCosts() charges.
 */
describe("acquisitionCostRates - the figure the free indication quotes", () => {
  it("sums exactly the rate parameters acquisitionCosts() applies", () => {
    const r = ACQUISITION_RATES.value;
    const rates = acquisitionCostRates();
    // Note stampDutyAJD is absent: it is a real rate that this
    // transaction type does not owe (chargedRates()), so the quoted
    // headline must not include it either.
    expect(rates.mandatory).toBeCloseTo(
      r.transferTaxITP + r.notaryFee + r.registrationFee + LEGAL_ADVICE_FEE.value,
      12,
    );
    expect(rates.agency).toBe(r.agencyFee);
    expect(rates.total).toBeCloseTo(rates.mandatory + rates.agency, 12);
  });

  it("matches what acquisitionCosts() actually charges on a real purchase price", () => {
    // The guarantee that matters: quote a rate, charge that rate. Anything
    // that drifts between the two would make the free page's headline a
    // promise the paid report breaks.
    const purchasePrice = 330_000;
    const costs = acquisitionCosts({
      purchasePrice,
      renovationCosts: 0,
      mortgageAmount: 0,
      constraints: { totalBudget: 1_000_000, maxRenovationBudget: 100_000 },
    });
    const chargedRateBased =
      costs.transferTaxITP +
      costs.stampDutyAJD +
      costs.notaryFee +
      costs.registrationFee +
      costs.legalAdvice +
      costs.agencyFees;
    expect(chargedRateBased / purchasePrice).toBeCloseTo(acquisitionCostRates().total, 12);
  });

  it("leaves the flat bank fee out - it is a euro amount, not a rate", () => {
    // Including it would make the rate depend on the purchase price, for
    // EUR 100 against a property price.
    const rates = acquisitionCostRates();
    expect(rates.total).toBeLessThan(1);
    expect(rates.total * 100_000).not.toBeCloseTo(
      rates.total * 100_000 + BANK_FEE.value,
      6,
    );
  });

  it("splits the unavoidable costs from the purchase-agent fee", () => {
    // Two different kinds of cost: one every buyer pays, one not every
    // buyer incurs. Quoting only the sum would overstate the first.
    const rates = acquisitionCostRates();
    expect(rates.mandatory).toBeGreaterThan(0);
    expect(rates.agency).toBeGreaterThan(0);
    expect(rates.mandatory).toBeGreaterThan(rates.agency);
  });

  it("the mandatory rate is 11,8% and the agent fee 5% on today's parameters", () => {
    // Hand-checkable: ITP 10% + notaris 0,5% + registratie 0,3% +
    // juridisch 1,0% = 11,8%. This is the figure independent Spanish
    // sources quote as "11-12% kosten koper"; the model briefly showed
    // 13,3% because it also charged 1,5% AJD, which a resale purchase
    // does not owe (MODEL_SPEC.md §22).
    const rates = acquisitionCostRates();
    expect(rates.mandatory).toBeCloseTo(0.118, 10);
    expect(rates.agency).toBeCloseTo(0.05, 10);
    expect(rates.total).toBeCloseTo(0.168, 10);
  });

  it("charges no stamp duty at all on this transaction type", () => {
    // The correction itself, stated as its own claim rather than only
    // implied by the total.
    const priced = acquisitionCosts({
      purchasePrice: 250_000,
      renovationCosts: 0,
      mortgageAmount: 0,
      constraints: { totalBudget: 1_000_000, maxRenovationBudget: 0 },
    });
    expect(priced.stampDutyAJD).toBe(0);
    // And the rate that would have produced it is still on the parameter,
    // ready for a new-build path that does owe it.
    expect(ACQUISITION_RATES.value.stampDutyAJD).toBeCloseTo(0.015, 12);
  });

  it("11,8% of a purchase price is what a buyer actually gets charged", () => {
    // The worked example: EUR 250.000 -> EUR 29.500 mandatory costs.
    const price = 250_000;
    const priced = acquisitionCosts({
      purchasePrice: price,
      renovationCosts: 0,
      mortgageAmount: 0,
      constraints: { totalBudget: 1_000_000, maxRenovationBudget: 0 },
    });
    const mandatory =
      priced.transferTaxITP +
      priced.stampDutyAJD +
      priced.notaryFee +
      priced.registrationFee +
      priced.legalAdvice;
    expect(mandatory).toBeCloseTo(29_500, 6);
    expect(mandatory / price).toBeCloseTo(acquisitionCostRates().mandatory, 12);
  });
});

/**
 * The AJD correction, stated as its own claim rather than only implied by
 * the totals above (MODEL_SPEC.md §22).
 *
 * Worth pinning separately because the parameter still exists and is
 * still correct: what changed is that this transaction type does not owe
 * it. A future new-build path would legitimately charge it again, and
 * these tests should then be read as "existing build owes none", not as
 * "the rate is dead".
 */
describe("AJD is not charged on a resale purchase (MODEL_SPEC.md §22)", () => {
  const priced = (purchasePrice: number) =>
    acquisitionCosts({
      purchasePrice,
      renovationCosts: 0,
      mortgageAmount: 0,
      constraints: { totalBudget: 10_000_000, maxRenovationBudget: 0 },
    });

  it("charges zero stamp duty at any price", () => {
    for (const price of [80_000, 250_000, 330_000, 600_000]) {
      expect(priced(price).stampDutyAJD).toBe(0);
    }
  });

  it("keeps the rate on the parameter, sourced and ready for a new-build path", () => {
    // Deleting it would lose a correct, cited figure for a transaction
    // type this engine may one day price.
    expect(ACQUISITION_RATES.value.stampDutyAJD).toBeCloseTo(0.015, 12);
    expect(ACQUISITION_RATES.provenance).toBe("SOURCED");
  });

  it("hand-checkable: EUR 250.000 costs EUR 29.500, not EUR 33.250", () => {
    // 10% ITP + 0,5% notaris + 0,3% registratie + 1,0% juridisch = 11,8%.
    // With the 1,5% AJD the model used to add, it would have been 13,3%
    // -> EUR 33.250.
    const p = priced(250_000);
    const mandatory =
      p.transferTaxITP + p.stampDutyAJD + p.notaryFee + p.registrationFee + p.legalAdvice;
    expect(mandatory).toBeCloseTo(29_500, 6);
    expect(mandatory).not.toBeCloseTo(33_250, 6);
  });

  it("keeps the quoted rate and the charged amount in step, by construction", () => {
    // The two used to be written out separately, which is how they could
    // drift; they now read one shared definition. This checks the
    // property that matters at three prices rather than trusting that.
    const rates = acquisitionCostRates();
    for (const price of [80_000, 330_000, 600_000]) {
      const p = priced(price);
      const mandatory =
        p.transferTaxITP + p.stampDutyAJD + p.notaryFee + p.registrationFee + p.legalAdvice;
      expect(mandatory / price).toBeCloseTo(rates.mandatory, 12);
      expect(p.agencyFees / price).toBeCloseTo(rates.agency, 12);
    }
  });

  it("lowers the capital-gains acquisition base too, which raises the tax", () => {
    // The correction is not purely a saving: AJD was part of the
    // deductible acquisition value (exit.ts), so removing it enlarges the
    // taxable gain. Both effects are real and both are now modelled.
    const p = priced(330_000);
    const deductible =
      p.transferTaxITP + p.stampDutyAJD + p.notaryFee + p.registrationFee + p.legalAdvice;
    expect(deductible).toBeCloseTo(38_940, 6);
    expect(deductible).not.toBeCloseTo(43_890, 6);
  });
});
