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
 * Where the investor is tax-resident, which decides how Spain taxes their
 * rental income under IRNR. Two things hang off it, not one:
 *
 *  - the RATE: 19% for EU/EEA residents, 24% for everyone else;
 *  - the BASE: EU/EEA residents are taxed on net income (rent minus
 *    interest, comunidad, IBI, insurance, maintenance, management and
 *    depreciation); non-EU residents are taxed on GROSS rent with no
 *    deductions at all.
 *
 * The second half is the one that bites. A 19%-to-24% rate step looks
 * like a quarter more tax; combined with losing every deduction it is
 * routinely two to three times as much. Modelling only the rate - which
 * is what this code did until this change - understates a non-EU
 * investor's tax badly enough to invert the conclusion of a report.
 *
 * "netherlands" and "otherEu" are treated identically by Spanish IRNR
 * today. They are separate options because the customer is answering a
 * question about themselves, not about Spanish tax law, and "ander
 * EU-land" is a different fact about them than "Nederland" - one that
 * matters for their own domestic treatment and may matter here later.
 */
export type TaxResidency = "netherlands" | "otherEu" | "nonEu";

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
  /**
   * Anticipated community special assessment (derrama) for upcoming works
   * or repairs, €, total - datakwaliteitsfix stap 4. Optional: unlike
   * communityFeesAnnual this is a one-off, not-yet-certain cost, so the
   * wizard offers it behind a checkbox rather than asking outright. When
   * given, spread evenly over PROJECTION_YEARS.value and added to
   * FixedOperatingCosts.derramas - see operating.ts's own reasoning for
   * why spreading, not a one-off year-1 charge, is this fix's chosen
   * approach.
   */
  upcomingDerramasEstimate?: number;
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
  /**
   * EU/EEA residents pay 19% rental income tax, non-EU 24%.
   *
   * @deprecated Superseded by taxResidency, which also carries whether
   * deductions are allowed - the half this flag could never express. Kept
   * so existing callers keep compiling; taxResidency wins when both are
   * given. A caller supplying only this still gets the old behaviour.
   */
  euResident?: boolean;
  /**
   * Where the investor is tax-resident (wizard step 3). Decides both the
   * rental income tax rate and whether costs are deductible at all - see
   * TaxResidency.
   *
   * Optional so that callers predating this field keep their previous
   * behaviour: absent, the engine falls back to euResident, and absent
   * that too, to EU treatment. That fallback is what keeps the reference
   * case's anchor where it was, since EU treatment is exactly the fixed
   * assumption this replaces.
   */
  taxResidency?: TaxResidency;
  /**
   * Declares that one of the two rates above was taken from the rent this
   * property is actually being let at today, rather than from the
   * neighbourhood reference or a free-hand estimate. Drives
   * EngineResult.rentInputProvenance's "actualCurrentRent" status.
   *
   * Declared, not inferred: an observed rent can land anywhere relative to
   * the wijk average, including exactly on it, so no comparison could
   * recover this fact from the number alone.
   *
   * The engine takes this on trust, the same way it takes any other value
   * in ModelSelections. It cannot check the precondition itself -
   * PropertyInput.currentRentStatus is a free-form string whose values are
   * the form's convention, not an engine enum - so enforcing "only when
   * the property is marked as let and a rent was entered" is the caller's
   * job, and the paid wizard's step 3 is where that happens.
   */
  rentPerM2FromActualCurrentRent?: "longTerm" | "shortTerm";
  /**
   * Achievable occupancy, long-term, as a fraction (0.9 = 90%) - datakwaliteitsfix
   * stap 3. Optional: the free indication already tells the customer this is
   * unverified there and "u vult het zelf in het betaalde rapport" (see
   * free-tier-disclosures.ts), so the paid wizard offers the field but does not
   * require it. Absent, the engine falls back to BASE_OCCUPANCY_LONG_TERM's own
   * PLACEHOLDER (parameters.ts) - a market claim with no external citation.
   * Only applies when rentalStrategy uses the long-term rate (longTerm or hybrid).
   */
  occupancyLongTerm?: number;
  /** Same as occupancyLongTerm, for the short-term rate (BASE_OCCUPANCY_SHORT_TERM). */
  occupancyShortTerm?: number;
}

