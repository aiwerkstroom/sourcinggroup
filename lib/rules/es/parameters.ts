/**
 * TSG Yield Engine - Spain (ES) parameters.
 *
 * Hard rule: no hardcoded numbers in the calculation layer. Every value
 * lives here, with a provenance audit (SOURCED / ESTIMATE / PLACEHOLDER,
 * see types.ts `Parameter<T>`) attached to its type, not buried in a
 * comment - so a computation can inspect which parameters it drew on and
 * flag the ones still resting on an unverified PLACEHOLDER (outcome.ts).
 *
 * The single source of truth for the Excel-parity figures is the
 * corrected Excel model TSG_Model_v3.xlsx (2026-08); cell references and
 * the original external sources are noted per value. Where no external
 * citation exists and the number was in genuine doubt between ESTIMATE and
 * PLACEHOLDER, it was assigned PLACEHOLDER - never the more flattering
 * label.
 *
 * Values marked [BESLISSING] in MODEL_SPEC.md are open product decisions
 * and must not be changed here without sign-off by Samuel.
 */

import { deriveParameter } from "./types";
import type {
  EstimateParameter,
  FeasibilityScoreLevels,
  FinancingStrategyId,
  Parameter,
  PlaceholderParameter,
  RenovationStrategyId,
  ScenarioId,
  ScoreAnchor,
  SourcedParameter,
  TsgScoreDimension,
} from "./types";

// ---------------------------------------------------------------------------
// Rent
// ---------------------------------------------------------------------------

/**
 * Long-term rent price points €/m²/month - the columns of the Excel's own
 * rent matrix (Matrices!D8:J8). No external market citation exists for
 * these specific price points (unlike NEIGHBORHOOD_RENT_LONG_TERM below,
 * which does); origin is the Excel author's own grid.
 */
export const RENT_MATRIX_LONG_TERM_PER_M2: PlaceholderParameter<readonly number[]> = {
  name: "RENT_MATRIX_LONG_TERM_PER_M2",
  value: [9, 13.5, 15, 17, 21, 22.5, 25],
  provenance: "PLACEHOLDER",
  reasoning:
    "Matrices!D8:J8, TSG_Model_v3.xlsx (2026-08). No external source cited for these specific price points; not currently consumed by any calculation (reference data for a future rent-selection UI).",
};

/** Short-term rent price points €/m²/month. Matrices!D21:J21 - same origin and caveats as RENT_MATRIX_LONG_TERM_PER_M2. */
export const RENT_MATRIX_SHORT_TERM_PER_M2: PlaceholderParameter<readonly number[]> = {
  name: "RENT_MATRIX_SHORT_TERM_PER_M2",
  value: [15, 24, 30, 36, 40, 43, 45],
  provenance: "PLACEHOLDER",
  reasoning:
    "Matrices!D21:J21, TSG_Model_v3.xlsx (2026-08). No external source cited for these specific price points; not currently consumed by any calculation.",
};

/**
 * Neighborhood reference table, Valencia, €/m²/month long-term.
 * Reference Info B10:D25.
 */
export const NEIGHBORHOOD_RENT_LONG_TERM: SourcedParameter<Readonly<Record<string, number>>> = {
  name: "NEIGHBORHOOD_RENT_LONG_TERM",
  value: {
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
  },
  provenance: "SOURCED",
  source: "Idealista, Fotocasa/Cadena SER, Investropa, Idealista Listings",
  date: "2025",
};

/**
 * Neighborhood reference table, Valencia, €/m²/month short-term.
 * Reference Info B29:D41. Short-term prices average ~1.7x long-term
 * (Reference Info B46, 2025); the model uses its own short-term table
 * below rather than deriving it with that multiplier.
 */
export const NEIGHBORHOOD_RENT_SHORT_TERM: SourcedParameter<Readonly<Record<string, number>>> = {
  name: "NEIGHBORHOOD_RENT_SHORT_TERM",
  value: {
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
  },
  provenance: "SOURCED",
  source: "Idealista, Investropa",
  date: "2025",
};

/**
 * Base occupancy, long-term. Matrices!B16 via Costs & Income!L14 - a claim
 * about the real market (how occupied a long-term rental actually runs),
 * not a model definition, so it takes the reality-claim test: SOURCED or
 * PLACEHOLDER only. No external vacancy-rate citation is tied to this
 * figure (the workbook's own macro vacancy-rate series, Correction
 * Factors, is not wired into it) - PLACEHOLDER.
 */
export const BASE_OCCUPANCY_LONG_TERM: PlaceholderParameter<number> = {
  name: "BASE_OCCUPANCY_LONG_TERM",
  value: 0.9,
  provenance: "PLACEHOLDER",
  reasoning:
    "Excel's own long-term occupancy baseline (Matrices!B16), TSG_Model_v3.xlsx (2026-08). A real-world market claim (achievable occupancy), not a model definition, with no external vacancy-rate citation tied to this figure.",
};

/** Base occupancy, short-term. Matrices!B29 via Costs & Income!N14 - same reality-claim status as BASE_OCCUPANCY_LONG_TERM. */
export const BASE_OCCUPANCY_SHORT_TERM: PlaceholderParameter<number> = {
  name: "BASE_OCCUPANCY_SHORT_TERM",
  value: 0.6,
  provenance: "PLACEHOLDER",
  reasoning:
    "Excel's own short-term occupancy baseline (Matrices!B29), TSG_Model_v3.xlsx (2026-08). A real-world market claim (achievable occupancy), not a model definition, with no external vacancy-rate citation tied to this figure.",
};

/** Hybrid allocation: how the model defines "hybrid" as a 60/40 LT/ST blend. Costs & Income!L26/L28. */
export const HYBRID_SHARE_LONG_TERM: EstimateParameter<number> = {
  name: "HYBRID_SHARE_LONG_TERM",
  value: 0.6,
  provenance: "ESTIMATE",
  reasoning:
    "Costs & Income!L26, TSG_Model_v3.xlsx (2026-08). Defines what 'hybrid' means in this model rather than reporting an external fact.",
};

/** Hybrid allocation, short-term share. Costs & Income!L28. */
export const HYBRID_SHARE_SHORT_TERM: EstimateParameter<number> = {
  name: "HYBRID_SHARE_SHORT_TERM",
  value: 0.4,
  provenance: "ESTIMATE",
  reasoning:
    "Costs & Income!L28, TSG_Model_v3.xlsx (2026-08). Defines what 'hybrid' means in this model rather than reporting an external fact.",
};

