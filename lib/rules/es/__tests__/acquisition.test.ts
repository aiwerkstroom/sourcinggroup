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
    expect(acq.stampDutyAJD).toBeCloseTo(4950, 9);
    expect(acq.notaryFee).toBeCloseTo(1650, 9);
    expect(acq.registrationFee).toBeCloseTo(990, 9);
    expect(acq.legalAdvice).toBeCloseTo(3300, 9);
    expect(acq.agencyFees).toBeCloseTo(16500, 9);
    expect(acq.bankFee).toBe(100);
  });

  it("computes total acquisition costs 445490 (D145)", () => {
    expect(acq.total).toBeCloseTo(445490, 9);
  });

  it("computes equity required 197990 (D153)", () => {
    expect(acq.equityRequired).toBeCloseTo(197990, 9);
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
    expect(rates.mandatory).toBeCloseTo(
      r.transferTaxITP + r.stampDutyAJD + r.notaryFee + r.registrationFee + LEGAL_ADVICE_FEE.value,
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

  it("the mandatory rate is 13,3% and the agent fee 5% on today's parameters", () => {
    // A golden value, so a parameter change has to be noticed rather than
    // silently restating the page's headline. Note this is above the
    // "11-12%" commonly quoted for Spain: that figure covers ITP, notary,
    // registration and legal advice (11,8% here) and leaves out the 1,5%
    // stamp duty this model also charges - see MODEL_SPEC.md §21.
    const rates = acquisitionCostRates();
    expect(rates.mandatory).toBeCloseTo(0.133, 10);
    expect(rates.agency).toBeCloseTo(0.05, 10);
    expect(rates.total).toBeCloseTo(0.183, 10);
  });
});
