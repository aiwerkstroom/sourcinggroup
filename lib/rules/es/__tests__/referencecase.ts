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
    // TSG_Model_v3.xlsx has one area figure (133 m²), not a separate
    // usable/built split for this property (MODEL_SPEC.md §17). Both are
    // set explicitly and identically here - the current approximation
    // carried forward as-is, not the DEFAULT_USABLE_TO_BUILT_AREA_RATIO
    // fallback (which only applies when usableAreaM2 is omitted).
    usableAreaM2: 133,
    builtAreaM2: 133,
    rooms: 7,
    bedrooms: 5,
    bathrooms: 5,
    constructionYear: 1972,
    energyLabel: "B",
    purchasePrice: 330_000,
    ownMoney: 115_000,
    // TEST FIXTURE - not sourced for this specific building. Gastos de
    // comunidad has no default anywhere in the engine (MODEL_SPEC.md §15);
    // this figure exercises the formula only, chosen for round-number
    // clarity in the golden tests, not a claim about the real building.
    communityFeesAnnual: 900,
    // Rented as student housing, long-term (currentRentStatus above); the
    // reference case's own selections.rentalStrategy is "hybrid", which
    // requires a título habilitante - true here so it stays a valid
    // selection (MODEL_SPEC.md §18). Not a claim about the real building's
    // licensing status, only what keeps this fixture internally consistent.
    hasTouristRentalLicense: true,
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