/**
 * Ratio of usable floor area (superficie útil) to built floor area
 * (superficie construida), used only to derive PropertyInput.usableAreaM2
 * when a property's usable area is not known directly and must be
 * approximated from its built area. A claim about the real relationship
 * between two physical measurements of an actual building, not a model
 * definition - the reality-vs-model test (see ParameterProvenance in
 * types.ts) puts this at PLACEHOLDER, not ESTIMATE: no external source is
 * cited for this specific figure, and the true ratio varies per building
 * (wall thickness, shared circulation space). MODEL_SPEC.md §17.
 */
export const DEFAULT_USABLE_TO_BUILT_AREA_RATIO: PlaceholderParameter<number> = {
  name: "DEFAULT_USABLE_TO_BUILT_AREA_RATIO",
  value: 0.85,
  provenance: "PLACEHOLDER",
  reasoning:
    "Common rule-of-thumb for the usable/built area ratio in Spanish residential property (built area includes shared walls and common circulation space); no external source cited for this specific figure, and it varies per building. Must be replaced by the property's own usableAreaM2 (floor plan or cadastral record) before production use.",
};

// ---------------------------------------------------------------------------
// Fixed operating costs
// ---------------------------------------------------------------------------

/** Annual insurance costs, € per year. Costs & Income!F31:F37. */
export const INSURANCE_COSTS_ANNUAL: SourcedParameter<{
  home: number;
  contents: number;
  landlord: number;
  life: number;
}> = {
  name: "INSURANCE_COSTS_ANNUAL",
  value: { home: 300, contents: 180, landlord: 250, life: 300 },
  provenance: "SOURCED",
  source: "Expatica, MovingToSpain, MyInsuranceSpain, Caixabank",
  date: "2024-2025",
};

/**
 * Sum of INSURANCE_COSTS_ANNUAL's components. Provenance is derived, not
 * hand-typed: deriveParameter() takes the weakest label among its
 * components (here just INSURANCE_COSTS_ANNUAL, SOURCED), so this total
 * cannot silently stay SOURCED if that component is ever downgraded.
 */
export const TOTAL_INSURANCE_ANNUAL: Parameter<number> = deriveParameter(
  "TOTAL_INSURANCE_ANNUAL",
  INSURANCE_COSTS_ANNUAL.value.home +
    INSURANCE_COSTS_ANNUAL.value.contents +
    INSURANCE_COSTS_ANNUAL.value.landlord +
    INSURANCE_COSTS_ANNUAL.value.life,
  [INSURANCE_COSTS_ANNUAL],
);

/** Property management fee, share of gross rent. Costs & Income!F42; corrected 5%->8% per Changelog (2026-08). */
export const PROPERTY_MANAGEMENT_FEE: SourcedParameter<number> = {
  name: "PROPERTY_MANAGEMENT_FEE",
  value: 0.08,
  provenance: "SOURCED",
  source: "Wise",
  date: "2025",
};

/** Legal advice fee, share of purchase price. Costs & Income!F44; corrected 0.5%->1% per Changelog (2026-08). */
export const LEGAL_ADVICE_FEE: SourcedParameter<number> = {
  name: "LEGAL_ADVICE_FEE",
  value: 0.01,
  provenance: "SOURCED",
  source: "Idealista",
  date: "2025",
};

/** Maintenance, share of gross rent. Costs & Income!F46 - no external citation for this rate. */
export const MAINTENANCE_RATE: PlaceholderParameter<number> = {
  name: "MAINTENANCE_RATE",
  value: 0.05,
  provenance: "PLACEHOLDER",
  reasoning:
    "Costs & Income!F46, TSG_Model_v3.xlsx (2026-08). No external source cited; maintenance cost as a share of rent varies materially with a property's age and condition, so this generic figure should be validated per property before production use.",
};

/** Utilities base €/m²/year. Costs & Income!H54:H58. */
export const UTILITIES_PER_M2_ANNUAL: SourcedParameter<{
  gas: number;
  water: number;
  electricity: number;
}> = {
  name: "UTILITIES_PER_M2_ANNUAL",
  value: { gas: 8, water: 3.5, electricity: 10 },
  provenance: "SOURCED",
  source: "CNMC/Eurostat, Globexs, IDAE/Eurostat",
  date: "2024-2025",
};

/**
 * Sum of UTILITIES_PER_M2_ANNUAL's components. Provenance is derived, not
 * hand-typed - see the comment on TOTAL_INSURANCE_ANNUAL above.
 */
export const TOTAL_UTILITIES_PER_M2_ANNUAL: Parameter<number> = deriveParameter(
  "TOTAL_UTILITIES_PER_M2_ANNUAL",
  UTILITIES_PER_M2_ANNUAL.value.gas +
    UTILITIES_PER_M2_ANNUAL.value.water +
    UTILITIES_PER_M2_ANNUAL.value.electricity,
  [UTILITIES_PER_M2_ANNUAL],
);

/** Bank fee, € one-time / annual account fee. Costs & Income!D64 - no external citation; real bank fees vary by institution. */
export const BANK_FEE: PlaceholderParameter<number> = {
  name: "BANK_FEE",
  value: 100,
  provenance: "PLACEHOLDER",
  reasoning:
    "Costs & Income!D64, TSG_Model_v3.xlsx (2026-08). No external source cited; actual bank account fees vary by institution and should be confirmed per deal.",
};

/** Property tax IBI, share of purchase price per year. Costs & Income!D60; corrected 0.7%->0.4% per Changelog (2026-08). */
export const PROPERTY_TAX_IBI_RATE: SourcedParameter<number> = {
  name: "PROPERTY_TAX_IBI_RATE",
  value: 0.004,
  provenance: "SOURCED",
  source: "Investropa",
  date: "2025",
};

/**
 * IBI is actually levied on the cadastral value (valor catastral), not the
 * purchase price - Spanish cadastral values are administratively set and
 * commonly diverge from market price, with no universal, sourced ratio
 * between the two. Absent a property's real PropertyInput.cadastralValue
 * (MODEL_SPEC.md §16), this model assumes a 1:1 ratio - the purchase price
 * stands in directly for the IBI base - purely to keep the estimate
 * computable, not as a claim that cadastral value equals purchase price.
 * Superseded automatically once cadastralValue is supplied.
 */
export const DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO: PlaceholderParameter<number> = {
  name: "DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO",
  value: 1.0,
  provenance: "PLACEHOLDER",
  reasoning:
    "No universal, sourced ratio exists between a property's valor catastral and its market/purchase price. Absent a real cadastral value, this model assumes 1:1 purely to keep the IBI estimate computable - a placeholder, not a market claim.",
};

// ---------------------------------------------------------------------------
// Acquisition costs
// ---------------------------------------------------------------------------

