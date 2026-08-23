/**
 * Every named parameter (SOURCED, ESTIMATE and PLACEHOLDER alike) one
 * scenario outcome's calculation chain actually draws on - UI_SPEC.md
 * §6.8's "Aannames en bronnen", the full-provenance counterpart to
 * outcome.ts's collectPlaceholders() (which exists first, is already
 * tested, and stays untouched here - this module traces the same call
 * graph independently rather than refactoring that working code to share
 * an implementation).
 *
 * Deliberately excludes anything from the TSG scoring engine
 * (TSG_SCORE_*, the reference-distribution parameters in
 * lib/rules/es/distribution/) and the free-tier indicative band
 * (FREE_TIER_*): UI_SPEC.md §5 keeps scoring weights unpublished, and the
 * free-tier band is a different product surface entirely - neither one is
 * an assumption this paid report's own numbers rest on. Also excludes
 * RENT_MATRIX_LONG_TERM_PER_M2/SHORT_TERM_PER_M2 (feed no calculation
 * today - collectPlaceholders() excludes them for the same reason) and
 * NEIGHBORHOOD_RENT_LONG_TERM/SHORT_TERM (rent-provenance.ts only compares
 * the customer's rate against these for §6.1's disclosure; they never
 * enter this outcome's own cashflow/tax/exit numbers).
 */

import {
  ACQUISITION_RATES,
  BANK_FEE,
  BASE_OCCUPANCY_LONG_TERM,
  BASE_OCCUPANCY_SHORT_TERM,
  CAPITAL_GAINS_TAX_RATE_NON_RESIDENT,
  CORRECTION_FACTORS_FIRST_ESTIMATE_YEAR,
  CORRECTION_FACTORS_LAST_YEAR,
  CPI_PERCENT_BY_YEAR,
  DEFAULT_BUILDING_SHARE_OF_VALUE,
  DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO,
  DEFAULT_MIN_REQUIRED_RETURN,
  DEFAULT_RENOVATION_IMPROVEMENT_SHARE,
  DEFAULT_USABLE_TO_BUILT_AREA_RATIO,
  DEPRECIATION_BUILDING_SHARE,
  DEPRECIATION_RATE,
  DEPRECIATION_SCENARIO_FACTORS,
  FINANCING_STRATEGIES,
  HYBRID_SHARE_LONG_TERM,
  HYBRID_SHARE_SHORT_TERM,
  LEGAL_ADVICE_FEE,
  MAINTENANCE_RATE,
  NON_RESIDENT_INTEREST_SPREAD,
  NON_RESIDENT_WITHHOLDING_RATE,
  PROPERTY_MANAGEMENT_FEE,
  PROPERTY_TAX_IBI_RATE,
  RENOVATION_DURATION_MONTHS_BY_TIER,
  RENOVATION_STRATEGIES,
  RENT_GROWTH_BY_YEAR,
  RENTAL_INCOME_TAX_RATE_EU,
  RENTAL_INCOME_TAX_RATE_NON_EU,
  SCENARIOS,
  TOTAL_INSURANCE_ANNUAL,
  TOTAL_UTILITIES_PER_M2_ANNUAL,
  VALUE_GROWTH_ANNUAL,
} from "./parameters";
import { rentalIncomeTaxTreatment } from "./tax";
import type {
  FinancingStrategyId,
  Parameter,
  RenovationStrategyId,
  RentalStrategy,
  Residency,
  ScenarioId,
  TaxResidency,
} from "./types";

