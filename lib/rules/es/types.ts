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

/**
 * Provenance audit (herkomstaudit) for every value in parameters.ts. Not
 * every number backing this model carries the same weight: some are
 * statutory rates or cited market data, some are TSG's own deliberate
 * modeling conventions, and some are stand-ins that were never verified
 * against a real source and must be replaced before a report ships for an
 * actual property. The label lives on the value's type, not in a comment,
 * so a computation can inspect which parameters it drew on and whether
 * any of them are still PLACEHOLDER (see outcome.ts, ScenarioOutcome.provenance).
 *
 * Classification test - applied to all 80 parameters: does the value make
 * a claim about REALITY, or about the MODEL?
 *
 * - A claim about reality (rent prices, costs, premiums, interest rates,
 *   renovation amounts, areas, growth rates, occupancy) can only ever be
 *   SOURCED or PLACEHOLDER. ESTIMATE is not permitted there - a
 *   real-world claim either has a citation or it doesn't; there is no
 *   defensible middle ground.
 * - A claim about the model (what a scenario means, an allocation, a
 *   multiplier that defines a product tier, a threshold) can be ESTIMATE:
 *   a deliberate, defensible modeling/product convention, not a claim
 *   about a verifiable external fact.
 *
 * - SOURCED: a named external source with a date backs this number.
 * - ESTIMATE: reserved for model-definition choices per the test above
 *   (e.g. what "conservative" means as a stress-test severity, what
 *   "hybrid" means as an LT/ST blend, a financing tier's LTV/term).
 * - PLACEHOLDER: a reality claim with no external verification; must be
 *   replaced with real, deal-specific or verified data before production
 *   use. Any value where SOURCED vs ESTIMATE was genuinely in doubt was
 *   assigned PLACEHOLDER, not the more flattering label.
 */
export type ParameterProvenance = "SOURCED" | "ESTIMATE" | "PLACEHOLDER";

interface ParameterBase<T> {
  /** Stable identifier for provenance tooling, e.g. collecting every PLACEHOLDER a computation touched. */
  name: string;
  value: T;
}

export interface SourcedParameter<T> extends ParameterBase<T> {
  provenance: "SOURCED";
  source: string;
  date: string;
}

export interface EstimateParameter<T> extends ParameterBase<T> {
  provenance: "ESTIMATE";
  reasoning: string;
}

export interface PlaceholderParameter<T> extends ParameterBase<T> {
  provenance: "PLACEHOLDER";
  reasoning: string;
}

/** A single value with its provenance audit trail attached. */
export type Parameter<T> = SourcedParameter<T> | EstimateParameter<T> | PlaceholderParameter<T>;

/** PLACEHOLDER < ESTIMATE < SOURCED: how certain each provenance label is. */
const PROVENANCE_RANK: Record<ParameterProvenance, number> = {
  PLACEHOLDER: 0,
  ESTIMATE: 1,
  SOURCED: 2,
};

/**
 * The weakest (least certain) of several provenance labels. A derived
 * value (a sum, a lookup composed from several parameters) is only as
 * trustworthy as its weakest input - it cannot be SOURCED if any
 * component it was built from is a PLACEHOLDER.
 */
export function weakestProvenance(
  provenances: readonly [ParameterProvenance, ...ParameterProvenance[]],
): ParameterProvenance {
  return provenances.reduce((weakest, p) =>
    PROVENANCE_RANK[p] < PROVENANCE_RANK[weakest] ? p : weakest,
  );
}

/**
 * Builds a derived Parameter<T> (e.g. a sum of several cost lines) whose
 * provenance is computed - not hand-typed - as the weakest of its
 * components. This is what makes the weakest-link rule enforceable: if a
 * component's own provenance is downgraded later, every value derived
 * from it downgrades automatically, instead of silently keeping a label
 * that no longer reflects its inputs.
 */
export function deriveParameter<T>(
  name: string,
  value: T,
  components: readonly [Parameter<unknown>, ...Parameter<unknown>[]],
): Parameter<T> {
  let weakest = components[0];
  for (const c of components) {
    if (PROVENANCE_RANK[c.provenance] < PROVENANCE_RANK[weakest.provenance]) weakest = c;
  }
  if (weakest.provenance === "SOURCED") {
    return { name, value, provenance: "SOURCED", source: weakest.source, date: weakest.date };
  }
  return {
    name,
    value,
    provenance: weakest.provenance,
    reasoning: `Derived value; weakest-link component is ${weakest.name} (${weakest.provenance}): ${weakest.reasoning}`,
  };
}