/**
 * Acquisition cost rates, share of purchase price (Spain, existing build).
 * Costs & Income!D50:D58 after the Changelog corrections (2026-08) that
 * aligned them with Reference Info (the leading set). ITP and AJD are
 * statutory tax rates; notary, registration and agency fees are market
 * rates from the cited sources.
 */
export const ACQUISITION_RATES: SourcedParameter<{
  transferTaxITP: number;
  stampDutyAJD: number;
  notaryFee: number;
  registrationFee: number;
  agencyFee: number;
}> = {
  name: "ACQUISITION_RATES",
  value: {
    transferTaxITP: 0.1,
    stampDutyAJD: 0.015,
    notaryFee: 0.005,
    registrationFee: 0.003,
    agencyFee: 0.05,
  },
  provenance: "SOURCED",
  source: "Monserrate Inmobiliaria (ITP), Idealista (AJD, notary, registration), The Sourcing Group (agency fee)",
  date: "2025",
};

// ---------------------------------------------------------------------------
// Renovation strategies
// ---------------------------------------------------------------------------

interface RenovationStrategyParameters {
  label: string;
  /** [BESLISSING] absolute per strategy; MODEL_SPEC.md flags this as needing to become a function of area/construction year/energy label. */
  capex: PlaceholderParameter<number>;
  /** Claims a real-world consequence of the renovation (effect on achievable rent), not a tier definition - reality-claim test applies. */
  rentMultiplier: PlaceholderParameter<number>;
  /** Claims a real-world consequence (effect on maintenance cost) - reality-claim test applies. */
  maintenanceFactor: PlaceholderParameter<number>;
  /** Claims a real-world consequence (effect on utility costs) - reality-claim test applies. */
  utilitiesEfficiency: PlaceholderParameter<number>;
  /** Claims a real-world consequence (how long the renovation actually takes) - reality-claim test applies. */
  timeToRentMonths: PlaceholderParameter<number>;
}

/**
 * Renovation strategies. Costs & Income!D68:H84, TSG_Model_v3.xlsx
 * (2026-08).
 *
 * Herclassificatie (reality-vs-model test): CapEx and the four
 * multipliers all claim a real-world consequence of doing this
 * renovation (cost, rent effect, maintenance effect, utilities effect,
 * lease-up time) - none of them define what "minimal/light/heavy" MEANS
 * as a product tier the way e.g. a financing tier's LTV does. All five
 * are PLACEHOLDER: no external source backs any of them.
 */
export const RENOVATION_STRATEGIES: Readonly<
  Record<RenovationStrategyId, RenovationStrategyParameters>
> = {
  minimal: {
    label: "Strategy A - Minimal",
    capex: {
      name: "RENOVATION_STRATEGIES.minimal.capex",
      value: 49500,
      provenance: "PLACEHOLDER",
      reasoning:
        "Costs & Income!D70, TSG_Model_v3.xlsx (2026-08). No external cost-estimation source; MODEL_SPEC.md flags CapEx as needing to become a function of area/construction year/energy label.",
    },
    rentMultiplier: {
      name: "RENOVATION_STRATEGIES.minimal.rentMultiplier",
      value: 0.95,
      provenance: "PLACEHOLDER",
      reasoning: "Costs & Income!D79, TSG_Model_v3.xlsx (2026-08). Claims a real-world rent effect of minimal renovation; no external source cited.",
    },
    maintenanceFactor: {
      name: "RENOVATION_STRATEGIES.minimal.maintenanceFactor",
      value: 1.2,
      provenance: "PLACEHOLDER",
      reasoning: "Costs & Income!D82, TSG_Model_v3.xlsx (2026-08). Claims a real-world maintenance-cost effect of minimal renovation; no external source cited.",
    },
    utilitiesEfficiency: {
      name: "RENOVATION_STRATEGIES.minimal.utilitiesEfficiency",
      value: 1.05,
      provenance: "PLACEHOLDER",
      reasoning: "Costs & Income!D84, TSG_Model_v3.xlsx (2026-08). Claims a real-world utilities-cost effect of minimal renovation; no external source cited.",
    },
    timeToRentMonths: {
      name: "RENOVATION_STRATEGIES.minimal.timeToRentMonths",
      value: 1,
      provenance: "PLACEHOLDER",
      reasoning: "Costs & Income!D76, TSG_Model_v3.xlsx (2026-08). Claims a real-world lease-up duration for minimal renovation; no external source cited.",
    },
  },
  light: {
    label: "Strategy B - Light",
    capex: {
      name: "RENOVATION_STRATEGIES.light.capex",
      value: 55000,
      provenance: "PLACEHOLDER",
      reasoning:
        "Costs & Income!F70, TSG_Model_v3.xlsx (2026-08). No external cost-estimation source; MODEL_SPEC.md flags CapEx as needing to become a function of area/construction year/energy label.",
    },
    rentMultiplier: {
      name: "RENOVATION_STRATEGIES.light.rentMultiplier",
      value: 1.0,
      provenance: "PLACEHOLDER",
      reasoning: "Costs & Income!F79, TSG_Model_v3.xlsx (2026-08). Claims a real-world rent effect of light renovation; no external source cited.",
    },
    maintenanceFactor: {
      name: "RENOVATION_STRATEGIES.light.maintenanceFactor",
      value: 1.0,
      provenance: "PLACEHOLDER",
      reasoning: "Costs & Income!F82, TSG_Model_v3.xlsx (2026-08). Claims a real-world maintenance-cost effect of light renovation; no external source cited.",
    },
    utilitiesEfficiency: {
      name: "RENOVATION_STRATEGIES.light.utilitiesEfficiency",
      value: 1.0,
      provenance: "PLACEHOLDER",
      reasoning: "Costs & Income!F84, TSG_Model_v3.xlsx (2026-08). Claims a real-world utilities-cost effect of light renovation; no external source cited.",
    },
    timeToRentMonths: {
      name: "RENOVATION_STRATEGIES.light.timeToRentMonths",
      value: 2,
      provenance: "PLACEHOLDER",
      reasoning: "Costs & Income!F76, TSG_Model_v3.xlsx (2026-08). Claims a real-world lease-up duration for light renovation; no external source cited.",
    },
  },
  heavy: {
    label: "Strategy C - Heavy",
    capex: {
      name: "RENOVATION_STRATEGIES.heavy.capex",
      value: 66000,
      provenance: "PLACEHOLDER",
      reasoning:
        "Costs & Income!H70, TSG_Model_v3.xlsx (2026-08). No external cost-estimation source; MODEL_SPEC.md flags CapEx as needing to become a function of area/construction year/energy label.",
    },
    rentMultiplier: {
      name: "RENOVATION_STRATEGIES.heavy.rentMultiplier",
      value: 1.1,
      provenance: "PLACEHOLDER",
      reasoning: "Costs & Income!H79, TSG_Model_v3.xlsx (2026-08). Claims a real-world rent effect of heavy renovation; no external source cited.",
    },
    maintenanceFactor: {
      name: "RENOVATION_STRATEGIES.heavy.maintenanceFactor",
      value: 0.85,
      provenance: "PLACEHOLDER",
      reasoning: "Costs & Income!H82, TSG_Model_v3.xlsx (2026-08). Claims a real-world maintenance-cost effect of heavy renovation; no external source cited.",
    },
    utilitiesEfficiency: {
      name: "RENOVATION_STRATEGIES.heavy.utilitiesEfficiency",
      value: 0.9,
      provenance: "PLACEHOLDER",
      reasoning: "Costs & Income!H84, TSG_Model_v3.xlsx (2026-08). Claims a real-world utilities-cost effect of heavy renovation; no external source cited.",
    },
    timeToRentMonths: {
      name: "RENOVATION_STRATEGIES.heavy.timeToRentMonths",
      value: 3,
      provenance: "PLACEHOLDER",
      reasoning: "Costs & Income!H76, TSG_Model_v3.xlsx (2026-08). Claims a real-world lease-up duration for heavy renovation; no external source cited.",
    },
  },
};

