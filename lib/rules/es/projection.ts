/**
 * Multi-year cashflow after tax (MODEL_SPEC_FASE1B §4).
 *
 * The IRR needs the investor's actual net cashflow, so the tax layer runs
 * every year instead of once. The one thing that must not be simplified
 * away: the deductible mortgage interest is the interest *portion* of that
 * year's annuity payment, which shrinks every year as the loan amortizes -
 * not the flat "interest-only" figure phase 1 used for its single-year tax
 * estimate. That is why this module builds its own amortization schedule
 * per scenario instead of reusing the annual debt service total.
 *
 * Depreciation also gets its own building-share input here rather than
 * reusing phase 1's fixed 80% (tax.ts, Excel parity): the real building
 * share of a purchase price is property-specific (cadastral suelo /
 * construcción split), not a universal constant, so this module takes it
 * as an explicit, overridable parameter (DEFAULT_BUILDING_SHARE_OF_VALUE).
 *
 * Year 1 also carries the renovation's vacancy, which since fase C stap 2
 * is the sum of two distinct periods, both on RenovationStrategyResult:
 * `durationMonths` (the work itself) and `timeToRentMonths` (finding a
 * tenant afterwards). Neither sits in the Excel's year-1 figures, so
 * phase-1 parity is unaffected - but a multi-year projection cannot show a
 * full 12 months of rent in the year the property is a building site and
 * then empty. Before fase C stap 2 only the lease-up counted, which
 * modelled the renovation as instantaneous and overstated year 1 for every
 * property.
 *
 * Only year 1's rent (and the property management fee, which is a
 * percentage of that rent) is prorated; every cost that runs regardless of
 * occupancy - maintenance, utilities, IBI, insurance, the bank fee, and
 * the full annuity - is unaffected. From year 2 both periods are over and
 * the full year counts.
 *
 * The months rented are clamped at zero. A renovation long enough to fill
 * the year leaves year 1 with no rent at all, which is modelled correctly;
 * what is *not* modelled is the remainder spilling into year 2, since only
 * year 1 is prorated. The wizard caps the duration it will accept and the
 * report discloses the spill rather than letting it pass silently
 * (renovation-duration-provenance-disclosures.ts).
 */

import { amortizationSchedule } from "./financing";
import { buildIndexSeries } from "./indexation";
import { rentalIncomeTaxTreatment } from "./tax";
import {
  DEFAULT_BUILDING_SHARE_OF_VALUE,
  DEPRECIATION_RATE,
  DEPRECIATION_SCENARIO_FACTORS,
  PROPERTY_MANAGEMENT_FEE,
} from "./parameters";
import type {
  CadastralValue,
  FixedOperatingCosts,
  ProjectionYear,
  RenovationStrategyResult,
  ScenarioId,
  ScenarioResult,
  SelectedFinancing,
  TaxResidency,
} from "./types";

const MONTHS_PER_YEAR = 12;