/** "Property Input" sheet. */
export interface PropertyInput {
  name: string;
  region: string;
  neighborhood?: string;
  address?: string;
  propertyType?: string;
  marketSegment?: string;
  currentRentStatus?: string;
  /**
   * Superficie útil (bruikbaar oppervlak), m² - the rent estimate
   * (income.ts) uses this, not superficie construida. Optional when only
   * builtAreaM2 is known: derived via DEFAULT_USABLE_TO_BUILT_AREA_RATIO,
   * a PLACEHOLDER (MODEL_SPEC.md §17).
   */
  usableAreaM2?: number;
  /**
   * Superficie construida (gebouwd oppervlak), m² - utilities per m²
   * (operating.ts) use this, and it is also the basis for deriving
   * usableAreaM2 when that isn't known directly.
   */
  builtAreaM2: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  constructionYear?: number;
  energyLabel?: string;
  purchasePrice: number;
  ownMoney?: number;
  /**
   * Gastos de comunidad, €/year - the building's community/condo fee.
   * Mandatory, no default anywhere in the engine: this figure varies too
   * much per building (size, amenities, elevator, shared services) to
   * estimate generically the way a rate-based cost can (MODEL_SPEC.md
   * §15). A caller without a real figure yet should not guess one here.
   */
  communityFeesAnnual: number;
  /**
   * Valor catastral desglosado (Catastro) - the property's cadastral value
   * split into land (suelo) and building (construcción). Optional: when
   * provided, IBI is computed over suelo + construcción instead of
   * approximating it with the purchase price, and the depreciation base
   * uses construcción directly instead of
   * purchasePrice x DEFAULT_BUILDING_SHARE_OF_VALUE (MODEL_SPEC.md §16).
   */
  cadastralValue?: CadastralValue;
  /**
   * Whether this property holds a valid título habilitante (the license a
   * Spanish tourist/short-term rental legally requires). Mandatory, no
   * default: unlike gastos de comunidad this is a plain yes/no fact about
   * the property, always knowable, never a generic estimate. Gates
   * ModelSelections.rentalStrategy "shortTerm"/"hybrid" (MODEL_SPEC.md
   * §18) - selecting either without a valid license is rejected by
   * validateEngineInput(), and EngineResult.rentalStrategies reports
   * short-term/hybrid as unavailable with the reason, rather than
   * silently as zero.
   */
  hasTouristRentalLicense: boolean;
}

