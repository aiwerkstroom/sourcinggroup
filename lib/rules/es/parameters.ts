/**
 * TSG Yield Engine - Spain (ES) parameters.
 *
 * Hard rule: no hardcoded numbers in the calculation layer. Every value
 * lives here, with source and date. The single source of truth is the
 * corrected Excel model TSG_Model_v3.xlsx (2026-08); cell references and
 * the original external sources are noted per value.
 *
 * Values marked [BESLISSING] in MODEL_SPEC.md are open product decisions
 * and must not be changed here without sign-off by Samuel.
 */

import type {
  FinancingStrategyId,
  RenovationStrategyId,
  ScenarioId,
} from "./types";

/** Long-term rent price points €/m²/month. Matrices!D8:J8, TSG_Model_v3.xlsx (2026-08). */
export const RENT_MATRIX_LONG_TERM_PER_M2 = [9, 13.5, 15, 17, 21, 22.5, 25] as const;

/** Short-term rent price points €/m²/month. Matrices!D21:J21, TSG_Model_v3.xlsx (2026-08). */
export const RENT_MATRIX_SHORT_TERM_PER_M2 = [15, 24, 30, 36, 40, 43, 45] as const;

/**
 * Neighborhood reference table, Valencia, €/m²/month long-term.
 * Reference Info B10:D25. Sources: Idealista (2025), Fotocasa/Cadena SER
 * (2025), Investropa (2025), Idealista Listings (2025).
 * Short-term prices average ~1.7x long-term (Reference Info B46, 2025);
 * the model uses its own short-term table (RENT_MATRIX_SHORT_TERM_PER_M2).
 */
export const NEIGHBORHOOD_RENT_LONG_TERM: Readonly<Record<string, number>> = {
  "Valencia City": 13.5,
  Alboraya: 17.2,
  Godella: 12.7,
  "Canet d'En Berenguer": 14.7,
  Cullera: 12.2,
  Mislata: 12.8,
  Moncada: 11.0,
  Oliva: 9.2,
  Catarroja: 10.4,
  "Bétera": 11.3,
  "El Carmen (Ciutat Vella)": 23.0,
  Ruzafa: 17.0,
  "Other premium central": 21.0,
};

/**
 * Neighborhood reference table, Valencia, €/m²/month short-term.
 * Reference Info B29:D41. Sources: Idealista (2025), Investropa (2025).
 */
export const NEIGHBORHOOD_RENT_SHORT_TERM: Readonly<Record<string, number>> = {
  "Valencia City": 22.5,
  Alboraya: 28.0,
  Godella: 21.5,
  "Canet d'En Berenguer": 25.0,
  Cullera: 20.5,
  Mislata: 21.5,
  Moncada: 18.0,
  Oliva: 15.0,
  Catarroja: 17.6,
  "Bétera": 19.0,
  "El Carmen (Ciutat Vella)": 34.0,
  Ruzafa: 29.0,
  "Other premium central": 33.5,
};

/** Base occupancy long-term. Matrices!B16 via Costs & Income!L14, TSG_Model_v3.xlsx (2026-08). */
export const BASE_OCCUPANCY_LONG_TERM = 0.9;

/** Base occupancy short-term. Matrices!B29 via Costs & Income!N14, TSG_Model_v3.xlsx (2026-08). */
export const BASE_OCCUPANCY_SHORT_TERM = 0.6;

/** Hybrid allocation. Costs & Income!L26/L28, TSG_Model_v3.xlsx (2026-08). */
export const HYBRID_SHARE_LONG_TERM = 0.6;
export const HYBRID_SHARE_SHORT_TERM = 0.4;

/**
 * Annual insurance costs, € per year. Costs & Income!F31:F37 (2026-08).
 * Reference: Expatica (2025), MovingToSpain (2024), MyInsuranceSpain,
 * Caixabank (2025).
 */
export const INSURANCE_COSTS_ANNUAL = {
  home: 300,
  contents: 180,
  landlord: 250,
  life: 300,
} as const;