export function buildProjectionYears(args: {
  years: number;
  startYear?: number;
  scenario: ScenarioId;
  /** Phase-1 (year-1) scenario outcome; its gross income and cost lines are the base every year indexes from. */
  scenarioResult: ScenarioResult;
  purchasePrice: number;
  financing: SelectedFinancing;
  /** Phase-1 fixed cost breakdown (IBI/insurance/bank fee/gastos de comunidad), the year-1 base each is indexed from. */
  fixedCosts: Pick<
    FixedOperatingCosts,
    "propertyTaxIBI" | "insurance" | "bankAccountFee" | "communityFees" | "derramas"
  >;
  /** Legacy; taxResidency takes precedence when both are given. */
  euResident?: boolean;
  /** Where the investor is tax-resident - decides the rate AND whether costs are deductible. */
  taxResidency?: TaxResidency;
  /** The selected renovation strategy; durationMonths + timeToRentMonths prorate year 1's rent (fase C stap 2). */
  renovation: Pick<RenovationStrategyResult, "timeToRentMonths" | "durationMonths">;
  /**
   * Building share of the purchase value used for depreciation (3% per
   * year applies to this share, not the full price). Defaults to
   * DEFAULT_BUILDING_SHARE_OF_VALUE - a generic placeholder, not sourced
   * per property; see the TODO on that constant. Ignored when
   * cadastralValue is given (MODEL_SPEC.md §16).
   */
  buildingShareOfValue?: number;
  /**
   * PropertyInput.cadastralValue - when given, the depreciation base is
   * cadastralValue.construccion directly, not
   * purchasePrice x buildingShareOfValue (MODEL_SPEC.md §16). Takes
   * priority over buildingShareOfValue.
   */
  cadastralValue?: CadastralValue;
}): ProjectionYear[] {
  const indexSeries = buildIndexSeries({
    years: args.years,
    startYear: args.startYear,
    scenario: args.scenario,
  });

  // The scenario's stress-tested rate is fixed for the loan's life, same as
  // phase 1; only the interest/principal split changes year over year.
  const amortization = amortizationSchedule({
    annualRate: args.scenarioResult.interestRate,
    termYears: args.financing.loanTermYears,
    principal: args.financing.mortgageAmount,
    yearsToProject: args.years,
  });

  const depreciationBaseValue = args.cadastralValue
    ? args.cadastralValue.construccion
    : args.purchasePrice * (args.buildingShareOfValue ?? DEFAULT_BUILDING_SHARE_OF_VALUE.value);
  const depreciationYear1 =
    depreciationBaseValue *
    DEPRECIATION_RATE.value *
    DEPRECIATION_SCENARIO_FACTORS[args.scenario].value;
  // Rate and base together, from the one helper tax.ts owns, so the
  // ten-year series and the year-1 figure cannot disagree about how this
  // investor is taxed.
  const { rate: taxRate, deductionsAllowed } = rentalIncomeTaxTreatment(args);

  // Year 1 only: the property isn't let while it's being renovated, nor
  // while a tenant is being found afterwards, so its rent (and the
  // property management fee, a % of that rent) is prorated to the months
  // actually rented. Every other cost line and the full annuity run for
  // the complete year regardless.
  //
  // Clamped at zero: a renovation that fills the year leaves no rent at
  // all, and without the clamp the arithmetic would run negative and
  // credit the projection with rent it never earned.
  const vacantMonthsYear1 = args.renovation.durationMonths + args.renovation.timeToRentMonths;
  const monthsRentedYear1 = Math.max(0, MONTHS_PER_YEAR - vacantMonthsYear1);
  const year1RentProration = monthsRentedYear1 / MONTHS_PER_YEAR;

  return indexSeries.map((idx, i): ProjectionYear => {
    const amort = amortization[i]!;

    const rentProration = idx.yearNumber === 1 ? year1RentProration : 1;
    const grossIncome = args.scenarioResult.grossIncome * idx.rentIndex * rentProration;
    // Property management is always a fixed % of that year's rent, so it
    // tracks the rent index directly rather than CPI.
    const propertyManagement = grossIncome * PROPERTY_MANAGEMENT_FEE.value;
    const maintenance = args.scenarioResult.maintenance * idx.costIndex;
    const utilities = args.scenarioResult.utilities * idx.costIndex;
    // IBI is levied on the cadastral value, which is set administratively
    // and does not track market price; absent a cadastral-value series it
    // is CPI-indexed like the other fixed cost lines (MODEL_SPEC.md §6/§10).
    const propertyTaxIBI = args.fixedCosts.propertyTaxIBI * idx.costIndex;
    const insurance = args.fixedCosts.insurance * idx.costIndex;
    const bankAccountFee = args.fixedCosts.bankAccountFee * idx.costIndex;
    const communityFees = args.fixedCosts.communityFees * idx.costIndex;
    // Datakwaliteitsfix stap 4: not CPI-indexed, unlike the lines above -
    // this is a fixed total already amortized evenly (operating.ts), not an
    // ongoing cost expected to grow with inflation.
    const derramas = args.fixedCosts.derramas;
    const fixedCosts = propertyTaxIBI + insurance + bankAccountFee + communityFees + derramas;

    const noi = grossIncome - (propertyManagement + maintenance + utilities + fixedCosts);

    const interestPaid = amort.interestPaid;
    const principalPaid = amort.principalPaid;
    const debtService = interestPaid + principalPaid;

    const preTaxCashflow =
      grossIncome - (propertyManagement + maintenance + utilities + fixedCosts + debtService);

    // Depreciation is tied to the original acquisition cost, not indexed.
    const depreciation = depreciationYear1;
    const deductibleCosts =
      interestPaid +
      propertyTaxIBI +
      insurance +
      maintenance +
      propertyManagement +
      depreciation +
      bankAccountFee +
      communityFees +
      derramas;
    // Gross for a non-EU investor: the costs are still computed and still
    // reported per year, they just do not reduce the taxable base.
    const taxableIncome = deductionsAllowed ? grossIncome - deductibleCosts : grossIncome;
    // Spanish non-resident rental tax (IRNR) is filed and withheld per
    // period; a negative result means no tax is due that year, not a
    // refund, so it is clamped at zero rather than reported as negative.
    const taxDue = Math.max(0, taxableIncome) * taxRate;
    const cashflowAfterTax = preTaxCashflow - taxDue;

    return {
      yearNumber: idx.yearNumber,
      calendarYear: idx.calendarYear,
      extrapolated: idx.extrapolated,
      grossIncome,
      propertyManagement,
      maintenance,
      utilities,
      propertyTaxIBI,
      insurance,
      bankAccountFee,
      communityFees,
      derramas,
      fixedCosts,
      noi,
      interestPaid,
      principalPaid,
      debtService,
      mortgageBalance: amort.closingBalance,
      preTaxCashflow,
      depreciation,
      deductibleCosts,
      taxableIncome,
      taxDue,
      cashflowAfterTax,
    };
  });
}