// ---------------------------------------------------------------------------
// Financing strategies
// ---------------------------------------------------------------------------

interface FinancingStrategyParameters {
  label: string;
  /** TSG's own three leverage tiers, not an external fact. */
  ltv: EstimateParameter<number>;
  loanTermYears: EstimateParameter<number>;
  interestRate: SourcedParameter<number>;
  loanType: "amortising";
}

/**
 * Financing strategies. Costs & Income!D101:H110, TSG_Model_v3.xlsx
 * (2026-08). Rates are resident rates; non-residents pay
 * NON_RESIDENT_INTEREST_SPREAD on top. LTV and loan term define TSG's own
 * three product tiers (ESTIMATE); the interest rate is tied to cited bank
 * rate sources (SOURCED).
 */
export const FINANCING_STRATEGIES: Readonly<
  Record<FinancingStrategyId, FinancingStrategyParameters>
> = {
  low: {
    label: "Strategy A - Low Leverage",
    ltv: {
      name: "FINANCING_STRATEGIES.low.ltv",
      value: 0.6,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!D106. TSG's own 'low leverage' tier definition, not an external fact.",
    },
    loanTermYears: {
      name: "FINANCING_STRATEGIES.low.loanTermYears",
      value: 25,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!D104. TSG's own 'low leverage' tier definition, not an external fact.",
    },
    interestRate: {
      name: "FINANCING_STRATEGIES.low.interestRate",
      value: 0.025,
      provenance: "SOURCED",
      source: "Banco Santander, Valencia Property, Traverse Int. Finance",
      date: "2023-2025",
    },
    loanType: "amortising",
  },
  medium: {
    label: "Strategy B - Medium Leverage",
    ltv: {
      name: "FINANCING_STRATEGIES.medium.ltv",
      value: 0.7,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!F106. TSG's own 'medium leverage' tier definition, not an external fact.",
    },
    loanTermYears: {
      name: "FINANCING_STRATEGIES.medium.loanTermYears",
      value: 20,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!F104. TSG's own 'medium leverage' tier definition, not an external fact.",
    },
    interestRate: {
      name: "FINANCING_STRATEGIES.medium.interestRate",
      value: 0.0285,
      provenance: "SOURCED",
      source: "Banco Santander, Valencia Property, Traverse Int. Finance",
      date: "2023-2025",
    },
    loanType: "amortising",
  },
  high: {
    label: "Strategy C - High Leverage",
    ltv: {
      name: "FINANCING_STRATEGIES.high.ltv",
      value: 0.75,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!H106. TSG's own 'high leverage' tier definition, not an external fact.",
    },
    loanTermYears: {
      name: "FINANCING_STRATEGIES.high.loanTermYears",
      value: 15,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!H104. TSG's own 'high leverage' tier definition, not an external fact.",
    },
    interestRate: {
      name: "FINANCING_STRATEGIES.high.interestRate",
      value: 0.032,
      provenance: "SOURCED",
      source: "Banco Santander, Valencia Property, Traverse Int. Finance",
      date: "2023-2025",
    },
    loanType: "amortising",
  },
};

/**
 * Non-resident interest spread. Costs & Income!D124, added per Changelog
 * (2026-08): Dutch buyers are non-resident by definition; 3.5%
 * non-resident vs 2.5% resident.
 */
export const NON_RESIDENT_INTEREST_SPREAD: SourcedParameter<number> = {
  name: "NON_RESIDENT_INTEREST_SPREAD",
  value: 0.01,
  provenance: "SOURCED",
  source: "Banco Santander, Costaluz Lawyers (Reference Info K10/K11)",
  date: "2025",
};

// ---------------------------------------------------------------------------
// Scenario layer
// ---------------------------------------------------------------------------

interface ScenarioParameters {
  rentLevelMultiplier: EstimateParameter<number>;
  occupancyMultiplier: EstimateParameter<number>;
  interestRateDelta: EstimateParameter<number>;
  utilitiesMultiplier: EstimateParameter<number>;
  maintenanceInflationMultiplier: EstimateParameter<number>;
}

/**
 * Scenario layer multipliers. Costs & Income!L62:P70, TSG_Model_v3.xlsx
 * (2026-08). TSG's own definition of what "conservative/base/optimistic"
 * mean - a deliberate modeling convention, not external data. The
 * interest delta is signed; every scenario adds it to the selected rate
 * (v3 fixed the optimistic delta to -0.25%).
 */
