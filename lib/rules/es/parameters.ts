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
  MaintenanceCondition,
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

/**
 * UNVERIFIED - flagged explicitly per this task's own instruction to be
 * careful with a tax figure. This is not sourced from Valencia's current
 * fiscal ordinance; it could not be, in this environment (see below).
 *
 * plusvalía municipal (IIVTNU) is computed, in every Spanish town, as:
 *   land cadastral value x coefficient(years held) x municipal tax rate
 * The two constants below are the coefficient table and the rate. Both
 * are reconstructed from general knowledge of the NATIONAL maximum
 * coefficients set by Real Decreto-ley 8/2023 (in force for accruals
 * from 2024 - a 2025/2026 update was proposed but not ratified by
 * Congress, so these remain current per web search as of August 2026)
 * and the Article 108.1 TRLRHL rate cap, cross-checked against several
 * web search results. It is NOT confirmed against Valencia's own current
 * ordinance (a municipality may set its own rate up to the cap, and may
 * apply the national coefficients or lower ones) - WebFetch to every
 * primary and secondary source attempted (sede.valencia.es, boe.es,
 * several tax-advisory sites) was blocked by this sandbox's egress
 * policy, so only fragmentary, sometimes mutually conflicting, search
 * snippets were available. One search result named 29%, another 29,70%,
 * a third "30% Valencia" for the rate; coefficient-table snippets
 * disagreed on the >=20-year figure (0,40 vs 0,45).
 *
 * PROVENANCE therefore PLACEHOLDER, not ESTIMATE: this is exactly the
 * "no external source cited, best judgement" case the provenance system
 * exists to flag, same as DEFAULT_USABLE_TO_BUILT_AREA_RATIO above.
 *
 * NOT wired into the calculation layer. This estimate feeds only
 * app/rapport/nieuw/exit/exit-form.tsx's pre-fill for
 * municipalCapitalGainsTax - a starting point the customer can and
 * should override, the same architecture rent-prefill.ts already uses
 * for the rent fields. EngineInput never receives this table; whatever
 * number the customer confirms in the form is what the engine sees,
 * exactly as before this pre-fill existed. Confirmation against the live
 * Valencia ordinance (sede.valencia.es) is needed before this could
 * safely become the actual computed value rather than a suggestion.
 */
export const PLUSVALIA_VALENCIA_COEFFICIENTS: PlaceholderParameter<Readonly<Record<number, number>>> =
  {
    name: "PLUSVALIA_VALENCIA_COEFFICIENTS",
    value: {
      0: 0.15, // < 1 year
      1: 0.15,
      2: 0.14,
      3: 0.14,
      4: 0.16,
      5: 0.18,
      6: 0.19,
      7: 0.2,
      8: 0.19,
      9: 0.15,
      10: 0.12,
      11: 0.1,
      12: 0.09,
      13: 0.09,
      14: 0.09,
      15: 0.1,
      16: 0.13,
      17: 0.17,
      18: 0.23,
      19: 0.29,
      20: 0.45, // >= 20 years
    },
    provenance: "PLACEHOLDER",
    reasoning:
      "Reconstructed from general knowledge of Real Decreto-ley 8/2023's national maximum IIVTNU coefficients (art. 107.4 TRLRHL), not confirmed against Valencia's current fiscal ordinance. This sandbox's egress policy blocked WebFetch to every primary source attempted (sede.valencia.es, boe.es); web search snippets partially corroborated the shape (a dip around years 9-14, reflecting the 2008-2014 property downturn baked into the national law) but disagreed on some individual values, particularly the >=20-year figure (0,40 vs 0,45 across sources). Not wired into the engine - see this constant's own module docstring above.",
  };