export const TOTAL_INSURANCE_ANNUAL =
  INSURANCE_COSTS_ANNUAL.home +
  INSURANCE_COSTS_ANNUAL.contents +
  INSURANCE_COSTS_ANNUAL.landlord +
  INSURANCE_COSTS_ANNUAL.life;

/** Property management fee, share of gross rent. Costs & Income!F42; source Wise (2025), corrected 5%->8% per Changelog (2026-08). */
export const PROPERTY_MANAGEMENT_FEE = 0.08;

/** Legal advice fee, share of purchase price. Costs & Income!F44; source Idealista (2025), corrected 0.5%->1% per Changelog (2026-08). */
export const LEGAL_ADVICE_FEE = 0.01;

/** Maintenance, share of gross rent. Costs & Income!F46, TSG_Model_v3.xlsx (2026-08). */
export const MAINTENANCE_RATE = 0.05;

/** Utilities base €/m²/year. Costs & Income!H54:H58; sources CNMC/Eurostat (2024), Globexs (2025), IDAE/Eurostat. */
export const UTILITIES_PER_M2_ANNUAL = {
  gas: 8,
  water: 3.5,
  electricity: 10,
} as const;

export const TOTAL_UTILITIES_PER_M2_ANNUAL =
  UTILITIES_PER_M2_ANNUAL.gas +
  UTILITIES_PER_M2_ANNUAL.water +
  UTILITIES_PER_M2_ANNUAL.electricity;

/**
 * Acquisition cost rates, share of purchase price (Spain, existing build).
 * Costs & Income!D50:D58 after the Changelog corrections (2026-08) that
 * aligned them with Reference Info (the leading set):
 * - transfer tax ITP 10% - Monserrate Inmobiliaria (2025)
 * - stamp duty AJD 1.5% - Idealista (2025)
 * - notary 0.5% (was 0.15%) - Idealista (2025)
 * - registration 0.3% (was 0.2%) - Idealista (2025)
 * - agency 5% - The Sourcing Group (2025)
 */
export const ACQUISITION_RATES = {
  transferTaxITP: 0.1,
  stampDutyAJD: 0.015,
  notaryFee: 0.005,
  registrationFee: 0.003,
  agencyFee: 0.05,
} as const;

/** Bank fee, € one-time / annual account fee. Costs & Income!D64, TSG_Model_v3.xlsx (2026-08). */
export const BANK_FEE = 100;

/** Property tax IBI, share of purchase price per year. Costs & Income!D60; source Investropa (2025), corrected 0.7%->0.4% per Changelog (2026-08). */
export const PROPERTY_TAX_IBI_RATE = 0.004;

/**
 * Renovation strategies. Costs & Income!D68:H84, TSG_Model_v3.xlsx (2026-08).
 * [BESLISSING] CapEx is absolute per strategy; making it a function of
 * area / construction year / energy label is an open decision (MODEL_SPEC.md).
 */
export const RENOVATION_STRATEGIES: Readonly<
  Record<
    RenovationStrategyId,
    {
      label: string;
      capex: number;
      rentMultiplier: number;
      maintenanceFactor: number;
      utilitiesEfficiency: number;
      timeToRentMonths: number;
    }
  >
> = {
  minimal: {
    label: "Strategy A - Minimal",
    capex: 49500,
    rentMultiplier: 0.95,
    maintenanceFactor: 1.2,
    utilitiesEfficiency: 1.05,
    timeToRentMonths: 1,
  },
  light: {
    label: "Strategy B - Light",
    capex: 55000,
    rentMultiplier: 1.0,
    maintenanceFactor: 1.0,
    utilitiesEfficiency: 1.0,
    timeToRentMonths: 2,
  },
  heavy: {
    label: "Strategy C - Heavy",
    capex: 66000,
    rentMultiplier: 1.1,
    maintenanceFactor: 0.85,
    utilitiesEfficiency: 0.9,
    timeToRentMonths: 3,
  },
};

/**
 * Financing strategies. Costs & Income!D101:H110, TSG_Model_v3.xlsx (2026-08).
 * Rates are resident rates; non-residents pay the spread below on top.
 * Reference: Banco Santander (2025), Valencia Property (2023),
 * Traverse Int. Finance (2025).
 */