export const SCENARIOS: Readonly<Record<ScenarioId, ScenarioParameters>> = {
  conservative: {
    rentLevelMultiplier: {
      name: "SCENARIOS.conservative.rentLevelMultiplier",
      value: 0.9,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!L62. Defines the conservative scenario in this model.",
    },
    occupancyMultiplier: {
      name: "SCENARIOS.conservative.occupancyMultiplier",
      value: 0.9,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!L64. Defines the conservative scenario in this model.",
    },
    interestRateDelta: {
      name: "SCENARIOS.conservative.interestRateDelta",
      value: 0.005,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!L66. Defines the conservative scenario in this model.",
    },
    utilitiesMultiplier: {
      name: "SCENARIOS.conservative.utilitiesMultiplier",
      value: 1.1,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!L68. Defines the conservative scenario in this model.",
    },
    maintenanceInflationMultiplier: {
      name: "SCENARIOS.conservative.maintenanceInflationMultiplier",
      value: 1.1,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!L70. Defines the conservative scenario in this model.",
    },
  },
  base: {
    rentLevelMultiplier: {
      name: "SCENARIOS.base.rentLevelMultiplier",
      value: 1.0,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!N62. Defines the base scenario in this model.",
    },
    occupancyMultiplier: {
      name: "SCENARIOS.base.occupancyMultiplier",
      value: 1.0,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!N64. Defines the base scenario in this model.",
    },
    interestRateDelta: {
      name: "SCENARIOS.base.interestRateDelta",
      value: 0.0,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!N66. Defines the base scenario in this model.",
    },
    utilitiesMultiplier: {
      name: "SCENARIOS.base.utilitiesMultiplier",
      value: 1.0,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!N68. Defines the base scenario in this model.",
    },
    maintenanceInflationMultiplier: {
      name: "SCENARIOS.base.maintenanceInflationMultiplier",
      value: 1.0,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!N70. Defines the base scenario in this model.",
    },
  },
  optimistic: {
    rentLevelMultiplier: {
      name: "SCENARIOS.optimistic.rentLevelMultiplier",
      value: 1.1,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!P62. Defines the optimistic scenario in this model.",
    },
    occupancyMultiplier: {
      name: "SCENARIOS.optimistic.occupancyMultiplier",
      value: 1.1,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!P64. Defines the optimistic scenario in this model.",
    },
    interestRateDelta: {
      name: "SCENARIOS.optimistic.interestRateDelta",
      value: -0.0025,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!P66 (v3-corrected sign). Defines the optimistic scenario in this model.",
    },
    utilitiesMultiplier: {
      name: "SCENARIOS.optimistic.utilitiesMultiplier",
      value: 0.95,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!P68. Defines the optimistic scenario in this model.",
    },
    maintenanceInflationMultiplier: {
      name: "SCENARIOS.optimistic.maintenanceInflationMultiplier",
      value: 0.95,
      provenance: "ESTIMATE",
      reasoning: "Costs & Income!P70. Defines the optimistic scenario in this model.",
    },
  },
};

export const SCENARIO_ORDER: readonly ScenarioId[] = ["conservative", "base", "optimistic"];

// ---------------------------------------------------------------------------
// Taxes
// ---------------------------------------------------------------------------

/** Rental income tax for non-residents. Reference Info I50/I51: 19% EU/EEA with deductions, 24% non-EU. */
export const RENTAL_INCOME_TAX_RATE_EU: SourcedParameter<number> = {
  name: "RENTAL_INCOME_TAX_RATE_EU",
  value: 0.19,
  provenance: "SOURCED",
  source: "IberianTax",
  date: "2025",
};

export const RENTAL_INCOME_TAX_RATE_NON_EU: SourcedParameter<number> = {
  name: "RENTAL_INCOME_TAX_RATE_NON_EU",
  value: 0.24,
  provenance: "SOURCED",
  source: "IberianTax",
  date: "2025",
};

/**
 * Capital gains tax on the sale of Spanish property by a non-resident: a
 * flat 19% on the net gain, regardless of EU/non-EU status - unlike the
 * rental income tax above, which splits 19%/24%. MODEL_SPEC_FASE1B §5.
 */
export const CAPITAL_GAINS_TAX_RATE_NON_RESIDENT: SourcedParameter<number> = {
  name: "CAPITAL_GAINS_TAX_RATE_NON_RESIDENT",
  value: 0.19,
  provenance: "SOURCED",
  source: "Agencia Tributaria / IRNR",
  date: "2025",
};

/**
 * Non-resident withholding on the sale price (Modelo 211), retained by the
 * buyer at completion. An advance on the capital gains tax above, settled
 * via the seller's Modelo 210 filing - not an additional cost.
 * MODEL_SPEC_FASE1B §5.
 */
export const NON_RESIDENT_WITHHOLDING_RATE: SourcedParameter<number> = {
  name: "NON_RESIDENT_WITHHOLDING_RATE",
  value: 0.03,
  provenance: "SOURCED",
  source: "Agencia Tributaria",
  date: "2025",
};

/**
 * Default share of renovation CapEx treated as "mejora" (capital
 * improvement) for the acquisition value used in the capital gains tax
 * calculation. Under Spanish non-resident tax rules (IRNR; Agencia
 * Tributaria, "valor de adquisición ... se incrementará en el importe de
 * las inversiones y mejoras efectuadas"), only genuine improvements raise
 * the acquisition value - routine repairs and maintenance do not.
 *
 * Default 0: without a documented split between "mejora" and repair for
 * the actual renovation work, the conservative assumption is that none of
 * it qualifies (a false 0% cannot overstate the deduction the way a
 * guessed nonzero share could). TODO [BESLISSING]: the real share must be
 * substantiated per property from the renovation invoices/scope, not
 * assumed - do not fill in a nonzero default here.
 */
export const DEFAULT_RENOVATION_IMPROVEMENT_SHARE: PlaceholderParameter<number> = {
  name: "DEFAULT_RENOVATION_IMPROVEMENT_SHARE",
  value: 0,
  provenance: "PLACEHOLDER",
  reasoning:
    "No documented split between 'mejora' and repair for the actual renovation work. 0 is the safe default (cannot overstate the deduction); the real share must be substantiated per property from the renovation invoices/scope before it is changed.",
};

/**
 * Default minimum required IRR used to judge a scenario's return
 * (MODEL_SPEC_FASE1B §7). This is the investor's hurdle rate / opportunity
 * cost - what they could earn elsewhere - and has no universal value.
 *
 * Default 0: a 0% hurdle is the weakest possible bar (any non-negative
 * IRR passes), chosen for the same reason as
 * DEFAULT_RENOVATION_IMPROVEMENT_SHARE above - it cannot manufacture a
 * pass that a real hurdle rate would fail. TODO [BESLISSING]: the real
 * figure should come from InvestorConstraints.minRoiTarget when the
 * investor has stated one; this constant is only the fallback when they
 * have not.
 */
export const DEFAULT_MIN_REQUIRED_RETURN: PlaceholderParameter<number> = {
  name: "DEFAULT_MIN_REQUIRED_RETURN",
  value: 0,
  provenance: "PLACEHOLDER",
  reasoning:
    "No universal hurdle rate exists. 0% is the weakest possible bar, chosen so it cannot manufacture a pass a real hurdle rate would fail. Use InvestorConstraints.minRoiTarget when the investor has stated a real figure.",
};

/** Average deductible-cost share used in the Matrices tax matrix. Matrices!P5. */
export const AVERAGE_DEDUCTIBLE_COST_SHARE: SourcedParameter<number> = {
  name: "AVERAGE_DEDUCTIBLE_COST_SHARE",
  value: 0.23,
  provenance: "SOURCED",
  source: "Agencia Tributaria",
  date: "2025",
};