export const PLUSVALIA_VALENCIA_RATE: PlaceholderParameter<number> = {
  name: "PLUSVALIA_VALENCIA_RATE",
  value: 0.3,
  provenance: "PLACEHOLDER",
  reasoning:
    "Article 108.1 TRLRHL caps the municipal IIVTNU rate at 30% and this constant uses that legal maximum; search results suggest Valencia's own ordinance sets a rate close to this cap (29%, 29,70% and '30%' each appeared in different sources for different years) but did not confirm which applies now. Not wired into the engine - see PLUSVALIA_VALENCIA_COEFFICIENTS' module docstring.",
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

// ---------------------------------------------------------------------------
// TSG score - synthetic reference distribution (SCORE_SPEC.md §5)
// ---------------------------------------------------------------------------

/**
 * The parameters below shape the synthetic universe of 1.000 cases the
 * percentile is measured against (SCORE_SPEC.md §5), not any one real
 * property - so, like the scoring curves above, they take the reality-vs-
 * model test to ESTIMATE, not PLACEHOLDER: "this synthetic case has a
 * € 900/year community fee" is not a claim about a real building, it is a
 * construction choice for the reference universe.
 *
 * Four of them (community fees, the two exit assumptions, and the investor
 * constraints) deliberately reuse the exact values already fixed as TEST
 * FIXTUREs in referencecase.ts and exit.test.ts - not because they are
 * more correct than any other number, but so the reference distribution
 * and the rest of the golden-test suite are computed under one consistent
 * set of assumptions rather than two silently different ones.
 */

/** Sample size of the synthetic reference distribution, SCORE_SPEC.md §5: "een synthetische set van 1.000 casussen". */
export const TSG_SCORE_DISTRIBUTION_SAMPLE_SIZE: EstimateParameter<number> = {
  name: "TSG_SCORE_DISTRIBUTION_SAMPLE_SIZE",
  value: 1000,
  provenance: "ESTIMATE",
  reasoning:
    "SCORE_SPEC.md §5. The stated size of the synthetic reference set; a product definition of how large the reference universe is, not a claim about the real market.",
};

/**
 * Deterministic seed for the reference distribution's pseudo-random
 * generator (SCORE_SPEC.md §6: "de scoring is deterministisch"). Not a
 * claim about anything - a fixed choice so the same 1.000 synthetic cases,
 * and therefore the same percentile boundaries, are reproduced by every
 * run and every golden test, until the distribution is deliberately
 * regenerated (SCORE_SPEC.md §5, "Verversing").
 */
export const TSG_SCORE_DISTRIBUTION_SEED: EstimateParameter<number> = {
  name: "TSG_SCORE_DISTRIBUTION_SEED",
  value: 20260811,
  provenance: "ESTIMATE",
  reasoning:
    "A fixed PRNG seed for reproducibility, not a market or model claim - chosen as this feature's build date (2026-08-11) purely as a memorable, arbitrary constant.",
};

/** Floor area range for generated cases, SCORE_SPEC.md §5: "30 tot 200 m², uniform". Sampled as builtAreaM2; usableAreaM2 is left to derive via DEFAULT_USABLE_TO_BUILT_AREA_RATIO, since the spec gives one figure, not a separate pair. */
export const TSG_SCORE_DISTRIBUTION_AREA_RANGE_M2: EstimateParameter<{
  min: number;
  max: number;
}> = {
  name: "TSG_SCORE_DISTRIBUTION_AREA_RANGE_M2",
  value: { min: 30, max: 200 },
  provenance: "ESTIMATE",
  reasoning:
    "SCORE_SPEC.md §5. Defines the floor-area span of the synthetic universe, a product decision, not a market survey result.",
};

/**
 * Purchase price is no longer drawn independently of area (that produced
 * unrealistic combinations - a large cheap unit or a tiny expensive one -
 * and skewed the whole distribution toward the score floor). Instead it is
 * DERIVED per generated case: purchasePrice = neighborhood's long-term
 * rent per m² x 12 (annual rent per m²) x this multiplier x builtAreaM2.
 *
 * The multiplier is a price-to-annual-rent ratio, i.e. the inverse of a
 * gross rental yield. A range of 13-24 corresponds to gross yields of
 * roughly 4.2%-7.7%, the broad band commonly associated with Spanish
 * residential buy-to-let property - reasonable as a construction choice
 * for the synthetic universe's price/rent relationship, not a claim
 * sourced for any specific transaction (hence ESTIMATE, not SOURCED).
 * Drawing a fresh multiplier per case (rather than one fixed value) is the
 * "spreiding eromheen" the price should have around what the neighborhood
 * table implies: two otherwise-identical cases in the same neighborhood
 * still get different prices, the way two real listings would.
 */
export const TSG_SCORE_DISTRIBUTION_PRICE_TO_RENT_MULTIPLIER_RANGE: EstimateParameter<{
  min: number;
  max: number;
}> = {
  name: "TSG_SCORE_DISTRIBUTION_PRICE_TO_RENT_MULTIPLIER_RANGE",
  value: { min: 13, max: 24 },
  provenance: "ESTIMATE",
  reasoning:
    "Purchase price per m² is derived from the neighborhood's rent table via price = annual rent x multiplier. 13-24 implies a gross rental yield of roughly 4.2%-7.7%, the broad band commonly associated with Spanish residential buy-to-let - a reasonable construction choice for how price should track rent in the synthetic universe, not a cited market statistic for any real transaction.",
};

/**
 * Available equity (and, via the same draw, totalBudget) as a COVERAGE
 * FACTOR applied to that specific case's own computed equityRequired - not,
 * as in the previous correction, a fraction of purchase price. That
 * price-based version undershot systematically: equityRequired includes
 * the financing shortfall, ~17% of price in acquisition taxes/fees, and a
 * flat, size-independent renovation cost, which together typically run to
 * roughly 60-75% of price - well above the 25%-45%-of-price range that was
 * supplying it, so nearly every generated case failed the feasibility
 * check regardless of how well- or under-capitalised the synthetic
 * investor actually was relative to what THIS deal needed.
 *
 * Anchoring to equityRequired instead removes that systematic mismatch:
 * 1.0 means an investor with exactly enough capital for this specific
 * deal. A coverage factor of 0.6-1.4 simulates a spread from
 * under-prepared investors (60% of what this deal needs - short by a
 * real, not negligible, margin) to comfortably over-prepared ones (140%,
 * meaningful headroom beyond the requirement), rather than assuming every
 * synthetic investor sized their capital to the same fraction of price
 * regardless of what a given deal's leverage and costs actually demand.
 */
export const TSG_SCORE_DISTRIBUTION_EQUITY_COVERAGE_RANGE: EstimateParameter<{
  min: number;
  max: number;
}> = {
  name: "TSG_SCORE_DISTRIBUTION_EQUITY_COVERAGE_RANGE",
  value: { min: 0.6, max: 1.4 },
  provenance: "ESTIMATE",
  reasoning:
    "Available equity (and totalBudget) as a coverage factor on equityRequired, the figure the engine already computes for this specific case, rather than a fraction of purchase price - the latter ignored how much a deal's own leverage, acquisition costs and renovation actually demand. 0.6-1.4 simulates a spread from under-prepared to well-prepared investors relative to what this deal needs, not relative to an unrelated price-based estimate.",
};

/**
 * Preferred LTV per generated case, fed straight into the engine's own
 * ModelSelections/InvestorConstraints.preferredLtv field (financing.ts,
 * clampLtv()). Every case previously used whichever of the three
 * FINANCING_STRATEGIES tiers (60%/70%/75% LTV) was drawn, but
 * TSG_SCORE_DISTRIBUTION_CONSTRAINTS.minLtv (0.6) then clamped ALL of them
 * into the same narrow 60%-75% band regardless - so leverage never
 * actually varied, and cashflow/DSCR were structurally weak for nearly
 * every case (amortising debt service on 60%+ LTV rarely leaves much
 * operating cashflow at a market-consistent rental yield).
 *
 * 0-0.75 spans an all-cash purchase (LTV 0, no mortgage at all) up to the
 * engine's own highest existing leverage tier (FINANCING_STRATEGIES.high.
 * ltv, 0.75) - the full range clampLtv() can already produce, not a new
 * financing mechanism. TSG_SCORE_DISTRIBUTION_CONSTRAINTS.minLtv is
 * lowered to 0 (see below) so this draw is not clamped back up before it
 * reaches clampLtv().
 */
export const TSG_SCORE_DISTRIBUTION_PREFERRED_LTV_RANGE: EstimateParameter<{
  min: number;
  max: number;
}> = {
  name: "TSG_SCORE_DISTRIBUTION_PREFERRED_LTV_RANGE",
  value: { min: 0, max: 0.75 },
  provenance: "ESTIMATE",
  reasoning:
    "Drawn per case as InvestorConstraints.preferredLtv, using the engine's existing clampLtv()/selectInterestRate() mechanism (financing.ts) rather than new financing logic. 0-0.75 spans an all-cash purchase up to FINANCING_STRATEGIES.high.ltv, the engine's own highest defined leverage tier - the full range the mechanism already supports, previously unreachable because minLtv (0.6) clamped every draw into a narrow high-leverage band regardless of strategy.",
};

/**
 * Holding period (years) per generated case, replacing the single fixed
 * PROJECTION_YEARS.value (10) every case previously used for both
 * buildProjectionYears() and computeExit(). A single fixed horizon meant
 * the exit outcome - and so the IRR, the only score dimension it feeds -
 * varied only with price and scenario, never with how long the synthetic
 * investor actually holds. 5-15 years spans short to medium-length holds
 * a real investor might choose, centered near PROJECTION_YEARS' own
 * 10-year recommendation (MODEL_SPEC_FASE1B §2) rather than replacing it
 * with an unrelated figure.
 */
export const TSG_SCORE_DISTRIBUTION_HOLDING_PERIOD_RANGE_YEARS: EstimateParameter<{
  min: number;
  max: number;
}> = {
  name: "TSG_SCORE_DISTRIBUTION_HOLDING_PERIOD_RANGE_YEARS",
  value: { min: 5, max: 15 },
  provenance: "ESTIMATE",
  reasoning:
    "SCORE_SPEC.md §5 does not specify a holding-period range. 5-15 years spans short to medium-length holds a real investor might choose, centered near PROJECTION_YEARS' own 10-year recommendation (MODEL_SPEC_FASE1B §2) rather than fixing every generated case to that single value.",
};

/** Rental strategy mix for generated cases, SCORE_SPEC.md §5: "langetermijn (70%) en hybride (30%)". "shortTerm" is not generated. */
export const TSG_SCORE_DISTRIBUTION_RENTAL_STRATEGY_SHARES: EstimateParameter<{
  longTerm: number;
  hybrid: number;
}> = {
  name: "TSG_SCORE_DISTRIBUTION_RENTAL_STRATEGY_SHARES",
  value: { longTerm: 0.7, hybrid: 0.3 },
  provenance: "ESTIMATE",
  reasoning:
    "SCORE_SPEC.md §5. TSG's own assumed mix of rental strategies across the synthetic universe, not a market survey of actual strategy adoption.",
};

/**
 * Gastos de comunidad range for generated cases. A single fixed figure
 * (previously € 900/year for every case, regardless of building size or
 * price) understated how much this cost actually varies - a small
 * building with no elevator and a large one with a pool, staffed lobby
 * and shared services can differ by a factor of four or more. €400-1.800
 * is a plausible span for Valencia apartment buildings; drawn per case, not
 * derived from purchase price or area, since community fees are set by
 * the building's own services rather than scaling cleanly with either.
 */
export const TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE: EstimateParameter<{
  min: number;
  max: number;
}> = {
  name: "TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE",
  value: { min: 400, max: 1_800 },
  provenance: "ESTIMATE",
  reasoning:
    "No default exists for communityFeesAnnual and SCORE_SPEC.md §5 does not give one. A fixed € 900 for every case understated real variation (elevator, pool, staffing, building size); € 400-1.800 is a plausible span for Valencia apartment buildings, drawn independently per case since this cost is set by the building's own services, not by its price or area.",
};

/**
 * Exit assumptions used for every generated case's holding-period sale
 * (sellingCommissionRate, municipalCapitalGainsTax). ExitAssumptions has
 * no engine default (MODEL_SPEC_FASE1B §5) and SCORE_SPEC.md §5 does not
 * give one; reuses exit.test.ts's exact TEST FIXTURE values.
 */
export const TSG_SCORE_DISTRIBUTION_EXIT_ASSUMPTIONS: EstimateParameter<{
  sellingCommissionRate: number;
  municipalCapitalGainsTax: number;
}> = {
  name: "TSG_SCORE_DISTRIBUTION_EXIT_ASSUMPTIONS",
  value: { sellingCommissionRate: 0.04, municipalCapitalGainsTax: 3500 },
  provenance: "ESTIMATE",
  reasoning:
    "No default exists for either exit assumption and SCORE_SPEC.md §5 does not give one; reuses exit.test.ts's TEST FIXTURE values (sellingCommissionRate 0.04, municipalCapitalGainsTax 3500) for the same reason as the community fees figure.",
};

/**
 * Investor constraints ("budgetten") applied to every generated case,
 * excluding totalBudget - that field tracks each case's own computed
 * equityRequired (via TSG_SCORE_DISTRIBUTION_EQUITY_COVERAGE_RANGE,
 * "totalBudget volgt dezelfde logica"), since totalBudget is compared
 * directly against equityRequired in acquisitionCosts() and so
 * conceptually measures the same thing "beschikbaar eigen vermogen" does.
 * The remaining fields here have no natural link to a specific case's
 * equityRequired and stay fixed, reusing referencecase.ts's TEST FIXTURE
 * values for consistency with the rest of the golden-test suite.
 */
export const TSG_SCORE_DISTRIBUTION_CONSTRAINTS: EstimateParameter<{
  maxRenovationBudget: number;
  minLtv: number;
  maxLtv: number;
  minRoiTarget: number;
  minMonthlyCashflow: number;
  maxMonthlyDebt: number;
}> = {
  name: "TSG_SCORE_DISTRIBUTION_CONSTRAINTS",
  value: {
    maxRenovationBudget: 60_000,
    // 0, not referencecase.ts's 0.6: this is the floor clampLtv() applies
    // to TSG_SCORE_DISTRIBUTION_PREFERRED_LTV_RANGE's per-case draw
    // (0-0.75). A 0.6 floor would clamp every low-leverage/cash-purchase
    // draw straight back up to 60% LTV, which is exactly the bug that
    // range was introduced to fix - see its own reasoning above.
    minLtv: 0,
    maxLtv: 0.75,
    minRoiTarget: 0.04,
    minMonthlyCashflow: 500,
    maxMonthlyDebt: 1_000,
  },
  provenance: "ESTIMATE",
  reasoning:
    "SCORE_SPEC.md §5's 'overige invoer: de defaults uit parameters.ts', applied to the InvestorConstraints fields that do not scale with equityRequired or vary per case (totalBudget does now - see TSG_SCORE_DISTRIBUTION_EQUITY_COVERAGE_RANGE - and minLtv is lowered from referencecase.ts's 0.6 to 0 so TSG_SCORE_DISTRIBUTION_PREFERRED_LTV_RANGE's per-case draw is not clamped away). The remaining fields reuse referencecase.ts's TEST FIXTURE constraints for consistency with the rest of the golden-test suite.",
};

// ---------------------------------------------------------------------------
// Free indication band (UI_SPEC.md §2, CLAUDE.md §4/§6)
// ---------------------------------------------------------------------------

/**
 * The free indication runs on the five first-order fields only (UI_SPEC.md
 * §3) and must never be the full runEngine() topped up with invented
 * second-order values (CLAUDE.md §6). What it shows instead is a band: the
 * same simplified calculation run twice, once with the least favourable and
 * once with the most favourable standing-in value for each second-order
 * field the customer has not been asked for yet.
 *
 * Three fields span the band, and each end is a value that already exists
 * in this file rather than a newly invented margin - except the rent
 * margin below, which is the one genuinely new number in the design and is
 * labelled accordingly.
 *
 * Deliberately NOT band drivers, because no documented range exists for
 * them and inventing one would be the same mistake in a different place:
 * DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO, DEFAULT_USABLE_TO_BUILT_AREA_RATIO
 * and BASE_OCCUPANCY_LONG_TERM are held at their single value in both runs
 * and reported as unverified instead (UI_SPEC.md §6.9).
 */

/**
 * Symmetric margin around a neighbourhood's reference rent.
 * NEIGHBORHOOD_RENT_LONG_TERM is a per-wijk average; the individual
 * property sits above or below it depending on floor, light, layout,
 * outdoor space and finish - none of which the five first-order fields
 * capture. Without this margin the band would express cost uncertainty
 * only, leaving the single largest driver of the outcome fixed at an
 * average.
 *
 * PLACEHOLDER, not ESTIMATE: "properties vary by ±8% within one
 * neighbourhood" is a claim about the real dispersion of rents, not a
 * definition of how this model works, and no source backs this specific
 * figure. Per the reality-claim test in types.ts that leaves PLACEHOLDER
 * as the only permitted label. Replace it with a measured spread (e.g. the
 * interquartile range of the listings the wijk averages were built from)
 * before it carries a paying customer's number.
 */
export const FREE_TIER_BAND_RENT_MARGIN: PlaceholderParameter<number> = {
  name: "FREE_TIER_BAND_RENT_MARGIN",
  value: 0.08,
  provenance: "PLACEHOLDER",
  reasoning:
    "Symmetric ±8% around NEIGHBORHOOD_RENT_LONG_TERM's per-wijk average, standing in for how far an individual property's achievable rent sits from that average. A claim about real rent dispersion with no source behind this specific figure; must be replaced by a measured spread from the underlying listings before production use.",
};

/**
 * Least favourable gastos de comunidad for the band's low end. Value is
 * read from TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE rather than
 * restated, and the provenance is derived from it rather than hand-typed -
 * so if that range is ever re-sourced or downgraded, this end of the band
 * follows automatically instead of keeping a stale label.
 */
export const FREE_TIER_BAND_COMMUNITY_FEES_UNFAVOURABLE: Parameter<number> = deriveParameter(
  "FREE_TIER_BAND_COMMUNITY_FEES_UNFAVOURABLE",
  TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE.value.max,
  [TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE],
);

/** Most favourable gastos de comunidad for the band's high end - see the unfavourable end above. */
export const FREE_TIER_BAND_COMMUNITY_FEES_FAVOURABLE: Parameter<number> = deriveParameter(
  "FREE_TIER_BAND_COMMUNITY_FEES_FAVOURABLE",
  TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE.value.min,
  [TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE],
);

/**
 * Which renovation tier stands in for "staat van onderhoud" at each end of
 * the band. The three tiers order monotonically on cashflow - minimal
 * (rent x0.95, maintenance x1.20, utilities x1.05) is worst, heavy (x1.10,
 * x0.85, x0.90) is best, and light sits exactly in between at 1.00 on all
 * three - so the outer two bracket the model's own range without a single
 * new multiplier being invented.
 *
 * ESTIMATE covers the selection rule only ("the band spans the outermost
 * tiers this model already defines"), which is a modelling choice. The
 * multipliers it pulls in stay PLACEHOLDER on RENOVATION_STRATEGIES and
 * travel to the customer through placeholdersUsed; the ESTIMATE label here
 * does not launder them.
 */
export const FREE_TIER_BAND_RENOVATION_TIER_UNFAVOURABLE: EstimateParameter<RenovationStrategyId> = {
  name: "FREE_TIER_BAND_RENOVATION_TIER_UNFAVOURABLE",
  value: "minimal",
  provenance: "ESTIMATE",
  reasoning:
    "Selection rule, not a new figure: 'minimal' is the lowest-cashflow renovation tier RENOVATION_STRATEGIES already defines (rentMultiplier 0.95, maintenanceFactor 1.20, utilitiesEfficiency 1.05), so it marks the band's unfavourable end for an unknown state of repair. Its underlying multipliers remain PLACEHOLDER.",
};

/** Most favourable renovation tier for the band's high end - see the unfavourable end above. */
export const FREE_TIER_BAND_RENOVATION_TIER_FAVOURABLE: EstimateParameter<RenovationStrategyId> = {
  name: "FREE_TIER_BAND_RENOVATION_TIER_FAVOURABLE",
  value: "heavy",
  provenance: "ESTIMATE",
  reasoning:
    "Selection rule, not a new figure: 'heavy' is the highest-cashflow renovation tier RENOVATION_STRATEGIES already defines (rentMultiplier 1.10, maintenanceFactor 0.85, utilitiesEfficiency 0.90), so it marks the band's favourable end for an unknown state of repair. Its underlying multipliers remain PLACEHOLDER.",
};

/**
 * Where the indicative score's three grades begin (SCORE_SPEC.md §8.2).
 * A 0-10 score from the §2.1 or §2.5 curve at or above `high` reads as
 * "Hoog", at or above `medium` as "Gemiddeld", below it as "Laag".
 *
 * SCORE_SPEC.md §8.5 says the indicative score needs no new parameters,
 * and it is right that the curves and anchors are all reused - but §8.2's
 * two cut-offs are themselves numbers that exist nowhere else, and
 * CLAUDE.md §6 does not allow those to sit inline in a calculation. So
 * they live here, which is the only difference from what §8.5 describes.
 *
 * ESTIMATE, and this is the label the reality-vs-model test in types.ts
 * actually calls for: "where TSG chooses to stop calling a cashflow
 * average and start calling it high" defines the product, and no external
 * source could confirm or refute it. §8.2 gives the reasoning for the
 * lower cut-off in particular - break-even scores 4.0 on the §2.1 curve,
 * so "Gemiddeld" starting at 4.0 makes the indication read break-even the
 * same way the full score does, rather than drawing an unrelated line.
 */
export const FREE_TIER_INDICATIVE_LABEL_THRESHOLDS: EstimateParameter<{
  medium: number;
  high: number;
}> = {
  name: "FREE_TIER_INDICATIVE_LABEL_THRESHOLDS",
  value: { medium: 4.0, high: 7.0 },
  provenance: "ESTIMATE",
  reasoning:
    "SCORE_SPEC.md §8.2's Laag/Gemiddeld/Hoog cut-offs on the underlying 0-10 score. A product definition (where TSG draws the line between grades), not a claim about the world: the 4.0 boundary is chosen to coincide with what break-even scores on the §2.1 cashflow curve, so the indication reads break-even the same way the full five-dimension score does.",
};

// ---------------------------------------------------------------------------
// Paid-form selection derivation (interview round 1)
// ---------------------------------------------------------------------------

/**
 * Maps the paid form's "staat van onderhoud" field onto a renovation tier
 * (derive-selections.ts), so the customer answers one question about the
 * property's current condition instead of picking a renovation strategy
 * directly.
 *
 * PLACEHOLDER, not ESTIMATE: this claims a real-world consequence of a
 * property's condition (how much renovation work it needs to reach
 * rentable standard) - the reality-claim test in types.ts applies, and no
 * external source ties a specific condition label to a specific capex
 * tier. Deliberately 1:1 with RENOVATION_STRATEGIES' three existing tiers
 * rather than a finer scale: a finer scale would need a second, invented
 * rule for which conditions collapse onto which tier, layering one
 * unverified assumption on another. This way there is exactly one
 * assumption, inspectable as a three-row table.
 *
 * Deliberately does not read constructionYear or energyLabel, which the
 * form asks for separately: a 1970 building can be fully renovated and a
 * 2015 one neglected, so condition is the customer's own assessment, not
 * derived from age or label.
 */
export const RENOVATION_TIER_BY_MAINTENANCE_CONDITION: PlaceholderParameter<
  Record<MaintenanceCondition, RenovationStrategyId>
> = {
  name: "RENOVATION_TIER_BY_MAINTENANCE_CONDITION",
  value: { good: "minimal", average: "light", poor: "heavy" },
  provenance: "PLACEHOLDER",
  reasoning:
    "Claims a real-world consequence of a property's current condition (how much renovation work it needs to reach rentable standard) - no external source ties a specific condition label to a specific capex tier. Deliberately 1:1 with the three existing RENOVATION_STRATEGIES tiers rather than a finer scale, so no second, invented collapsing rule sits between the customer's self-assessment and the tier.",
};

/**
 * Which financing tier wins when the customer's preferredLtv sits exactly
 * midway between two of FINANCING_STRATEGIES' three LTVs (0.6/0.7/0.75) -
 * at 0.65 and 0.725. Off the midpoint, "nearest LTV" needs no further rule
 * and adds no new real-world claim (the three LTVs it compares against
 * are already ESTIMATE product-tier definitions in FINANCING_STRATEGIES).
 *
 * ESTIMATE: a tie-break is a product convention (which way TSG rounds an
 * ambiguous preference), not a claim about the world. "higher": offering
 * more leverage on an exact tie costs the customer nothing to be shown
 * and matches how a person reading "0.65" would round it.
 */
export const FINANCING_TIER_SELECTION_TIE_BREAK: EstimateParameter<"lower" | "higher"> = {
  name: "FINANCING_TIER_SELECTION_TIE_BREAK",
  value: "higher",
  provenance: "ESTIMATE",
  reasoning:
    "Which of the two equidistant financing tiers wins when preferredLtv sits exactly at a midpoint (0.65 or 0.725) between FINANCING_STRATEGIES' three LTVs. A product convention, not a real-world claim: 'higher' offers the customer more leverage on an exact tie.",
};

// ---------------------------------------------------------------------------
// Rent input provenance (interview round 2/3 follow-up)
// ---------------------------------------------------------------------------

/**
 * How far a customer-supplied rent rate must deviate from its
 * neighbourhood reference (NEIGHBORHOOD_RENT_LONG_TERM/SHORT_TERM) before
 * the paid report's §6.1 headline carries an explicit, prominent mention
 * of the deviation rather than a lighter one.
 *
 * ESTIMATE: this is a product decision about where "significant" begins,
 * not a claim about the world - the same category as
 * FREE_TIER_INDICATIVE_LABEL_THRESHOLDS and
 * TSG_SCORE_FEASIBILITY_MARGIN_THRESHOLD. 20%, chosen per the product
 * brief that introduced this check: material enough that a customer
 * comparing their figure to a specific nearby listing would still expect
 * to see it called out, without flagging the ordinary variation within
 * one wijk that the free-tier rent margin (FREE_TIER_BAND_RENT_MARGIN,
 * 8%) already treats as unremarkable.
 *
 * Inclusive at the boundary (>=), matching every other threshold in this
 * file (TSG_SCORE_FEASIBILITY_MARGIN_THRESHOLD, both cut-offs in
 * FREE_TIER_INDICATIVE_LABEL_THRESHOLDS): reaching the threshold counts as
 * reaching it, rather than requiring one euro-cent more.
 */
export const RENT_OVERRIDE_SIGNIFICANT_DEVIATION_THRESHOLD: EstimateParameter<number> = {
  name: "RENT_OVERRIDE_SIGNIFICANT_DEVIATION_THRESHOLD",
  value: 0.2,
  provenance: "ESTIMATE",
  reasoning:
    "Where a customer-supplied rent rate's deviation from its neighbourhood reference becomes 'significant' enough for a prominent §6.1 mention rather than a lighter one. A product decision, not a claim about the world - the same category as FREE_TIER_INDICATIVE_LABEL_THRESHOLDS. 20% is material enough to flag a figure diverging from a specific comparable, without flagging the ordinary within-wijk variation FREE_TIER_BAND_RENT_MARGIN (8%) already treats as unremarkable. Inclusive at the boundary, matching every other threshold in this file.",
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
  TSG_SCORE_DISTRIBUTION_SAMPLE_SIZE,
  TSG_SCORE_DISTRIBUTION_SEED,
  TSG_SCORE_DISTRIBUTION_AREA_RANGE_M2,
  TSG_SCORE_DISTRIBUTION_PRICE_TO_RENT_MULTIPLIER_RANGE,
  TSG_SCORE_DISTRIBUTION_EQUITY_COVERAGE_RANGE,
  TSG_SCORE_DISTRIBUTION_PREFERRED_LTV_RANGE,
  TSG_SCORE_DISTRIBUTION_HOLDING_PERIOD_RANGE_YEARS,
  TSG_SCORE_DISTRIBUTION_RENTAL_STRATEGY_SHARES,
  TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE,
  TSG_SCORE_DISTRIBUTION_EXIT_ASSUMPTIONS,
  TSG_SCORE_DISTRIBUTION_CONSTRAINTS,
  FREE_TIER_BAND_RENT_MARGIN,
  FREE_TIER_BAND_COMMUNITY_FEES_UNFAVOURABLE,
  FREE_TIER_BAND_COMMUNITY_FEES_FAVOURABLE,
  FREE_TIER_BAND_RENOVATION_TIER_UNFAVOURABLE,
  FREE_TIER_BAND_RENOVATION_TIER_FAVOURABLE,
  FREE_TIER_INDICATIVE_LABEL_THRESHOLDS,
  RENOVATION_TIER_BY_MAINTENANCE_CONDITION,
  FINANCING_TIER_SELECTION_TIE_BREAK,
  RENT_OVERRIDE_SIGNIFICANT_DEVIATION_THRESHOLD,
];