export const FINANCING_STRATEGIES: Readonly<
  Record<
    FinancingStrategyId,
    {
      label: string;
      ltv: number;
      loanTermYears: number;
      interestRate: number;
      loanType: "amortising";
    }
  >
> = {
  low: {
    label: "Strategy A - Low Leverage",
    ltv: 0.6,
    loanTermYears: 25,
    interestRate: 0.025,
    loanType: "amortising",
  },
  medium: {
    label: "Strategy B - Medium Leverage",
    ltv: 0.7,
    loanTermYears: 20,
    interestRate: 0.0285,
    loanType: "amortising",
  },
  high: {
    label: "Strategy C - High Leverage",
    ltv: 0.75,
    loanTermYears: 15,
    interestRate: 0.032,
    loanType: "amortising",
  },
};

/**
 * Non-resident interest spread. Costs & Income!D124, added per Changelog
 * (2026-08): Dutch buyers are non-resident by definition; 3.5% non-resident
 * vs 2.5% resident (Reference Info K10/K11, sources Banco Santander 2025,
 * Costaluz Lawyers 2025).
 */
export const NON_RESIDENT_INTEREST_SPREAD = 0.01;

/**
 * Scenario layer multipliers. Costs & Income!L62:P70, TSG_Model_v3.xlsx (2026-08).
 * The interest delta is a signed value; every scenario adds it to the
 * selected rate (v3 fixed the optimistic delta to -0.25%).
 */
export const SCENARIOS: Readonly<
  Record<
    ScenarioId,
    {
      rentLevelMultiplier: number;
      occupancyMultiplier: number;
      interestRateDelta: number;
      utilitiesMultiplier: number;
      maintenanceInflationMultiplier: number;
    }
  >
> = {
  conservative: {
    rentLevelMultiplier: 0.9,
    occupancyMultiplier: 0.9,
    interestRateDelta: 0.005,
    utilitiesMultiplier: 1.1,
    maintenanceInflationMultiplier: 1.1,
  },
  base: {
    rentLevelMultiplier: 1.0,
    occupancyMultiplier: 1.0,
    interestRateDelta: 0.0,
    utilitiesMultiplier: 1.0,
    maintenanceInflationMultiplier: 1.0,
  },
  optimistic: {
    rentLevelMultiplier: 1.1,
    occupancyMultiplier: 1.1,
    interestRateDelta: -0.0025,
    utilitiesMultiplier: 0.95,
    maintenanceInflationMultiplier: 0.95,
  },
};

export const SCENARIO_ORDER: readonly ScenarioId[] = [
  "conservative",
  "base",
  "optimistic",
];

/**
 * Rental income tax for non-residents. Reference Info I50/I51;
 * source IberianTax (2025): 19% EU/EEA with deductions, 24% non-EU.
 */
export const RENTAL_INCOME_TAX_RATE_EU = 0.19;
export const RENTAL_INCOME_TAX_RATE_NON_EU = 0.24;

/** Average deductible-cost share used in the Matrices tax matrix. Matrices!P5; source Agencia Tributaria (2025). */
export const AVERAGE_DEDUCTIBLE_COST_SHARE = 0.23;

/**
 * Depreciation: 3% of 80% of the purchase value per year.
 * Reference Info H58; source Agencia Tributaria / IberianTax (2025).
 * This is phase 1's single-year Excel-parity figure only - do not reuse
 * DEPRECIATION_BUILDING_SHARE for the phase 1b multi-year projection, which
 * uses DEFAULT_BUILDING_SHARE_OF_VALUE below instead.
 */
export const DEPRECIATION_RATE = 0.03;
export const DEPRECIATION_BUILDING_SHARE = 0.8;