/**
 * Depreciation rate: 3% per year, the statutory Spanish rate.
 * Reference Info H58.
 */
export const DEPRECIATION_RATE: SourcedParameter<number> = {
  name: "DEPRECIATION_RATE",
  value: 0.03,
  provenance: "SOURCED",
  source: "Agencia Tributaria / IberianTax",
  date: "2025",
};

/**
 * Depreciation building share used ONLY for phase 1's single-year
 * Excel-parity figure (tax.ts) - it exists to reproduce TSG_Model_v3.xlsx
 * exactly, not to claim this is the real building share of any property.
 * Do not reuse for the phase 1b multi-year projection, which uses
 * DEFAULT_BUILDING_SHARE_OF_VALUE below instead.
 */
export const DEPRECIATION_BUILDING_SHARE: PlaceholderParameter<number> = {
  name: "DEPRECIATION_BUILDING_SHARE",
  value: 0.8,
  provenance: "PLACEHOLDER",
  reasoning:
    "Reference Info H58, TSG_Model_v3.xlsx (2026-08): the Excel's own fixed convention, kept only for Excel-parity testing (tax.ts). Not a claim about the real building share of this or any property.",
};

/**
 * Default building share of the purchase value, for the phase 1b
 * multi-year depreciation base (MODEL_SPEC_FASE1B §5, correction 2).
 *
 * Spanish tax law depreciates 3% per year on the higher of the cadastral
 * building value or the building portion of the acquisition cost,
 * excluding land - not a fixed percentage of the purchase price.
 *
 * TODO [BESLISSING]: 0.70 is a generic placeholder, not sourced per
 * property. The real building share must come from that property's valor
 * catastral desglosado (Catastro: the cadastral value split into suelo /
 * construcción) - replace this default with that figure before a report
 * ships for a specific property. See also CADASTRAL_VALUE_TO_BUILDING_SHARE
 * (§4 correction): when a property's cadastral value is known, prefer
 * deriving the depreciation base from it directly instead of this share.
 */
export const DEFAULT_BUILDING_SHARE_OF_VALUE: PlaceholderParameter<number> = {
  name: "DEFAULT_BUILDING_SHARE_OF_VALUE",
  value: 0.7,
  provenance: "PLACEHOLDER",
  reasoning:
    "Generic placeholder, not sourced per property. The real building share must come from the property's valor catastral desglosado (Catastro) before a report ships for a specific property.",
};

/**
 * Per-scenario depreciation factors used by the phase-1 deductible-costs
 * table. Reference Info I59:I61 -> M58/N58/O58: replicated from the Excel
 * as-is. The Excel does not explain how these specific factors were
 * derived, so - genuinely in doubt between ESTIMATE and PLACEHOLDER -
 * this is PLACEHOLDER.
 */
export const DEPRECIATION_SCENARIO_FACTORS: Readonly<
  Record<ScenarioId, PlaceholderParameter<number>>
> = {
  conservative: {
    name: "DEPRECIATION_SCENARIO_FACTORS.conservative",
    value: 0.94,
    provenance: "PLACEHOLDER",
    reasoning:
      "Reference Info I59, TSG_Model_v3.xlsx (2026-08). Replicated from the Excel as-is; the workbook does not explain the derivation of this factor.",
  },
  base: {
    name: "DEPRECIATION_SCENARIO_FACTORS.base",
    value: 1.0,
    provenance: "PLACEHOLDER",
    reasoning:
      "Reference Info I60, TSG_Model_v3.xlsx (2026-08). Replicated from the Excel as-is; the workbook does not explain the derivation of this factor.",
  },
  optimistic: {
    name: "DEPRECIATION_SCENARIO_FACTORS.optimistic",
    value: 1.04,
    provenance: "PLACEHOLDER",
    reasoning:
      "Reference Info I61, TSG_Model_v3.xlsx (2026-08). Replicated from the Excel as-is; the workbook does not explain the derivation of this factor.",
  },
};

/**
 * Capital appreciation growth per year.
 * - conservative 4%: below long-run average, market moderation (WTG Spain forecast)
 * - base 5%: BBVA Research forecast +5.3% for 2026, national cooling trend
 * - optimistic 6%: Valencia outperforming Spain, adjusted down (Valencia Property)
 * Applied compounded to the property value in the multi-year projection.
 */
export const VALUE_GROWTH_ANNUAL: Readonly<Record<ScenarioId, SourcedParameter<number>>> = {
  conservative: {
    name: "VALUE_GROWTH_ANNUAL.conservative",
    value: 1.04,
    provenance: "SOURCED",
    source: "WTG Spain forecast",
    date: "2025",
  },
  base: {
    name: "VALUE_GROWTH_ANNUAL.base",
    value: 1.05,
    provenance: "SOURCED",
    source: "BBVA Research",
    date: "2025-05",
  },
  optimistic: {
    name: "VALUE_GROWTH_ANNUAL.optimistic",
    value: 1.06,
    provenance: "SOURCED",
    source: "Valencia Property",
    date: "2025",
  },
};

// ---------------------------------------------------------------------------
// Phase 1b - multi-year projection (MODEL_SPEC_FASE1B §2, §3)
// ---------------------------------------------------------------------------

/**
 * Projection horizon: model 10 years, report the year-5 and year-10 stand
 * (MODEL_SPEC_FASE1B §2's own recommendation). Spanish acquisition costs
 * run to ~13% of the purchase price, so a 5-year-only view flatters a
 * short hold.
 */
export const PROJECTION_YEARS: EstimateParameter<number> = {
  name: "PROJECTION_YEARS",
  value: 10,
  provenance: "ESTIMATE",
  reasoning:
    "MODEL_SPEC_FASE1B §2's own recommendation. Spanish acquisition costs run to ~13% of the purchase price, so a shorter horizon would flatter a short hold.",
};

export const PROJECTION_INTERIM_YEAR: EstimateParameter<number> = {
  name: "PROJECTION_INTERIM_YEAR",
  value: 5,
  provenance: "ESTIMATE",
  reasoning: "MODEL_SPEC_FASE1B §2's own recommendation: show both a year-5 and a year-10 stand.",
};

/**
 * Rent growth per calendar year, as a multiplier on gross rent.
 * Correction Factors!O26:S26 (row "Rent Price Changes"), TSG_Model_v3.xlsx
 * (2026-08). Only the estimate years (2026 and later) are listed: the
 * historical part of that row mixes units (2014-2016 are percentages,
 * 2017+ are multipliers) and is not used for forward projection.
 */
