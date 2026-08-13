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
  checkPurchasePrice,
  checkUsableAreaM2,
  isFiniteNumber,
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
  if (!isFiniteNumber(property.communityFeesAnnual) || property.communityFeesAnnual < 0) {
    issues.push("communityFeesAnnual must be zero or positive (no default: enter the real gastos de comunidad for this building)");
  }
  if (property.cadastralValue !== undefined) {
    if (!isFiniteNumber(property.cadastralValue.suelo) || property.cadastralValue.suelo < 0) {
      issues.push("cadastralValue.suelo must be zero or positive");
    }
    if (
      !isFiniteNumber(property.cadastralValue.construccion) ||
      property.cadastralValue.construccion < 0
    ) {
      issues.push("cadastralValue.construccion must be zero or positive");
    }
  }
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
  if (!isFiniteNumber(constraints.totalBudget) || constraints.totalBudget <= 0) {
    issues.push("totalBudget must be a positive number");
  }
  if (!isFiniteNumber(constraints.maxRenovationBudget) || constraints.maxRenovationBudget < 0) {
    issues.push("maxRenovationBudget must be zero or positive");
  }
  if (!isFiniteNumber(constraints.minLtv) || constraints.minLtv < 0 || constraints.minLtv > 1) {
    issues.push("minLtv must be between 0 and 1");
  }
  if (!isFiniteNumber(constraints.maxLtv) || constraints.maxLtv < 0 || constraints.maxLtv > 1) {
    issues.push("maxLtv must be between 0 and 1");
  }
  if (
    isFiniteNumber(constraints.minLtv) &&
    isFiniteNumber(constraints.maxLtv) &&
    constraints.minLtv > constraints.maxLtv
  ) {
    issues.push("minLtv cannot be greater than maxLtv");
  }
  if (
    constraints.preferredLtv !== undefined &&
    (!isFiniteNumber(constraints.preferredLtv) ||
      constraints.preferredLtv < 0 ||
      constraints.preferredLtv > 1)
  ) {
    issues.push("preferredLtv must be between 0 and 1");
  }
  if (!isFiniteNumber(constraints.minMonthlyCashflow)) {
    issues.push("minMonthlyCashflow must be a number");
  }
  if (!isFiniteNumber(constraints.maxMonthlyDebt) || constraints.maxMonthlyDebt < 0) {
    issues.push("maxMonthlyDebt must be zero or positive");
  }
  if (!isFiniteNumber(selections.rentPerM2LongTerm) || selections.rentPerM2LongTerm <= 0) {
    issues.push("rentPerM2LongTerm must be a positive number");
  }
  if (!isFiniteNumber(selections.rentPerM2ShortTerm) || selections.rentPerM2ShortTerm <= 0) {
    issues.push("rentPerM2ShortTerm must be a positive number");
  }
  return issues;
}

export function assertValidEngineInput(input: EngineInput): void {
  const issues = validateEngineInput(input);
  if (issues.length > 0) throw new ValidationError(issues);
}