/**
 * Default building share of the purchase value, for the phase 1b
 * multi-year depreciation base (MODEL_SPEC_FASE1B §5, correction 2).
 *
 * Spanish tax law depreciates 3% per year on the higher of the cadastral
 * building value or the building portion of the acquisition cost,
 * excluding land - not a fixed percentage of the purchase price. Phase 1's
 * 80% (DEPRECIATION_BUILDING_SHARE, above) is the Excel's own fixed
 * convention and is left untouched for Excel parity; it is not a claim
 * about the real building share of this or any property.
 *
 * TODO [BESLISSING]: 0.70 is a generic placeholder, not sourced per
 * property. The real building share must come from that property's valor
 * catastral desglosado (Catastro: the cadastral value split into suelo /
 * construcción) - replace this default with that figure before a report
 * ships for a specific property.
 */
export const DEFAULT_BUILDING_SHARE_OF_VALUE = 0.7;

/**
 * Per-scenario depreciation factors used by the deductible-costs table.
 * Reference Info I59:I61 -> M58/N58/O58 (2026-08): the conservative column
 * uses 0.94x base, the optimistic column 1.04x base. Replicated as-is.
 */
export const DEPRECIATION_SCENARIO_FACTORS: Readonly<Record<ScenarioId, number>> = {
  conservative: 0.94,
  base: 1.0,
  optimistic: 1.04,
};

/**
 * Capital appreciation growth per year. Reference Info J69:J73 (2025):
 * - conservative 4%: below long-run average, market moderation (WTG Spain forecast)
 * - base 5%: BBVA Research forecast +5.3% for 2026, national cooling trend
 * - optimistic 6%: Valencia outperforming Spain, adjusted down (Valencia Property, 2025)
 * Applied compounded to the property value in the multi-year projection.
 */
export const VALUE_GROWTH_ANNUAL: Readonly<Record<ScenarioId, number>> = {
  conservative: 1.04,
  base: 1.05,
  optimistic: 1.06,
};

// ---------------------------------------------------------------------------
// Phase 1b - multi-year projection (MODEL_SPEC_FASE1B §2, §3)
// ---------------------------------------------------------------------------

/**
 * Projection horizon: model 10 years, report the year-5 and year-10 stand
 * (MODEL_SPEC_FASE1B §2). Spanish acquisition costs run to ~13% of the
 * purchase price, so a 5-year-only view flatters a short hold.
 */
export const PROJECTION_YEARS = 10;
export const PROJECTION_INTERIM_YEAR = 5;

/**
 * Rent growth per calendar year, as a multiplier on gross rent.
 * Correction Factors!O26:S26 (row "Rent Price Changes"), TSG_Model_v3.xlsx
 * (2026-08). Sources: Eurostat HICP, Global Property Guide (Spain 2024 rent
 * data), Idealista market outlook, Oxford Economics housing forecasts,
 * European Commission AMECO, BBVA Research.
 *
 * Only the estimate years (2026 and later) are listed: the historical part
 * of that row mixes units (2014-2016 are percentages, 2017+ are multipliers)
 * and is not used for forward projection.
 */
export const RENT_GROWTH_BY_YEAR: Readonly<Record<number, number>> = {
  2026: 1.06,
  2027: 1.05,
  2028: 1.04,
  2029: 1.035,
  2030: 1.03,
};

/**
 * Consumer price inflation per calendar year, in percent.
 * Correction Factors!O12:S12 (row "CPI (YoY%)"), TSG_Model_v3.xlsx (2026-08).
 * Sources: historical FactSet; estimates IMF WEO (Apr 2025) / European
 * Commission Economic Forecasts (Spring 2024).
 * Applied to maintenance, utilities, insurance and bank fees.
 */
export const CPI_PERCENT_BY_YEAR: Readonly<Record<number, number>> = {
  2026: 2.0,
  2027: 2.2,
  2028: 2.1,
  2029: 2.0,
  2030: 2.0,
};

/**
 * Last calendar year covered by the Correction Factors series. Beyond it the
 * projection carries the last known value forward and flags those years as
 * extrapolated (MODEL_SPEC_FASE1B §3: never extend the series silently).
 */
export const CORRECTION_FACTORS_LAST_YEAR = 2030;

/**
 * First estimate year in the Correction Factors series, used as the default
 * first projection year. Not a source value - a modelling convention, so it
 * is stated here rather than hidden in the projection code.
 */
export const CORRECTION_FACTORS_FIRST_ESTIMATE_YEAR = 2026;
