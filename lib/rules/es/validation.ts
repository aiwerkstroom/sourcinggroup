/**
 * Input validation. The product is fully self-serve: every input must be
 * validated and impossible combinations must be rejected before any
 * calculation runs (TSG Yield Engine project spec, section 1).
 */

import type { EngineInput } from "./types";

export class ValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid input: ${issues.join("; ")}`);
    this.name = "ValidationError";
  }
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function validateEngineInput(input: EngineInput): string[] {
  const issues: string[] = [];
  const { property, constraints, selections } = input;

  if (!isFiniteNumber(property.livingAreaM2) || property.livingAreaM2 <= 0) {
    issues.push("livingAreaM2 must be a positive number");
  }
  if (!isFiniteNumber(property.purchasePrice) || property.purchasePrice <= 0) {
    issues.push("purchasePrice must be a positive number");
  }
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
