/**
 * Per-field validation rules, expressed as keys rather than sentences.
 *
 * Interview round 3 settled how validation messages reach the Dutch UI:
 * one definition of the rules in the calculation layer, keys as the
 * interface, and the Dutch text in lib/copy/es - the same split the
 * free-tier disclosure keys already use, and specifically not a second
 * schema in the form that could drift from the engine's own checks.
 *
 * This module holds the rules a single field can be judged by on its own
 * (or against one sibling field), which is what a multi-step form needs:
 * step 1 must be able to reject a negative purchase price without knowing
 * anything about the investor constraints step 3 will collect.
 * validation.ts calls exactly these functions for the fields they cover,
 * so an engine-level EngineInput check and a form-level field check can
 * never disagree about what "valid" means.
 *
 * Two of the keys below - "required" and "mustBeANumber" - have no
 * engine-level counterpart on purpose. validateEngineInput() receives a
 * typed EngineInput where a number is already a number; a form receives
 * strings, and "" and "abc" are failures the engine never sees. They live
 * in the same union because they describe the same fields, and the copy
 * layer must be able to render every one of them.
 *
 * Deliberately imports nothing from parameters.ts: interview round 1 put
 * the engine server-side so the scoring weights stay out of the browser
 * bundle, and this module is imported by client components.
 */

export type FieldValidationKey =
  | "required"
  | "mustBeANumber"
  | "builtAreaMustBePositive"
  | "usableAreaMustBePositive"
  | "usableAreaCannotExceedBuiltArea"
  | "purchasePriceMustBePositive"
  | "communityFeesMustBeZeroOrPositive"
  | "cadastralSueloMustBeZeroOrPositive"
  | "cadastralConstruccionMustBeZeroOrPositive"
  | "ownMoneyMustBeZeroOrPositive"
  | "totalBudgetMustBePositive"
  | "maxRenovationBudgetMustBeZeroOrPositive"
  | "minLtvMustBeFraction"
  | "maxLtvMustBeFraction"
  | "preferredLtvMustBeFraction"
  | "minLtvCannotExceedMaxLtv"
  | "minMonthlyCashflowMustBeANumber"
  | "maxMonthlyDebtMustBeZeroOrPositive"
  | "holdingYearsMustBePositiveInteger"
  | "rentPerM2LongTermMustBePositive"
  | "rentPerM2ShortTermMustBePositive";

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Superficie construida: must be a positive number. */
export function checkBuiltAreaM2(value: unknown): FieldValidationKey | null {
  return !isFiniteNumber(value) || value <= 0 ? "builtAreaMustBePositive" : null;
}

/**
 * Superficie útil: optional, but when given it must be positive and must
 * not exceed the built area.
 *
 * Mirrors validateEngineInput()'s original ordering exactly, including
 * that the "cannot exceed" comparison is only reached once the usable area
 * itself is valid and the built area is a finite number - otherwise a
 * property with a broken built area would report two problems for what is
 * really one.
 */
export function checkUsableAreaM2(
  usableAreaM2: unknown,
  builtAreaM2: unknown,
): FieldValidationKey | null {
  if (usableAreaM2 === undefined) return null;
  if (!isFiniteNumber(usableAreaM2) || usableAreaM2 <= 0) return "usableAreaMustBePositive";
  if (isFiniteNumber(builtAreaM2) && usableAreaM2 > builtAreaM2) {
    return "usableAreaCannotExceedBuiltArea";
  }
  return null;
}

/** Vraagprijs: must be a positive number. */
export function checkPurchasePrice(value: unknown): FieldValidationKey | null {
  return !isFiniteNumber(value) || value <= 0 ? "purchasePriceMustBePositive" : null;
}

/**
 * Gastos de comunidad: zero or positive, and mandatory - MODEL_SPEC.md
 * §15 gives it no default anywhere in the engine, because the figure
 * varies too much per building to estimate generically. Zero is allowed
 * (a building genuinely without a comunidad), but an absent value is not:
 * the form must ask, and the caller must not guess.
 */
export function checkCommunityFeesAnnual(value: unknown): FieldValidationKey | null {
  return !isFiniteNumber(value) || value < 0 ? "communityFeesMustBeZeroOrPositive" : null;
}

/**
 * Valor catastral, per component. Optional as a whole (MODEL_SPEC.md
 * §16), but once supplied each half must be zero or positive - a suelo of
 * zero is plausible for some titles, a negative one never is.
 */