export const RENT_GROWTH_BY_YEAR: SourcedParameter<Readonly<Record<number, number>>> = {
  name: "RENT_GROWTH_BY_YEAR",
  value: { 2026: 1.06, 2027: 1.05, 2028: 1.04, 2029: 1.035, 2030: 1.03 },
  provenance: "SOURCED",
  source:
    "Eurostat HICP, Global Property Guide (Spain 2024 rent data), Idealista market outlook, Oxford Economics housing forecasts, European Commission AMECO, BBVA Research",
  date: "2024-2025",
};

/**
 * Consumer price inflation per calendar year, in percent.
 * Correction Factors!O12:S12 (row "CPI (YoY%)"), TSG_Model_v3.xlsx
 * (2026-08). Applied to maintenance, utilities, insurance and bank fees.
 */
export const CPI_PERCENT_BY_YEAR: SourcedParameter<Readonly<Record<number, number>>> = {
  name: "CPI_PERCENT_BY_YEAR",
  value: { 2026: 2.0, 2027: 2.2, 2028: 2.1, 2029: 2.0, 2030: 2.0 },
  provenance: "SOURCED",
  source: "FactSet (historical), IMF WEO (Apr 2025), European Commission Economic Forecasts (Spring 2024)",
  date: "2024-2025",
};

/**
 * Last calendar year covered by the Correction Factors series. Beyond it
 * the projection carries the last known value forward and flags those
 * years as extrapolated (MODEL_SPEC_FASE1B §3: never extend the series
 * silently). Derived from the shape of RENT_GROWTH_BY_YEAR /
 * CPI_PERCENT_BY_YEAR above, not an independent assumption.
 */
export const CORRECTION_FACTORS_LAST_YEAR: EstimateParameter<number> = {
  name: "CORRECTION_FACTORS_LAST_YEAR",
  value: 2030,
  provenance: "ESTIMATE",
  reasoning: "The last year present in the sourced Correction Factors series above; a structural fact about that data, not an independent assumption.",
};

/**
 * First estimate year in the Correction Factors series, used as the
 * default first projection year. A modelling convention (where the
 * projection starts), not a source value.
 */
export const CORRECTION_FACTORS_FIRST_ESTIMATE_YEAR: EstimateParameter<number> = {
  name: "CORRECTION_FACTORS_FIRST_ESTIMATE_YEAR",
  value: 2026,
  provenance: "ESTIMATE",
  reasoning: "The first estimate year present in the sourced Correction Factors series above; a modelling convention for where the projection starts.",
};

// ---------------------------------------------------------------------------
// TSG score (SCORE_SPEC.md)
// ---------------------------------------------------------------------------

/**
 * The scoring curves and weights below are all ESTIMATE, and that survives
 * the reality-vs-model test in types.ts deliberately: none of them claims
 * anything about the world. They define what a TSG score *means* - where
 * TSG chose to put "a 5", how steeply a shortfall is punished, how much
 * each dimension counts toward the total. That is a product definition,
 * exactly like what "conservative" means as a scenario or where a
 * financing tier's LTV boundary sits, and the same category the audit
 * already admits as ESTIMATE.
 *
 * They are not SOURCED: no external body publishes these thresholds, and
 * inventing a citation for them would be worse than admitting they are
 * TSG's own. They are not PLACEHOLDER either: a PLACEHOLDER is a reality
 * claim awaiting verification, and no amount of market data could ever
 * "verify" that break-even cashflow deserves a 4 rather than a 5 - only a
 * product decision can settle that. SCORE_SPEC.md §3 says as much for the
 * weights ("een startpunt ... kan worden bijgesteld op basis van
 * kalibratie"); the same holds for the curves.
 *
 * Consequence worth knowing: because they are ESTIMATE, they never enter
 * ScenarioOutcome.placeholdersUsed, so the data-certainty dimension does
 * not count its own curve. That avoids a circularity where the score's
 * definition would degrade the score.
 */

/** Cashflow dimension curve, SCORE_SPEC.md §2.1. x = monthly cashflow of the base scenario, in €. */
export const TSG_SCORE_ANCHORS_CASHFLOW: EstimateParameter<readonly ScoreAnchor[]> = {
  name: "TSG_SCORE_ANCHORS_CASHFLOW",
  value: [
    { x: -500, score: 0 },
    { x: -250, score: 2 },
    { x: 0, score: 4 },
    { x: 250, score: 6 },
    { x: 500, score: 7.5 },
    { x: 1000, score: 9 },
    { x: 1500, score: 10 },
  ],
  provenance: "ESTIMATE",
  reasoning:
    "SCORE_SPEC.md §2.1. Defines how the product grades monthly cashflow; break-even scores a 4 rather than a 5 because breaking even on financed foreign property is already an achievement. A product definition, not a claim about achievable cashflow.",
};

/** Debt resilience curve, SCORE_SPEC.md §2.2. x = DSCR of the base scenario (bare ratio). */
export const TSG_SCORE_ANCHORS_DEBT_RESILIENCE: EstimateParameter<readonly ScoreAnchor[]> = {
  name: "TSG_SCORE_ANCHORS_DEBT_RESILIENCE",
  value: [
    { x: 0.5, score: 0 },
    { x: 0.75, score: 2.5 },
    { x: 1.0, score: 5 },
    { x: 1.2, score: 7 },
    { x: 1.4, score: 8.5 },
    { x: 1.8, score: 10 },
  ],
  provenance: "ESTIMATE",
  reasoning:
    "SCORE_SPEC.md §2.2. Anchors a DSCR of exactly 1.0 - break-even on the debt service - at the midpoint 5. A product definition of what constitutes a debt buffer, not a claim about lender requirements.",
};

/**
 * Return dimension curve, SCORE_SPEC.md §2.3. x = the base scenario's IRR
 * minus the investor's required return, in PERCENTAGE POINTS (so +1.84
 * means the IRR beats the hurdle by 1.84pp), not as a fraction.
 */
export const TSG_SCORE_ANCHORS_RETURN_VS_REQUIREMENT: EstimateParameter<readonly ScoreAnchor[]> = {
  name: "TSG_SCORE_ANCHORS_RETURN_VS_REQUIREMENT",
  value: [
    { x: -4, score: 0 },
    { x: -2, score: 2 },
    { x: 0, score: 5 },
    { x: 2, score: 7 },
    { x: 4, score: 8.5 },
    { x: 8, score: 10 },
  ],
  provenance: "ESTIMATE",
  reasoning:
    "SCORE_SPEC.md §2.3. Grades the surplus over the investor's own hurdle rate rather than the absolute IRR, anchoring 'requirement exactly met' at 5. A product definition of how much outperformance is worth how much score.",
};

/**
 * Data certainty curve, SCORE_SPEC.md §2.5. x = the number of PLACEHOLDER
 * parameters in ScenarioOutcome.placeholdersUsed. Deliberately descending:
 * more unverified assumptions, lower score.
 */
