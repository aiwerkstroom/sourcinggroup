/**
 * TSG Yield Engine - Spain (ES) rule types.
 *
 * These types mirror the input sections of TSG_Model_v3.xlsx:
 * "Property Input", the investor constraints on "Costs & Income",
 * and the selection cells that drive the model.
 */

export type RentalStrategy = "longTerm" | "shortTerm" | "hybrid";

/** Maps to the Excel deal types Minimal / Light / Heavy (renovation strategies A/B/C). */
export type RenovationStrategyId = "minimal" | "light" | "heavy";

/** Financing strategies A (low), B (medium), C (high leverage). */
export type FinancingStrategyId = "low" | "medium" | "high";

export type ScenarioId = "conservative" | "base" | "optimistic";

export type Residency = "resident" | "nonResident";

/** "Property Input" sheet. */
export interface PropertyInput {
  name: string;
  region: string;
  neighborhood?: string;
  address?: string;
  propertyType?: string;
  marketSegment?: string;
  currentRentStatus?: string;
  livingAreaM2: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  constructionYear?: number;
  energyLabel?: string;
  purchasePrice: number;
  ownMoney?: number;
}

/**
 * Investor constraints ("Costs & Income" B4-D26). These are acceptance
 * criteria, not calculation inputs: the model computes first and then
 * reports whether the outcome stays within these bounds.
 */
export interface InvestorConstraints {
  totalBudget: number;
  maxRenovationBudget: number;
  /** Optional; when omitted the LTV of the selected financing strategy is used. */
  preferredLtv?: number;
  minLtv: number;
  maxLtv: number;
  riskTolerance?: "low" | "medium" | "high";
  minRoiTarget?: number;
  minMonthlyCashflow: number;
  maxMonthlyDebt: number;
}

/**
 * Selection cells of the Excel that a user (or a later UI) has to choose.
 * The rent €/m² values come from the rent matrix / neighborhood reference
 * table; the Excel hardcodes a matrix column per case.
 */
export interface ModelSelections {
  /** €/m²/month long-term, e.g. from the neighborhood reference table. */
  rentPerM2LongTerm: number;
  /** €/m²/month short-term. Reference: short-term averages ~1.7x long-term. */
  rentPerM2ShortTerm: number;
  rentalStrategy: RentalStrategy;
  /** Excel "Prefered deal type" (D18) -> renovation strategy. */
  renovationStrategy: RenovationStrategyId;
  /** Excel "Selected Strategy" (D117). */
  financingStrategy: FinancingStrategyId;
  /**
   * Dutch buyers are non-resident by definition (Changelog D124: decided).
   * Residents skip the non-resident interest spread.
   */
  residency: Residency;
  /** EU/EEA residents pay 19% rental income tax, non-EU 24%. */
  euResident?: boolean;
}

export interface EngineInput {
  property: PropertyInput;
  constraints: InvestorConstraints;
  selections: ModelSelections;
}

/** One row of the income model (long-term or short-term). */
export interface IncomeLine {
  rentPerM2: number;
  baseMonthlyRent: number;
  baseAnnualRent: number;
  occupancy: number;
  annualIncomeAtOccupancy: number;
  rentMultiplier: number;
  adjustedAnnualIncome: number;
}

export interface IncomeModel {
  longTerm: IncomeLine;
  shortTerm: IncomeLine;
  hybridShareLongTerm: number;
  hybridShareShortTerm: number;
  hybridGrossAnnualIncome: number;
  /** Gross annual income for the selected rental strategy. */
  selectedGrossAnnualIncome: number;
}

export interface RenovationStrategyResult {
  id: RenovationStrategyId;
  label: string;
  capex: number;
  rentMultiplier: number;
  maintenanceFactor: number;
  utilitiesEfficiency: number;
  timeToRentMonths: number;
  withinMaxRenovationBudget: boolean;
}

export interface FinancingStrategyResult {
  id: FinancingStrategyId;
  label: string;
  ltv: number;
  loanTermYears: number;
  interestRate: number;
  loanType: "amortising";
  withinAllowedLtv: boolean;
  /** Monthly annuity on purchasePrice x strategy LTV at the strategy rate. */
  monthlyDebtService: number;
  monthlyDebtWithinLimit: boolean;
}

export interface SelectedFinancing {
  strategy: FinancingStrategyId;
  /** MAX(minLtv, MIN(maxLtv, preferredLtv ?? strategy LTV)) - Excel D119. */
  ltv: number;
  loanTermYears: number;
  /** Base (resident) rate of the selected strategy - Excel D123. */
  interestRate: number;
  /** 0 for residents; parameters.nonResidentInterestSpread otherwise. */
  nonResidentSpread: number;
  mortgageAmount: number;
}

/**
 * One year of the amortization schedule (MODEL_SPEC_FASE1B §4): the
 * interest/principal split of that year's annuity payments, needed because
 * only the interest portion is tax-deductible and it shrinks every year.
 */
export interface AmortizationYear {
  yearNumber: number;
  openingBalance: number;
  interestPaid: number;
  principalPaid: number;
  closingBalance: number;
}

export interface AcquisitionCosts {
  purchasePrice: number;
  renovationCosts: number;
  transferTaxITP: number;
  stampDutyAJD: number;
  notaryFee: number;
  registrationFee: number;
  legalAdvice: number;
  agencyFees: number;
  bankFee: number;
  total: number;
  mortgageAmount: number;
  equityRequired: number;
  withinTotalBudget: boolean;
  renovationWithinBudget: boolean;
}

export interface FixedOperatingCosts {
  propertyTaxIBI: number;
  insurance: number;
  bankAccountFee: number;
  /** mortgage x (selected rate + non-resident spread) - Excel D165. */
  mortgageInterest: number;
  total: number;
}