/** Valor catastral desglosado - suelo (land) and construcción (building), both in €. */
export interface CadastralValue {
  suelo: number;
  construccion: number;
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
  /** Gastos de comunidad - PropertyInput.communityFeesAnnual, passed through unchanged; not rate-derived like the other lines. */
  communityFees: number;
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
  /** Gastos de comunidad for this calendar year, CPI-indexed like the other fixed cost lines. */
  communityFees: number;
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

/**
 * IRR outcome (MODEL_SPEC_FASE1B §6). Not every cashflow series has a
 * defined internal rate of return - only a series that never changes sign
 * (all outflows, or all inflows) has none, since no rate can zero an NPV
 * where every term shares the same sign. `irr.irr` can be negative: that is
 * a real answer ("the investment lost value"), not a failure. The app must
 * show `defined: false` plainly ("no solution"), never a fabricated or
 * clamped number.
 */
export type IrrResult =
  | { defined: true; irr: number; iterations: number }
  | { defined: false; reason: string };

/** One year of the assembled scenario outcome (MODEL_SPEC_FASE1B §7). */
export interface ScenarioProjectionYear {
  yearNumber: number;
  calendarYear: number;
  cashflowAfterTax: number;
  /** Running sum of cashflowAfterTax through this year - operating cashflow only, the sale is not included. */
  cumulativeCashflow: number;
  /** purchasePrice x propertyValueIndex(scenario, yearNumber) - the same index used for the exit price. */
  propertyValue: number;
  mortgageBalance: number;
  /** propertyValue - mortgageBalance: the investor's equity stake in the property at this point, distinct from cash received. */
  equityBuilt: number;
}

/**
 * Whether the equity the deal requires fits the investor's available
 * equity (MODEL_SPEC_FASE1B §7, added per correction - this check did not
 * exist before). `equityAvailable` is the investor's own stated capital
 * (PropertyInput.ownMoney); when it is not provided the check cannot run.
 */
export interface EquityFitCheck {
  equityRequired: number;
  equityAvailable: number | undefined;
  /** null when equityAvailable is unknown. */
  fitsWithinAvailableEquity: boolean | null;
}

/**
 * Whether the scenario's IRR meets the investor's hurdle rate
 * (MODEL_SPEC_FASE1B §7, added per correction). `minRequiredReturn`
 * should come from InvestorConstraints.minRoiTarget when the investor has
 * stated one; DEFAULT_MIN_REQUIRED_RETURN (0) is only the fallback.
 */
export interface ReturnRequirementCheck {
  minRequiredReturn: number;
  /** null when the IRR itself is not defined. */
  meetsMinRequiredReturn: boolean | null;
}

/**
 * The full per-scenario outcome (MODEL_SPEC_FASE1B §7): what the
 * resultaatpagina and the PDF are built on. A judgment based only on
 * cashflow or DSCR thresholds can reject a deal the IRR would justify -
 * this structure carries both the threshold checks (§1-§4: cashflow, DSCR,
 * LTV, budget) via `years`/`exit`, and the return-based view (IRR, total
 * return, payback) side by side, rather than collapsing to one verdict.
 */
export interface ScenarioOutcome {
  scenario: ScenarioId;
  years: ScenarioProjectionYear[];
  exit: ExitResult;
  irr: IrrResult;
  /** (operating cashflow total + net sale proceeds - equity invested) / equity invested - a total return, not annualized like the IRR. */
  totalReturn: number;
  /** First year the cumulative OPERATING cashflow (excl. the sale) recoups the equity invested; null if it never does within the horizon. */
  paybackYear: number | null;
  equityFit: EquityFitCheck;
  returnRequirement: ReturnRequirementCheck;
  /**
   * The PLACEHOLDER-provenance parameters this specific outcome's numbers
   * actually depend on, given its scenario, rental strategy and renovation
   * strategy selections - not every PLACEHOLDER in parameters.ts, and not
   * a single boolean flag. Empty when the outcome happens to rest on none
   * (not possible today, since MAINTENANCE_RATE and BANK_FEE apply to
   * every outcome, but the type does not assume that stays true). The
   * report reads this list to name exactly which conclusions rest on
   * unconfirmed assumptions (MODEL_SPEC.md §14).
   */
  placeholdersUsed: Parameter<unknown>[];
}

/**
 * A rental strategy this property cannot legally offer right now, and why
 * - not a zeroed-out result (MODEL_SPEC.md §18). "shortTerm"/"hybrid"
 * without PropertyInput.hasTouristRentalLicense are reported here rather
 * than computed: a report reads this to explain why they're missing.
 */
export interface UnavailableRentalStrategy {
  strategy: RentalStrategy;
  reason: string;
}

/**
 * Which rental strategies this property can legally offer (MODEL_SPEC.md
 * §18). `available` is what a strategy selector may offer; `unavailable`
 * carries the excluded strategies with their reason, for a report to
 * explain the absence rather than leave it unexplained. "longTerm" is
 * always available - only "shortTerm"/"hybrid" require a título
 * habilitante.
 */
export interface RentalStrategyAvailability {
  available: RentalStrategy[];
  unavailable: UnavailableRentalStrategy[];
}

/**
 * One anchor point of a piecewise-linear dimension score curve
 * (SCORE_SPEC.md §2). `x` is the engine value being scored - the unit
 * differs per dimension (€/month for cashflow, a bare ratio for DSCR,
 * percentage points for the return surplus, a count for data certainty) -
 * and `score` is the 0-10 dimension score at exactly that point.
 *
 * A curve is a list of these, strictly ascending in `x`. Between anchors
 * the score is interpolated linearly; outside the outermost anchors it is
 * clamped to that anchor's own score. Clamping to the endpoint value
 * rather than to a fixed 0/10 is what lets the data-certainty curve run
 * downward (0 placeholders = 10, >= 20 = 0) with the same machinery.
 */
export interface ScoreAnchor {
  x: number;
  score: number;
}

/**
 * The four discrete steps of the feasibility dimension (SCORE_SPEC.md
 * §2.4) - the only dimension that is not a continuous curve, because a
 * deal that cannot be financed is not partially financeable.
 */
export interface FeasibilityScoreLevels {
  /** Equity insufficient AND renovation budget exceeded. */
  bothChecksFail: number;
  /** Exactly one of the two checks fails. */
  oneCheckFails: number;
  /** Both checks pass, but the relative margin is below the threshold. */
  bothPassNarrowMargin: number;
  /** Both checks pass with a margin at or above the threshold. */
  bothPassAmpleMargin: number;
}

/**
 * The five TSG score dimensions (SCORE_SPEC.md §2), each 0.0-10.0 with one
 * decimal. Named for what they measure rather than for the engine field
 * they read, since several read more than one:
 *
 * - cashflow: monthly cashflow of the base scenario.
 * - debtResilience: DSCR of the base scenario.
 * - returnVsRequirement: the base scenario's IRR minus the investor's own
 *   hurdle rate - a surplus, not the absolute IRR, so two investors with
 *   different requirements score the same property differently.
 * - feasibility: the equity-fit and renovation-budget checks.
 * - dataCertainty: how many PLACEHOLDER parameters the outcome rests on.
 */
export interface TsgDimensionScores {
  cashflow: number;
  debtResilience: number;
  returnVsRequirement: number;
  feasibility: number;
  dataCertainty: number;
}

export type TsgScoreDimension = keyof TsgDimensionScores;

/**
 * A complete TSG score (SCORE_SPEC.md §1/§3): the five dimensions plus the
 * weighted total. Both the dimension scores and the total carry one
 * decimal; the total is computed from the *rounded* dimension scores, the
 * way SCORE_SPEC.md §4's worked example does, so the arithmetic a reader
 * can redo by hand from the published dimension figures matches the
 * published total exactly.
 */
export interface TsgScore {
  dimensions: TsgDimensionScores;
  /** Sum of (dimension score x weight), rounded to one decimal. */
  total: number;
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
  rentalStrategies: RentalStrategyAvailability;
}