export function collectUsedParameters(args: {
  scenario: ScenarioId;
  rentalStrategy: RentalStrategy;
  renovationStrategy: RenovationStrategyId;
  /** Omitted entirely from the result when not given, rather than guessed. */
  financingStrategy?: FinancingStrategyId;
  /** Treated as resident (NON_RESIDENT_INTEREST_SPREAD not applied) when not given. */
  residency?: Residency;
  /** Defaults to true (EU resident), matching engine.ts's own default. */
  euResident?: boolean;
  /** Where the investor is tax-resident; takes precedence over euResident. */
  taxResidency?: TaxResidency;
  buildingShareOfValueProvided: boolean;
  renovationImprovementShareProvided: boolean;
  /**
   * Whether the customer supplied the renovation's duration themselves
   * (fase C stap 2). False means RENOVATION_DURATION_MONTHS_BY_TIER's own
   * figure drove year 1's proration, which makes it an unverified
   * assumption this outcome rests on.
   */
  renovationDurationProvided: boolean;
  minRequiredReturnProvided: boolean;
  cadastralValueProvided: boolean;
  usableAreaM2Provided: boolean;
  occupancyLongTermProvided: boolean;
  occupancyShortTermProvided: boolean;
}): Parameter<unknown>[] {
  const params: Parameter<unknown>[] = [
    // Exploitatiekosten - every outcome.
    MAINTENANCE_RATE,
    BANK_FEE,
    PROPERTY_MANAGEMENT_FEE,
    PROPERTY_TAX_IBI_RATE,
    TOTAL_INSURANCE_ANNUAL,
    TOTAL_UTILITIES_PER_M2_ANNUAL,
    // Aankoopkosten - every outcome.
    ACQUISITION_RATES,
    LEGAL_ADVICE_FEE,
    // Belasting - every outcome.
    DEPRECIATION_RATE,
    DEPRECIATION_BUILDING_SHARE,
    CAPITAL_GAINS_TAX_RATE_NON_RESIDENT,
    NON_RESIDENT_WITHHOLDING_RATE,
    // Waardeontwikkeling/indexering - every outcome with a multi-year projection.
    RENT_GROWTH_BY_YEAR,
    CPI_PERCENT_BY_YEAR,
    CORRECTION_FACTORS_LAST_YEAR,
    CORRECTION_FACTORS_FIRST_ESTIMATE_YEAR,
  ];

  // Huur (income.ts): both occupancy baselines and both hybrid shares only
  // apply to a hybrid outcome; longTerm/shortTerm-only outcomes use one of
  // each pair. buildIncomeModel() always computes both IncomeLines, but
  // only the selected strategy's figure travels on to the rest of the
  // chain (the same reasoning collectPlaceholders() already documents).
  if (
    (args.rentalStrategy === "longTerm" || args.rentalStrategy === "hybrid") &&
    !args.occupancyLongTermProvided
  ) {
    params.push(BASE_OCCUPANCY_LONG_TERM);
  }
  if (
    (args.rentalStrategy === "shortTerm" || args.rentalStrategy === "hybrid") &&
    !args.occupancyShortTermProvided
  ) {
    params.push(BASE_OCCUPANCY_SHORT_TERM);
  }
  if (args.rentalStrategy === "hybrid") {
    params.push(HYBRID_SHARE_LONG_TERM, HYBRID_SHARE_SHORT_TERM);
  }
  if (!args.usableAreaM2Provided) {
    params.push(DEFAULT_USABLE_TO_BUILT_AREA_RATIO);
  }

  // Renovatie: only the selected tier's five fields ever entered this
  // outcome's numbers - the two tiers not chosen belong to the comparison
  // table (EngineResult.renovationStrategies), not to this outcome.
  const renovation = RENOVATION_STRATEGIES[args.renovationStrategy];
  params.push(
    renovation.capex,
    renovation.rentMultiplier,
    renovation.maintenanceFactor,
    renovation.utilitiesEfficiency,
    renovation.timeToRentMonths,
  );
  if (!args.renovationDurationProvided) {
    params.push(RENOVATION_DURATION_MONTHS_BY_TIER);
  }
  if (!args.renovationImprovementShareProvided) {
    params.push(DEFAULT_RENOVATION_IMPROVEMENT_SHARE);
  }

  // Financiering: only the resolved tier's own rate/LTV/term - the same
  // "only what was actually selected" rule as renovation.
  if (args.financingStrategy !== undefined) {
    const financing = FINANCING_STRATEGIES[args.financingStrategy];
    params.push(financing.ltv, financing.loanTermYears, financing.interestRate);
  }
  if (args.residency === "nonResident") {
    params.push(NON_RESIDENT_INTEREST_SPREAD);
  }

  // Scenario-laag: only this scenario's own five stress-test multipliers -
  // the other two scenarios' multipliers never entered this outcome.
  const scenarioParams = SCENARIOS[args.scenario];
  params.push(
    scenarioParams.rentLevelMultiplier,
    scenarioParams.occupancyMultiplier,
    scenarioParams.interestRateDelta,
    scenarioParams.utilitiesMultiplier,
    scenarioParams.maintenanceInflationMultiplier,
  );

  // Belasting, continued: only this scenario's own depreciation factor and
  // building-share fallback, and only the tax rate the residency answer
  // actually selects.
  params.push(DEPRECIATION_SCENARIO_FACTORS[args.scenario]);
  if (!args.buildingShareOfValueProvided) {
    params.push(DEFAULT_BUILDING_SHARE_OF_VALUE);
  }
  if (!args.cadastralValueProvided) {
    params.push(DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO);
  }
  // Derived through the same helper the calculation uses, so the rate the
  // report names can never differ from the rate that was applied.
  params.push(
    rentalIncomeTaxTreatment(args).deductionsAllowed
      ? RENTAL_INCOME_TAX_RATE_EU
      : RENTAL_INCOME_TAX_RATE_NON_EU,
  );
  if (!args.minRequiredReturnProvided) {
    params.push(DEFAULT_MIN_REQUIRED_RETURN);
  }

  // Waardeontwikkeling, continued: only this scenario's own growth rate.
  params.push(VALUE_GROWTH_ANNUAL[args.scenario]);

  return params;
}