export const TSG_SCORE_ANCHORS_DATA_CERTAINTY: EstimateParameter<readonly ScoreAnchor[]> = {
  name: "TSG_SCORE_ANCHORS_DATA_CERTAINTY",
  value: [
    { x: 0, score: 10 },
    { x: 3, score: 8 },
    { x: 6, score: 6 },
    { x: 10, score: 4 },
    { x: 15, score: 2 },
    { x: 20, score: 0 },
  ],
  provenance: "ESTIMATE",
  reasoning:
    "SCORE_SPEC.md §2.5. Defines how heavily an unverified assumption discounts confidence in the score. A product definition; the count it reads is itself derived from the provenance audit, not from market data.",
};

/** The four discrete feasibility steps, SCORE_SPEC.md §2.4. */
export const TSG_SCORE_FEASIBILITY_LEVELS: EstimateParameter<FeasibilityScoreLevels> = {
  name: "TSG_SCORE_FEASIBILITY_LEVELS",
  value: {
    bothChecksFail: 0,
    oneCheckFails: 3,
    bothPassNarrowMargin: 7,
    bothPassAmpleMargin: 10,
  },
  provenance: "ESTIMATE",
  reasoning:
    "SCORE_SPEC.md §2.4. The only non-continuous dimension: a deal that cannot be financed is not partially financeable. A product definition of how hard infeasibility should drag the total down.",
};

/**
 * The relative margin separating the top two feasibility steps
 * (SCORE_SPEC.md §2.4), as a fraction of equityRequired. Stops a deal that
 * clears its constraints by € 50 from scoring the same as one with
 * € 30.000 of room.
 */
export const TSG_SCORE_FEASIBILITY_MARGIN_THRESHOLD: EstimateParameter<number> = {
  name: "TSG_SCORE_FEASIBILITY_MARGIN_THRESHOLD",
  value: 0.1,
  provenance: "ESTIMATE",
  reasoning:
    "SCORE_SPEC.md §2.4. A product definition of where 'just barely fits' ends and 'comfortably fits' begins; no external source defines that boundary.",
};

/**
 * Dimension weights for the total score, SCORE_SPEC.md §3. Must sum to
 * 1.00 (enforced by test). Per UI_SPEC.md §5 these are deliberately NOT
 * published in the report - only the methodology is described - so a
 * change here changes the total without any customer-visible number
 * moving. SCORE_SPEC.md §3 requires recording when and why that happens,
 * and SCORE_SPEC.md §5 requires regenerating the reference distribution.
 */
export const TSG_SCORE_DIMENSION_WEIGHTS: EstimateParameter<Readonly<Record<TsgScoreDimension, number>>> = {
  name: "TSG_SCORE_DIMENSION_WEIGHTS",
  value: {
    cashflow: 0.2,
    debtResilience: 0.15,
    returnVsRequirement: 0.3,
    feasibility: 0.2,
    dataCertainty: 0.15,
  },
  provenance: "ESTIMATE",
  reasoning:
    "SCORE_SPEC.md §3, which calls the weighting 'een startpunt' open to calibration against real deals. A product definition of what matters how much, not a measurable fact.",
};

/** All parameters in this file, for provenance tooling (e.g. collecting every PLACEHOLDER). */
export const ALL_PARAMETERS: ReadonlyArray<Parameter<unknown>> = [
  RENT_MATRIX_LONG_TERM_PER_M2,
  RENT_MATRIX_SHORT_TERM_PER_M2,
  NEIGHBORHOOD_RENT_LONG_TERM,
  NEIGHBORHOOD_RENT_SHORT_TERM,
  BASE_OCCUPANCY_LONG_TERM,
  BASE_OCCUPANCY_SHORT_TERM,
  HYBRID_SHARE_LONG_TERM,
  HYBRID_SHARE_SHORT_TERM,
  DEFAULT_USABLE_TO_BUILT_AREA_RATIO,
  INSURANCE_COSTS_ANNUAL,
  TOTAL_INSURANCE_ANNUAL,
  PROPERTY_MANAGEMENT_FEE,
  LEGAL_ADVICE_FEE,
  MAINTENANCE_RATE,
  UTILITIES_PER_M2_ANNUAL,
  TOTAL_UTILITIES_PER_M2_ANNUAL,
  BANK_FEE,
  PROPERTY_TAX_IBI_RATE,
  DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO,
  ACQUISITION_RATES,
  ...Object.values(RENOVATION_STRATEGIES).flatMap((s) => [
    s.capex,
    s.rentMultiplier,
    s.maintenanceFactor,
    s.utilitiesEfficiency,
    s.timeToRentMonths,
  ]),
  ...Object.values(FINANCING_STRATEGIES).flatMap((s) => [s.ltv, s.loanTermYears, s.interestRate]),
  NON_RESIDENT_INTEREST_SPREAD,
  ...Object.values(SCENARIOS).flatMap((s) => [
    s.rentLevelMultiplier,
    s.occupancyMultiplier,
    s.interestRateDelta,
    s.utilitiesMultiplier,
    s.maintenanceInflationMultiplier,
  ]),
  RENTAL_INCOME_TAX_RATE_EU,
  RENTAL_INCOME_TAX_RATE_NON_EU,
  CAPITAL_GAINS_TAX_RATE_NON_RESIDENT,
  NON_RESIDENT_WITHHOLDING_RATE,
  DEFAULT_RENOVATION_IMPROVEMENT_SHARE,
  DEFAULT_MIN_REQUIRED_RETURN,
  AVERAGE_DEDUCTIBLE_COST_SHARE,
  DEPRECIATION_RATE,
  DEPRECIATION_BUILDING_SHARE,
  DEFAULT_BUILDING_SHARE_OF_VALUE,
  ...Object.values(DEPRECIATION_SCENARIO_FACTORS),
  ...Object.values(VALUE_GROWTH_ANNUAL),
  PROJECTION_YEARS,
  PROJECTION_INTERIM_YEAR,
  RENT_GROWTH_BY_YEAR,
  CPI_PERCENT_BY_YEAR,
  CORRECTION_FACTORS_LAST_YEAR,
  CORRECTION_FACTORS_FIRST_ESTIMATE_YEAR,
  TSG_SCORE_ANCHORS_CASHFLOW,
  TSG_SCORE_ANCHORS_DEBT_RESILIENCE,
  TSG_SCORE_ANCHORS_RETURN_VS_REQUIREMENT,
  TSG_SCORE_ANCHORS_DATA_CERTAINTY,
  TSG_SCORE_FEASIBILITY_LEVELS,
  TSG_SCORE_FEASIBILITY_MARGIN_THRESHOLD,
  TSG_SCORE_DIMENSION_WEIGHTS,
];
