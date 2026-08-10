/**
 * Reference case: Avenida Primado Reig 19, Valencia (MODEL_SPEC.md §11).
 * Inputs exactly as entered in the corrected TSG_Model_v3.xlsx.
 */

import type { EngineInput } from "../types";

export const referenceCase: EngineInput = {
  property: {
    name: "Avenida Primado Reig 19",
    region: "Valencia",
    address: "Avenida Primado Reig 19, Valencia",
    propertyType: "Apartment (5 studios)",
    marketSegment: "Student Housing",
    currentRentStatus: "Rented Long-Term",
    livingAreaM2: 133,
    rooms: 7,
    bedrooms: 5,
    bathrooms: 5,
    constructionYear: 1972,
    energyLabel: "B",
    purchasePrice: 330_000,
    ownMoney: 115_000,
  },
  constraints: {
    totalBudget: 450_000,
    maxRenovationBudget: 60_000,
    // Preferred LTV left empty in the Excel (Costs & Income!D10).
    minLtv: 0.6,
    maxLtv: 0.75,
    riskTolerance: "medium",
    minRoiTarget: 0.04,
    minMonthlyCashflow: 500,
    maxMonthlyDebt: 1_000,
  },
  selections: {
    // Costs & Income!L6/N6 point at Matrices column G: 17 LT / 36 ST.
    rentPerM2LongTerm: 17,
    rentPerM2ShortTerm: 36,
    rentalStrategy: "hybrid",
    renovationStrategy: "light", // Preferred deal type "Light" (D18/D89)
    financingStrategy: "high", // Selected Strategy C - High Leverage (D117)
    residency: "nonResident", // Dutch buyer (Changelog D124)
    euResident: true,
  },
};