export interface ScenarioResult {
  id: ScenarioId;
  rentLevelMultiplier: number;
  occupancyMultiplier: number;
  interestRateDelta: number;
  utilitiesMultiplier: number;
  maintenanceInflationMultiplier: number;
  grossIncome: number;
  propertyManagement: number;
  maintenance: number;
  utilities: number;
  /** IBI + insurance + bank account fee, included in NOI and total opex (v3). */
  fixedCosts: number;
  noi: number;
  interestRate: number;
  annualInterestOnly: number;
  annualDebtService: number;
  totalOpexInclDebtService: number;
  annualCashflow: number;
  monthlyCashflow: number;
  meetsMinMonthlyCashflow: boolean;
  dscr: number;
  dscrVerdict: "yes" | "breakEven" | "no";
}

export interface TaxScenario {
  id: ScenarioId;
  depreciation: number;
  deductibleCosts: number;
}

export interface TaxResult {
  scenarios: TaxScenario[];
  /** Calculator uses the base scenario - Reference Info I47/I48. */
  grossRentalIncomeBase: number;
  deductibleCostsBase: number;
  taxableIncomeBase: number;
  taxRate: number;
  taxDueBase: number;
}

/**
 * One projected year of after-tax cashflow (MODEL_SPEC_FASE1B §4, revised).
 * Costs that scale with rent (property management) use the rent index;
 * CPI-indexed cost lines (maintenance, utilities, insurance, bank fee, and
 * IBI - levied on the cadastral value, approximated with CPI absent a
 * cadastral-value series) use the cost index; depreciation stays flat
 * (tied to the original acquisition cost, not indexed). Year 1's rent (and
 * the property management fee riding on it) is additionally prorated for
 * the renovation's lease-up vacancy; every other cost line and the full
 * annuity run for the whole year regardless.
 */
export interface ProjectionYear {
  yearNumber: number;
  calendarYear: number;
  extrapolated: boolean;
  grossIncome: number;
  propertyManagement: number;
  maintenance: number;
  utilities: number;
  propertyTaxIBI: number;
  insurance: number;
  bankAccountFee: number;
  fixedCosts: number;
  noi: number;
  interestPaid: number;
  principalPaid: number;
  debtService: number;
  mortgageBalance: number;
  preTaxCashflow: number;
  depreciation: number;
  deductibleCosts: number;
  taxableIncome: number;
  taxDue: number;
  cashflowAfterTax: number;
}

/**
 * Exit assumptions the app cannot derive or estimate on its own
 * (MODEL_SPEC_FASE1B §5). No defaults exist for these anywhere in the
 * engine - a report must not silently guess a selling commission or a
 * municipal capital gains tax.
 */
export interface ExitAssumptions {
  /**
   * Selling agency commission as a fraction of the sale price (typically
   * all-in, incl. IVA). TODO [BESLISSING]: MODEL_SPEC_FASE1B §5 gives a
   * 3-5% + IVA range but leaves the exact figure open; must be set
   * per deal, not defaulted.
   */
  sellingCommissionRate: number;
  /**
   * Municipal capital gains tax (plusvalía municipal) for this specific
   * sale, in euros. TODO [BESLISSING]: municipality-specific (depends on
   * the cadastral land value and the holding period); requires a real
   * Valencia figure, not an estimate.
   */
  municipalCapitalGainsTax: number;
}

/** Exit outcome for one scenario at the end of the holding period (MODEL_SPEC_FASE1B §5, IRNR-corrected). */
export interface ExitResult {
  scenario: ScenarioId;
  holdingYears: number;
  /** purchasePrice x waardegroei^holdingYears. */
  sellingPrice: number;
  sellingCommission: number;
  municipalCapitalGainsTax: number;
  /**
   * "Valor de transmisión" (IRNR): sellingPrice minus the transfer costs
   * the seller bears (commission, plusvalía). This is the basis the
   * capital gain is computed from, distinct from sellingPrice itself -
   * those same two costs are also subtracted again in netSaleProceeds,
   * which is a different quantity (actual cash received), not a double
   * count of the same deduction.
   */
  transferValueForCapitalGainsTax: number;
  /** renovationCosts x renovationImprovementShare - the "mejora" portion added to the acquisition value. 0 unless the caller substantiates a nonzero share. */
  renovationImprovementValue: number;
  /** Sum of ProjectionYear.depreciation across the holding period - exactly what the tax layer (§4) actually deducted each year, not a separate recomputation. */
  cumulativeDepreciation: number;
  /** purchasePrice + ITP + AJD + notary + registration + legal advice + renovationImprovementValue - cumulativeDepreciation - the acquisition costs the law lets you deduct from the capital gain. */
  acquisitionValueForCapitalGainsTax: number;
  capitalGain: number;
  capitalGainsTax: number;
  mortgageBalanceAtExit: number;
  netSaleProceeds: number;
  /**
   * Non-resident 3% withholding on the sale price (Modelo 211). Purely
   * informational: an advance on the capital gains tax, settled via
   * Modelo 210, not an additional cost - so it is NOT subtracted in
   * netSaleProceeds.
   */
  nonResidentWithholdingAdvance: number;
}

export interface EngineResult {
  income: IncomeModel;
  renovationStrategies: RenovationStrategyResult[];
  selectedRenovation: RenovationStrategyResult;
  financingStrategies: FinancingStrategyResult[];
  selectedFinancing: SelectedFinancing;
  acquisition: AcquisitionCosts;
  fixedOperatingCosts: FixedOperatingCosts;
  utilitiesBaseAnnual: number;
  scenarios: ScenarioResult[];
  tax: TaxResult;
}
