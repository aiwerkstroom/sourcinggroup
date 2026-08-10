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
