/**
 * Input validation. The product is fully self-serve: every input must be
 * validated and impossible combinations must be rejected before any
 * calculation runs (TSG Yield Engine project spec, section 1).
 *
 * The field-level rules that a multi-step form also needs (area, price)
 * live in field-validation.ts as keys, and this module calls them rather
 * than restating them - so the wizard's step 1 and validateEngineInput()
 * cannot disagree about what a valid built area is. The English strings
 * below are this module's own rendering of those keys; the Dutch the UI
 * shows comes from lib/copy/es/validation.ts, off the same keys.
 */

import {
  checkBuiltAreaM2,
  checkCadastralConstruccion,
  checkCadastralSuelo,
  checkCommunityFeesAnnual,
  checkLtvRange,
  checkMaxLtv,
  checkMaxMonthlyDebt,
  checkMaxRenovationBudget,
  checkMinLtv,
  checkMinMonthlyCashflow,
  checkOccupancyLongTerm,
  checkOccupancyShortTerm,
  checkPreferredLtv,
  checkPurchasePrice,
  checkRentPerM2LongTerm,
  checkRentPerM2ShortTerm,
  checkTotalBudget,
  checkUpcomingDerramasAmount,
  checkUsableAreaM2,
} from "./field-validation";
import type { FieldValidationKey } from "./field-validation";
import type { EngineInput } from "./types";

export class ValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid input: ${issues.join("; ")}`);
    this.name = "ValidationError";
  }
}

/**
 * English rendering of the shared field-validation keys, kept identical to
 * the strings this function returned before the rules moved into
 * field-validation.ts. "required" and "mustBeANumber" are form-only - a
 * typed EngineInput cannot produce them - but are mapped so the record
 * stays exhaustive over the union.
 */
const FIELD_ISSUE_EN: Record<FieldValidationKey, string> = {
  required: "value is required",
  mustBeANumber: "value must be a number",
  builtAreaMustBePositive: "builtAreaM2 must be a positive number",
  usableAreaMustBePositive: "usableAreaM2 must be a positive number",
  usableAreaCannotExceedBuiltArea: "usableAreaM2 cannot exceed builtAreaM2",
  purchasePriceMustBePositive: "purchasePrice must be a positive number",
  communityFeesMustBeZeroOrPositive:
    "communityFeesAnnual must be zero or positive (no default: enter the real gastos de comunidad for this building)",
  cadastralSueloMustBeZeroOrPositive: "cadastralValue.suelo must be zero or positive",
  cadastralConstruccionMustBeZeroOrPositive:
    "cadastralValue.construccion must be zero or positive",
  ownMoneyMustBeZeroOrPositive: "ownMoney must be zero or positive",
  totalBudgetMustBePositive: "totalBudget must be a positive number",
  maxRenovationBudgetMustBeZeroOrPositive: "maxRenovationBudget must be zero or positive",
  minLtvMustBeFraction: "minLtv must be between 0 and 1",
  maxLtvMustBeFraction: "maxLtv must be between 0 and 1",
  preferredLtvMustBeFraction: "preferredLtv must be between 0 and 1",
  minLtvCannotExceedMaxLtv: "minLtv cannot be greater than maxLtv",
  minMonthlyCashflowMustBeANumber: "minMonthlyCashflow must be a number",
  maxMonthlyDebtMustBeZeroOrPositive: "maxMonthlyDebt must be zero or positive",
  holdingYearsMustBePositiveInteger: "holdingYears must be a positive whole number",
  rentPerM2LongTermMustBePositive: "rentPerM2LongTerm must be a positive number",
  rentPerM2ShortTermMustBePositive: "rentPerM2ShortTerm must be a positive number",
  occupancyLongTermMustBeFraction: "occupancyLongTerm must be between 0 and 1",
  occupancyShortTermMustBeFraction: "occupancyShortTerm must be between 0 and 1",
  upcomingDerramasAmountMustBeZeroOrPositive: "upcomingDerramasEstimate must be zero or positive",
  freeTierCommunityFeesMustBeZeroOrPositive:
    "communityFeesAnnual must be zero or positive (free indication)",
};

export function validateEngineInput(input: EngineInput): string[] {
  const issues: string[] = [];
  const { property, constraints, selections } = input;

  const pushField = (key: FieldValidationKey | null): void => {
    if (key !== null) issues.push(FIELD_ISSUE_EN[key]);
  };

  pushField(checkBuiltAreaM2(property.builtAreaM2));
  pushField(checkUsableAreaM2(property.usableAreaM2, property.builtAreaM2));
  pushField(checkPurchasePrice(property.purchasePrice));
  pushField(checkCommunityFeesAnnual(property.communityFeesAnnual));
  if (property.cadastralValue !== undefined) {
    pushField(checkCadastralSuelo(property.cadastralValue.suelo));
    pushField(checkCadastralConstruccion(property.cadastralValue.construccion));
  }
  pushField(checkUpcomingDerramasAmount(property.upcomingDerramasEstimate));
  if (typeof property.hasTouristRentalLicense !== "boolean") {
    issues.push("hasTouristRentalLicense must be true or false (no default)");
  } else if (
    !property.hasTouristRentalLicense &&
    (selections.rentalStrategy === "shortTerm" || selections.rentalStrategy === "hybrid")
  ) {
    issues.push(
      `rentalStrategy "${selections.rentalStrategy}" requires a valid título habilitante; hasTouristRentalLicense is false`,
    );
  }
  pushField(checkTotalBudget(constraints.totalBudget));
  pushField(checkMaxRenovationBudget(constraints.maxRenovationBudget));
  pushField(checkMinLtv(constraints.minLtv));
  pushField(checkMaxLtv(constraints.maxLtv));
  pushField(checkLtvRange(constraints.minLtv, constraints.maxLtv));
  pushField(checkPreferredLtv(constraints.preferredLtv));
  pushField(checkMinMonthlyCashflow(constraints.minMonthlyCashflow));
  pushField(checkMaxMonthlyDebt(constraints.maxMonthlyDebt));
  pushField(checkRentPerM2LongTerm(selections.rentPerM2LongTerm));
  pushField(checkRentPerM2ShortTerm(selections.rentPerM2ShortTerm));
  pushField(checkOccupancyLongTerm(selections.occupancyLongTerm));
  pushField(checkOccupancyShortTerm(selections.occupancyShortTerm));
  return issues;
}

export function assertValidEngineInput(input: EngineInput): void {
  const issues = validateEngineInput(input);
  if (issues.length > 0) throw new ValidationError(issues);
}