/**
 * Inputs needed to build a per-scenario ScenarioOutcome (MODEL_SPEC_FASE1B
 * §7) inside runEngine() - a holding period and the two exit assumptions
 * ExitAssumptions has no default for (MODEL_SPEC_FASE1B §5: selling
 * commission, municipal capital gains tax). Both must come from the
 * caller; nothing here may be guessed.
 */
export interface ExitPlanningInput {
  assumptions: ExitAssumptions;
  /** Holding period in years. Defaults to PROJECTION_YEARS.value (10, MODEL_SPEC_FASE1B §2's own recommendation) when omitted. */
  holdingYears?: number;
}

export interface EngineInput {
  property: PropertyInput;
  constraints: InvestorConstraints;
  selections: ModelSelections;
  /**
   * Optional: when omitted, runEngine() returns
   * EngineResult.scenarioOutcomes as null rather than fabricating exit
   * assumptions to produce one. Provide this to get a full per-scenario
   * ScenarioOutcome (years, exit, IRR, TSG score, percentile) without a
   * separate manual call to buildScenarioOutcome() and its prerequisites.
   */
  exitPlanning?: ExitPlanningInput;
  /**
   * Optional: set by buildEngineInput() when the wizard was entered via a
   * chosen listing (SOURCING_SPEC.md §4/§7 step 4), already comparing the
   * submitted field values against the listing's own - runEngine() does
   * no comparison of its own, only a passthrough (defaulting to
   * EMPTY_LISTING_FIELD_PROVENANCE when omitted), the same "no new
   * calculation logic" treatment PropertyInput.propertyType already gets.
   */
  listingFieldProvenance?: ListingFieldProvenanceReport;
  /**
   * Optional: set by buildEngineInput() from the wizard's "staat van
   * onderhoud" answer and its optional renovation-tier override (fase C
   * stap 1). runEngine() derives nothing here - selections.renovationStrategy
   * already carries the resolved tier, and this only records how that tier
   * was arrived at, the same passthrough treatment listingFieldProvenance
   * gets. Omitted by every caller that supplies renovationStrategy
   * directly with no maintenanceCondition behind it (tests, the free tier),
   * where there is no derivation to report on.
   */
  renovationTierProvenance?: RenovationTierProvenance;
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
  /**
   * PropertyInput.upcomingDerramasEstimate / PROJECTION_YEARS.value -
   * datakwaliteitsfix stap 4. Always present (0 when no estimate was
   * given), so callers can sum it unconditionally the same way they
   * already sum communityFees.
   */
  derramas: number;
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
  /** InvestorConstraints.minMonthlyCashflow, carried alongside the boolean it produced - UI_SPEC.md §6.7 shows the investor's own threshold next to the figure it is tested against, the same pairing EquityFitCheck and ReturnRequirementCheck already give the other two thresholds. */
  minMonthlyCashflow: number;
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
  /**
   * Whether the deductible costs above actually reduced the taxable base.
   * False for a non-EU investor, who is taxed on gross rent - in that
   * case deductibleCostsBase is still reported (the costs are real and
   * the report shows them) but taxableIncomeBase equals the gross rent.
   */
  deductionsAllowed: boolean;
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
  /**
   * The derrama amortization for this calendar year - datakwaliteitsfix
   * stap 4. Not CPI-indexed, unlike the lines above: it is a fixed total
   * the customer already estimated in today's euros, already spread evenly
   * over the projection; indexing it too would inflate it a second time.
   */
  derramas: number;
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
  /** True beyond the sourced Correction Factors series (indexation.ts's isExtrapolated) - UI_SPEC.md §6.5 marks these years as such rather than presenting them as equally sourced. */
  extrapolated: boolean;
  /** This year's gross rental income - year 1 is prorated for the renovation's lease-up vacancy (projection.ts), every later year is not. */
  grossIncome: number;
  /** This year's net operating income: grossIncome minus property management, maintenance, utilities and fixed costs - before debt service and tax. */
  noi: number;
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
  /**
   * Every named parameter (SOURCED, ESTIMATE and PLACEHOLDER alike) this
   * outcome's calculation chain actually draws on - UI_SPEC.md §6.8's
   * "Aannames en bronnen", the full-provenance counterpart to
   * placeholdersUsed above. Built by assumptions.ts's
   * collectUsedParameters() independently of collectPlaceholders() (see
   * that module's own docstring for why); always a superset of
   * placeholdersUsed, since every PLACEHOLDER used is also a parameter
   * used.
   */
  assumptionsUsed: Parameter<unknown>[];
  /**
   * This scenario's TSG score - the five dimensions and their weighted
   * total (SCORE_SPEC.md §1-§3) - carried per scenario, alongside
   * placeholdersUsed, so the report can show a score for each of
   * conservative/base/optimistic rather than only for one.
   *
   * `null` when the score cannot be computed, which happens for exactly
   * one reason: SCORE_SPEC.md §2.3's return dimension needs a defined
   * IRR, and `irr.defined === false` means no rate exists that zeroes this
   * series' NPV. That is not a bad return - it is the absence of an
   * answer - so no score is reported rather than a fabricated one. The
   * reason is not duplicated here; `irr.reason` on this same outcome
   * already carries it.
   */
  score: TsgScore | null;
  /**
   * Where this outcome's total score falls in the synthetic reference
   * distribution, 0-99 (SCORE_SPEC.md §5): the share of the 1.000
   * reference cases scoring strictly lower. `null` exactly when `score`
   * is null - there is nothing to place without a total.
   */
  percentile: number | null;
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

/**
 * The synthetic reference distribution a TSG total score is measured
 * against (SCORE_SPEC.md §5): 1.000 total scores from independently
 * generated synthetic cases, ascending. `generatedAt` records when the set
 * was produced, per §5's "leg het tijdstip van generatie vast in de
 * verdeling zelf" - the field that answers "is this distribution stale?"
 * when the scoring curves or parameters.ts have since changed.
 */
export interface ScoreDistribution {
  /** Ascending, length === size. */
  scores: readonly number[];
  size: number;
  generatedAt: string;
  seed: number;
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
  /**
   * One ScenarioOutcome per scenario (conservative/base/optimistic, in
   * that order - SCENARIO_ORDER), each carrying its own TSG score and
   * percentile (SCORE_SPEC.md §1-§6). `null` when EngineInput.exitPlanning
   * was not supplied - MODEL_SPEC_FASE1B §5's exit assumptions have no
   * default, so without them there is nothing to build an exit, an IRR, or
   * a score from, and none of those may be guessed.
   */
  scenarioOutcomes: ScenarioOutcome[] | null;
  /**
   * Provenance of the rent rate(s) actually used (interview round 2/3
   * follow-up). Unconditional, unlike scenarioOutcomes - it needs only
   * PropertyInput.neighborhood and the selected rentPerM2 rates, both
   * always present, so this is computed for every runEngine() call
   * including the reference case (which carries no neighborhood and so
   * reports "noReference" on both rates).
   */
  rentInputProvenance: RentInputProvenanceReport;
  /**
   * Provenance of the four listing-prefilled fields (SOURCING_SPEC.md
   * §4/§7 step 4). Unconditional like rentInputProvenance, not optional -
   * EMPTY_LISTING_FIELD_PROVENANCE (all four null) for every call whose
   * EngineInput.listingFieldProvenance was omitted, which today is every
   * call outside this feature's own golden tests.
   */
  listingFieldProvenance: ListingFieldProvenanceReport;
  /**
   * How selections.renovationStrategy was arrived at (fase C stap 1), or
   * null when EngineInput.renovationTierProvenance was omitted - i.e. when
   * the caller supplied a tier directly with no "staat van onderhoud"
   * behind it, so there is no derivation to report on. Null rather than a
   * shared empty constant (the treatment listingFieldProvenance gets),
   * because "no derivation happened" is a single fact here, not four
   * independently-absent fields.
   */
  renovationTierProvenance: RenovationTierProvenance | null;
}

// ---------------------------------------------------------------------------
// Free indication band (UI_SPEC.md §2/§3, CLAUDE.md §4/§6)
// ---------------------------------------------------------------------------

/**
 * The three first-order fields of UI_SPEC.md §3 that actually feed a
 * calculation.
 *
 * `pandtype` and `aantal eenheden` used to be collected by the free form
 * too, but nothing in the calculation layer ever consumed either one
 * (CLAUDE.md §6: accepting them here and quietly ignoring them would have
 * suggested they moved the number). Datakwaliteitsfix stap 6 removed both
 * fields from the form itself rather than continue asking for values the
 * report could never use - so this type never carried them, and the
 * "unmodeledFields" disclosure key that used to name this limitation is
 * gone too, since there is nothing left unmodeled to disclose.
 *
 * Fase A stap 1 added three more, optional fields below - each replaces
 * exactly one of the three band-width drivers band.ts's own module
 * docstring names (FREE_TIER_BAND_COMMUNITY_FEES_{UN,}FAVOURABLE,
 * FREE_TIER_BAND_RENOVATION_TIER_{UN,}FAVOURABLE, FREE_TIER_BAND_RENT_MARGIN)
 * with the customer's own figure at both ends of the band, narrowing it.
 * Left blank, each keeps today's behaviour exactly: the same
 * favourable/unfavourable standing-in pair as before this fix.
 */
export interface FreeTierBandInput {
  /** Key into NEIGHBORHOOD_RENT_LONG_TERM - one of the 13 wijken the free form offers as a dropdown. */
  neighborhood: string;
  /** Vraagprijs, €. */
  purchasePrice: number;
  /** Woonoppervlak (superficie construida), m². The free form asks for built area only. */
  builtAreaM2: number;
  /**
   * Gastos de comunidad, €/year. Optional: when given, replaces
   * FREE_TIER_BAND_COMMUNITY_FEES_{UN,}FAVOURABLE with this one figure at
   * both ends of the band.
   */
  communityFeesAnnual?: number;
  /**
   * "Staat van onderhoud" - the same three-way self-assessment the paid
   * wizard asks (MaintenanceCondition), resolved through the same
   * RENOVATION_TIER_BY_MAINTENANCE_CONDITION mapping deriveRenovationStrategy()
   * already uses. Optional: when given, replaces
   * FREE_TIER_BAND_RENOVATION_TIER_{UN,}FAVOURABLE with this one tier at
   * both ends of the band.
   */
  maintenanceCondition?: MaintenanceCondition;
  /**
   * How this property's rent compares to NEIGHBORHOOD_RENT_LONG_TERM's
   * wijk average. Optional: when given, replaces FREE_TIER_BAND_RENT_MARGIN's
   * ± split with a single direction at both ends - "below"/"above" collapse
   * to the same -8%/+8% figure at both ends, "average" drops the margin to
   * exactly 0 (FREE_TIER_BAND_RENT_MARGIN then plays no role for this band
   * and is excluded from placeholdersUsed).
   */
  rentLevel?: FreeTierRentLevel;
}

export type FreeTierRentLevel = "below" | "average" | "above";

/** One end of the band: a complete run of the simplified calculation at one corner of the unknowns. */
export interface FreeTierBandEnd {
  end: "unfavourable" | "favourable";
  /** Neighbourhood reference rent after FREE_TIER_BAND_RENT_MARGIN, €/m²/month. */
  rentPerM2: number;
  /** Derived from builtAreaM2 - the free tier never has a measured usable area. */
  usableAreaM2: number;
  grossAnnualRent: number;
  propertyManagement: number;
  maintenance: number;
  utilities: number;
  propertyTaxIBI: number;
  insurance: number;
  bankAccountFee: number;
  communityFees: number;
  /** IBI + insurance + bank fee + community fees. Excludes debt service, same split scenarios.ts (the paid engine) already keeps - see annualDebtService below for that line. */
  fixedCosts: number;
  /** purchasePrice x FREE_TIER_FINANCING_TIER.ltv.value (fase A stap 3) - identical at both ends, the mortgage size does not vary with the band's other dimensions. */
  mortgageAmount: number;
  /** Amortising annual payment on mortgageAmount, via annualAnnuityDebtService() at the fixed financing assumption (fase A stap 3) - identical at both ends, same reason as mortgageAmount. */
  annualDebtService: number;
  /** Was annualCashflowBeforeFinancing until fase A stap 3 added financing - the qualifier is gone rather than kept and misleading now that it is included. */
  annualCashflow: number;
  /** Was monthlyCashflowBeforeFinancing - see annualCashflow's own note. */
  monthlyCashflow: number;
  /** The renovation tier standing in for an unknown state of repair at this end. */
  renovationStrategy: RenovationStrategyId;
  /** The PLACEHOLDER parameters this end's number actually rests on (CLAUDE.md §6). */
  placeholdersUsed: Parameter<unknown>[];
}

/**
 * The disclosures that must travel with the band, as keys rather than
 * text: CLAUDE.md §6 keeps the calculation layer in English, so the Dutch
 * copy a page renders lives outside lib/rules/es entirely, in a copy
 * module that maps every key below to text (with a compiler-enforced
 * guarantee that none is missing - see lib/copy/es/free-tier-disclosures.ts).
 * The coupling between a key and its text is exactly as hard as when the
 * text lived here: a key with no translation fails to compile, not just
 * fails to render.
 *
 * - `band`: what the band is - an envelope over unknown inputs, not a
 *   probability interval.
 * - `shortTermLicence`: why short-term rental is absent from the figure
 *   (UI_SPEC.md §4).
 * - `financing`: why financing is absent from the figure.
 * - `unverified`: which assumptions were held fixed because no documented
 *   range exists (UI_SPEC.md §6.9).
 * - `narrowedByCustomerInput`: fase A stap 1. Present only when the
 *   customer supplied one or two (not three - see pointEstimateFromCustomerInput
 *   below) of the three optional FreeTierBandInput fields
 *   (communityFeesAnnual, maintenanceCondition, rentLevel) -
 *   computeFreeTierBand() decides per call whether this key is included,
 *   one of two FreeTierDisclosureKey that are not unconditional.
 *   Deliberately generic text, naming that the band was narrowed without
 *   naming which field did it: a dynamic, per-field sentence would need
 *   the calculation layer to hand structured data to the copy layer, a
 *   bigger break from "keys only, no dynamic content" than this fix
 *   calls for.
 * - `pointEstimateFromCustomerInput`: fase A stap 2. Replaces both `band`
 *   and `narrowedByCustomerInput` when all three optional fields are
 *   given (FreeTierBand.pointEstimate true) - the figure is a single
 *   point built entirely from the customer's own answers at that point,
 *   not a range with two describable ends, so neither of those two keys'
 *   text still applies.
 * - `indicativeScoreScope`: the indicative score rests on two of the five
 *   dimensions the paid report scores (SCORE_SPEC.md §8.3). Emitted by
 *   indicative-score.ts, not by the band - the keys above apply to the
 *   band whether or not a score is shown alongside it.
 *
 * A key that used to sit here, `unmodeledFields`, is gone rather than
 * renamed or reworded: pandtype and aantal eenheden were asked on the
 * free form (UI_SPEC.md §3) but entered no calculation, so this key
 * disclosed that gap; datakwaliteitsfix stap 6 removed both fields from
 * the form instead, so there was nothing left unmodeled to disclose.
 */
export type FreeTierDisclosureKey =
  | "band"
  | "shortTermLicence"
  | "financing"
  | "unverified"
  | "narrowedByCustomerInput"
  | "pointEstimateFromCustomerInput"
  | "indicativeScoreScope";

/**
 * Every FreeTierDisclosureKey, as a runtime list. The Record below exists
 * only to make that list provably exhaustive: a key added to the union
 * without a matching entry here fails to compile, so this can be trusted
 * as the complete set rather than a hand-maintained copy that silently
 * falls behind.
 *
 * Not the same thing as the keys any one result emits - the band emits
 * four unconditionally (FREE_TIER_DISCLOSURE_KEYS in free-tier/band.ts)
 * plus `narrowedByCustomerInput` or `pointEstimateFromCustomerInput` when
 * one applies (never both), and the indicative score emits the seventh
 * (`indicativeScoreScope`). This is the union of everything the copy
 * layer must be able to translate.
 */
const FREE_TIER_DISCLOSURE_KEY_SET: Readonly<Record<FreeTierDisclosureKey, true>> = {
  band: true,
  shortTermLicence: true,
  financing: true,
  unverified: true,
  narrowedByCustomerInput: true,
  pointEstimateFromCustomerInput: true,
  indicativeScoreScope: true,
};

export const ALL_FREE_TIER_DISCLOSURE_KEYS: readonly FreeTierDisclosureKey[] = Object.keys(
  FREE_TIER_DISCLOSURE_KEY_SET,
) as FreeTierDisclosureKey[];

/**
 * The free indication's result: one simplified calculation run at both
 * corners of what the first-order form does not ask.
 */
export interface FreeTierBand {
  neighborhood: string;
  /** NEIGHBORHOOD_RENT_LONG_TERM's value for this wijk, before the margin. */
  referenceRentPerM2: number;
  unfavourable: FreeTierBandEnd;
  favourable: FreeTierBandEnd;
  /**
   * The two ends as one figure, for display: € low - € high per month.
   * Numerically equal (low === high) exactly when `pointEstimate` is
   * true - both ends were built from the same three customer figures at
   * that point, not two different standing-in pairs. Was
   * monthlyCashflowBeforeFinancing until fase A stap 3 added financing to
   * both ends (FreeTierBandEnd's own annualCashflow/monthlyCashflow) -
   * the qualifier is gone rather than kept and misleading now that this
   * is the figure a customer could actually bank.
   */
  monthlyCashflow: { low: number; high: number };
  /**
   * True when the customer supplied all three of FreeTierBandInput's
   * optional narrowing fields (fase A stap 2) - the band has collapsed to
   * a point rather than merely narrowed. A page is expected to render a
   * single figure, not a range, when this is true; see
   * computeFreeTierBand()'s own comment for how `disclosures` stays in
   * lockstep with this flag.
   */
  pointEstimate: boolean;
  /** Union of both ends' placeholdersUsed, de-duplicated by name. */
  placeholdersUsed: Parameter<unknown>[];
  /**
   * The disclosures that apply to the band itself. The four in
   * FREE_TIER_DISCLOSURE_KEYS apply unconditionally, except that "band" is
   * swapped out for "pointEstimateFromCustomerInput" when `pointEstimate`
   * is true - there are no favourable/unfavourable ends left for "band"'s
   * own text to describe at that point. "narrowedByCustomerInput" is
   * added whenever 1 or 2 (not 3) of the three optional fields are given.
   */
  disclosures: readonly FreeTierDisclosureKey[];
}

/**
 * The indicative score's three grades (SCORE_SPEC.md §8.2). Deliberately
 * not a 0-10 number: a coarse label cannot be laid next to a paid TSG
 * score and read as the same measurement.
 *
 * English in the calculation layer; the Dutch Laag/Gemiddeld/Hoog a page
 * shows lives in lib/copy/es/free-tier-disclosures.ts, the same split the
 * disclosure keys use.
 */
export type IndicativeLabel = "low" | "medium" | "high";

/**
 * The free indication's score (SCORE_SPEC.md §8): two dimensions, not the
 * five of §2, because without investor input there is no DSCR, no IRR and
 * no equity test to score.
 *
 * The 0-10 scores behind the two labels are deliberately absent from this
 * type. SCORE_SPEC.md §8.2 is explicit that they are "nergens getoond -
 * alleen gebruikt om het label te bepalen"; leaving them off the result
 * makes that structural rather than a rule a page has to remember.
 */
export interface IndicativeScore {
  /** Graded from the midpoint of the band's monthly cashflow (SCORE_SPEC.md §8.1/§8.2). */
  cashflowLabel: IndicativeLabel;
  /** Graded from the number of PLACEHOLDER parameters the band rests on. */
  dataConfidenceLabel: IndicativeLabel;
  /**
   * SCORE_SPEC.md §8.3's mandatory scope disclosure. Additive to the
   * band's own five keys, not a replacement: a page showing both renders
   * FreeTierBand.disclosures and this list together.
   */
  disclosures: readonly FreeTierDisclosureKey[];
}

// ---------------------------------------------------------------------------
// Paid-form selection derivation (UI_SPEC.md §3, interview round 1)
// ---------------------------------------------------------------------------

/**
 * Values for the "staat van onderhoud" field the paid form asks for
 * (UI_SPEC.md §3), used to derive ModelSelections.renovationStrategy
 * (RENOVATION_TIER_BY_MAINTENANCE_CONDITION in parameters.ts) so the
 * customer is not asked to pick a renovation tier directly.
 *
 * Deliberately independent of constructionYear and energyLabel, which the
 * form asks for separately: a 1970 building can be fully renovated and a
 * 2015 one neglected, so this is the customer's own condition assessment,
 * not derived from the other two fields.
 */
export type MaintenanceCondition = "good" | "average" | "poor";

// ---------------------------------------------------------------------------
// Rent input provenance (UI_SPEC.md §3, interview round 2/3)
// ---------------------------------------------------------------------------

/**
 * Where a rate the engine actually used for income came from.
 *
 * Three of these are *derived*: matchesReference, customerOverride and
 * noReference all follow from comparing the supplied rate against the
 * neighbourhood table, so no signal from the form is needed to tell them
 * apart. "actualCurrentRent" is different in kind - it cannot be inferred
 * from the number alone, since an observed rent may coincidentally equal
 * the wijk average or sit far from it. It has to be declared, which is
 * what ModelSelections.rentPerM2FromActualCurrentRent does.
 */
export type RentReferenceStatus =
  | "matchesReference"
  | "customerOverride"
  | "noReference"
  | "actualCurrentRent";

/**
 * Provenance of one rate (long-term or short-term rent per m²) actually
 * used by the selected rentalStrategy. Computed by comparing what was
 * supplied (ModelSelections.rentPerM2LongTerm/ShortTerm) against
 * NEIGHBORHOOD_RENT_LONG_TERM/SHORT_TERM[neighborhood] - no separate "did
 * the customer touch this field" signal from the form is needed for that
 * comparison, because the comparison itself carries the same information.
 * The one exception is "actualCurrentRent", which is declared rather than
 * derived - see RentReferenceStatus.
 */
export interface RentInputProvenance {
  status: RentReferenceStatus;
  /** NEIGHBORHOOD_RENT_LONG_TERM/SHORT_TERM's value for this neighbourhood. Null under "noReference". */
  referenceRentPerM2: number | null;
  /** The rate actually fed into the calculation. */
  suppliedRentPerM2: number;
  /**
   * (supplied - reference) / reference. Null under "noReference", and
   * null under "actualCurrentRent" - a rent this property is actually
   * being let at is an observed fact about this building, not an estimate
   * measured against a wijk average, so there is nothing for it to
   * deviate from. referenceRentPerM2 is still reported there when the
   * wijk is known, because §6.8 legitimately wants to show what reference
   * existed; it is context, not a yardstick.
   */
  deviationFraction: number | null;
  /** |deviationFraction| >= RENT_OVERRIDE_SIGNIFICANT_DEVIATION_THRESHOLD.value. Only ever true under "customerOverride". */
  significantDeviation: boolean;
}

/**
 * Provenance for the rate(s) the selected rentalStrategy actually uses.
 * "longTerm" carries a value only for the longTerm/hybrid strategies,
 * "shortTerm" only for shortTerm/hybrid - the unused rate stays null
 * rather than reporting on a figure that never entered the outcome
 * (income.ts always computes both IncomeLines, but only the selected
 * strategy's figure feeds scenarios.ts onward).
 */
export interface RentInputProvenanceReport {
  longTerm: RentInputProvenance | null;
  shortTerm: RentInputProvenance | null;
}

/**
 * The disclosure keys a rate's provenance can trigger in the paid report
 * (interview round 2/3 follow-up). Unlike FreeTierDisclosureKey these are
 * not unconditional: matchesReference and noReference emit none, because
 * §6.1 carries nothing about rent provenance when the model's own
 * reference is what drove the outcome.
 *
 * "rentOverrideSignificant" belongs in §6.1 ("Uitkomst in één regel")
 * itself, not only in the §6.8 assumptions appendix - a materially
 * different input deserves visibility where the headline figures are, not
 * only in the fine print. "rentOverrideMinor" is a lighter mention.
 *
 * "rentFromActualCurrentRent" is the odd one out and deliberately so: it
 * is reassuring rather than cautioning. The other two flag that a figure
 * came from the customer's judgement instead of market data; this one
 * reports that the figure came from something better than either - what
 * this specific building is actually being let at today. It carries no
 * deviation and no threshold, since an observed fact has nothing to
 * deviate from.
 *
 * None of these keys carries Dutch text here (CLAUDE.md §6) - see
 * lib/copy/es/rent-provenance-disclosures.ts, which also does the number
 * interpolation this text needs (the supplied rate, the deviation
 * percentage, the reference), since that data is not static per key the
 * way the free-tier disclosures are.
 */
export type RentProvenanceDisclosureKey =
  | "rentOverrideSignificant"
  | "rentOverrideMinor"
  | "rentFromActualCurrentRent";

// ---------------------------------------------------------------------------
// Listing field provenance (SOURCING_SPEC.md §4/§7 step 4, pijler 2)
// ---------------------------------------------------------------------------

/**
 * Whether a wizard field that was prefilled from a chosen listing
 * (SOURCING_SPEC.md §4) still holds exactly that value, or has since been
 * edited by the customer.
 *
 * Derived by comparison, the same way RentReferenceStatus's
 * matchesReference/customerOverride are - no separate "did the customer
 * touch this field" signal from the form is needed, because comparing the
 * current value against the value it was prefilled with carries the same
 * information. The one accepted edge case this shares with
 * matchesReference: a customer who retypes the exact original value reads
 * as "fromListing", not as a deliberate confirmation - the same tradeoff
 * already accepted there, for the same reason (no separate signal exists
 * to tell the two apart).
 */
export type ListingFieldProvenanceStatus = "fromListing" | "confirmed";

/**
 * Whether a wizard field the model can derive was left to that derivation
 * or set by the customer instead (fase C).
 *
 * Deliberately *not* derived by comparison, unlike
 * ListingFieldProvenanceStatus and RentReferenceStatus above. Those two
 * infer "the customer touched this" from the value differing from what it
 * was prefilled with, and both carry the same accepted edge case: someone
 * who re-enters the original value reads as untouched. The fields this
 * status covers offer an explicit "derive it for me" option in the form
 * itself, so the signal is real rather than inferred - and a customer who
 * deliberately picks the value the derivation would also have picked
 * correctly reads as "customerChosen", which the comparison approach
 * could never express.
 */
export type DerivedFieldStatus = "derived" | "customerChosen";

/**
 * Provenance of the renovation tier the engine actually used (fase C stap
 * 1). Until this existed the tier was always
 * deriveRenovationStrategy(maintenanceCondition), via
 * RENOVATION_TIER_BY_MAINTENANCE_CONDITION (PLACEHOLDER), with no way for
 * a customer who knows what the property needs to say so.
 *
 * derivedValue is carried under both statuses, not only under "derived" -
 * that is what lets the report say "u koos grondig; afgeleid uit de staat
 * van onderhoud was licht" rather than silently showing one of the two.
 */
export interface RenovationTierProvenance {
  status: DerivedFieldStatus;
  /** What deriveRenovationStrategy() says for the supplied maintenanceCondition, whether or not it was used. */
  derivedValue: RenovationStrategyId;
}

/**
 * Provenance of one field prefilled from a listing. Generic over the
 * field's own value type (string for neighborhood, number for the three
 * numeric fields) rather than a single `string | number` union, so a
 * caller never has to narrow it - the same generic-over-T shape
 * Parameter<T> already uses in this file.
 */
export interface ListingFieldProvenance<T> {
  status: ListingFieldProvenanceStatus;
  /** The listing's own original value - what the field was prefilled with, for the disclosure sentence. */
  originalValue: T;
}

/**
 * Provenance for the four wizard fields SOURCING_SPEC.md §4 prefills from
 * a chosen listing: neighborhood, purchasePrice, builtAreaM2 and
 * usableAreaM2 (the last only when the listing itself supplied one).
 * propertyType is deliberately absent - SOURCING_SPEC.md §4's own
 * standard is "een waarde die de uitkomst draagt", and propertyType is
 * recorded but consumed by no calculation (PropertyInput.propertyType's
 * own docstring), so it is prefilled without being tracked.
 *
 * All four null for every wizard entry that did not go through a chosen
 * listing - which, until SOURCING_SPEC.md §7 step 4's own wizard-prefill
 * ships, is every entry. EMPTY_LISTING_FIELD_PROVENANCE is exactly this
 * shape, reused wherever "no listing was involved" needs a value rather
 * than an absence.
 */
export interface ListingFieldProvenanceReport {
  neighborhood: ListingFieldProvenance<string> | null;
  purchasePrice: ListingFieldProvenance<number> | null;
  builtAreaM2: ListingFieldProvenance<number> | null;
  usableAreaM2: ListingFieldProvenance<number> | null;
}

/** The report for "no listing was involved" - every field null. Shared so callers compare against one instance's shape rather than re-typing four nulls. */
export const EMPTY_LISTING_FIELD_PROVENANCE: ListingFieldProvenanceReport = {
  neighborhood: null,
  purchasePrice: null,
  builtAreaM2: null,
  usableAreaM2: null,
};