export function checkCadastralSuelo(value: unknown): FieldValidationKey | null {
  return !isFiniteNumber(value) || value < 0 ? "cadastralSueloMustBeZeroOrPositive" : null;
}

export function checkCadastralConstruccion(value: unknown): FieldValidationKey | null {
  return !isFiniteNumber(value) || value < 0 ? "cadastralConstruccionMustBeZeroOrPositive" : null;
}

// ---------------------------------------------------------------------------
// Investor constraints and selections (wizard step 3)
// ---------------------------------------------------------------------------

/**
 * Beschikbaar eigen vermogen. Zero is allowed - a fully financed purchase
 * is a coherent thing to model even where no lender would fund it, and the
 * feasibility dimension (SCORE_SPEC.md §2.4) is what reports the shortfall.
 *
 * Form-level only: PropertyInput.ownMoney is optional in the engine, and
 * omitting it makes EquityFitCheck.fitsWithinAvailableEquity null rather
 * than invalid. The paid form asks for it (UI_SPEC.md §3) because a null
 * equity check would hollow out the feasibility score.
 */
export function checkOwnMoney(value: unknown): FieldValidationKey | null {
  return !isFiniteNumber(value) || value < 0 ? "ownMoneyMustBeZeroOrPositive" : null;
}

export function checkTotalBudget(value: unknown): FieldValidationKey | null {
  return !isFiniteNumber(value) || value <= 0 ? "totalBudgetMustBePositive" : null;
}

export function checkMaxRenovationBudget(value: unknown): FieldValidationKey | null {
  return !isFiniteNumber(value) || value < 0 ? "maxRenovationBudgetMustBeZeroOrPositive" : null;
}

/**
 * LTV bounds, as fractions (0.6), not percentages (60) - the form converts
 * before calling these, so one definition covers both the engine's units
 * and the field the customer sees.
 */
function isFraction(value: unknown): boolean {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

export function checkMinLtv(value: unknown): FieldValidationKey | null {
  return isFraction(value) ? null : "minLtvMustBeFraction";
}

export function checkMaxLtv(value: unknown): FieldValidationKey | null {
  return isFraction(value) ? null : "maxLtvMustBeFraction";
}

export function checkPreferredLtv(value: unknown): FieldValidationKey | null {
  if (value === undefined) return null;
  return isFraction(value) ? null : "preferredLtvMustBeFraction";
}

/**
 * Mirrors validateEngineInput()'s original ordering: the comparison only
 * runs once both bounds are numbers, so a broken bound reports its own
 * problem rather than also producing a confusing ordering complaint.
 */
export function checkLtvRange(minLtv: unknown, maxLtv: unknown): FieldValidationKey | null {
  if (!isFiniteNumber(minLtv) || !isFiniteNumber(maxLtv)) return null;
  return minLtv > maxLtv ? "minLtvCannotExceedMaxLtv" : null;
}

/** Any finite number: a negative floor ("I accept losing €200/month") is a real answer. */
export function checkMinMonthlyCashflow(value: unknown): FieldValidationKey | null {
  return isFiniteNumber(value) ? null : "minMonthlyCashflowMustBeANumber";
}

export function checkMaxMonthlyDebt(value: unknown): FieldValidationKey | null {
  return !isFiniteNumber(value) || value < 0 ? "maxMonthlyDebtMustBeZeroOrPositive" : null;
}

/**
 * Houdperiode. Form-level only: ExitPlanningInput.holdingYears is optional
 * in the engine and falls back to PROJECTION_YEARS, but a wizard that asks
 * the question must reject "3,5 jaar" rather than silently truncating it -
 * the projection is built year by year (projection.ts).
 */
export function checkHoldingYears(value: unknown): FieldValidationKey | null {
  return !isFiniteNumber(value) || !Number.isInteger(value) || value <= 0
    ? "holdingYearsMustBePositiveInteger"
    : null;
}

export function checkRentPerM2LongTerm(value: unknown): FieldValidationKey | null {
  return !isFiniteNumber(value) || value <= 0 ? "rentPerM2LongTermMustBePositive" : null;
}

export function checkRentPerM2ShortTerm(value: unknown): FieldValidationKey | null {
  return !isFiniteNumber(value) || value <= 0 ? "rentPerM2ShortTermMustBePositive" : null;
}
