/**
 * Rental income model. Replicates Costs & Income!J4:N38.
 */

import {
  BASE_OCCUPANCY_LONG_TERM,
  BASE_OCCUPANCY_SHORT_TERM,
  HYBRID_SHARE_LONG_TERM,
  HYBRID_SHARE_SHORT_TERM,
} from "./parameters";
import type { IncomeLine, IncomeModel, RentalStrategy } from "./types";

export const MONTHS_PER_YEAR = 12;

/** Base rent per month: €/m²/month x living area (L10/N10). */
export function baseMonthlyRent(rentPerM2: number, livingAreaM2: number): number {
  return rentPerM2 * livingAreaM2;
}

/** One income line: base rent -> annual -> at occupancy -> renovation-adjusted (L10..L20). */
export function incomeLine(
  rentPerM2: number,
  livingAreaM2: number,
  occupancy: number,
  rentMultiplier: number,
): IncomeLine {
  const monthly = baseMonthlyRent(rentPerM2, livingAreaM2);
  const annual = monthly * MONTHS_PER_YEAR;
  const atOccupancy = annual * occupancy;
  return {
    rentPerM2,
    baseMonthlyRent: monthly,
    baseAnnualRent: annual,
    occupancy,
    annualIncomeAtOccupancy: atOccupancy,
    rentMultiplier,
    adjustedAnnualIncome: atOccupancy * rentMultiplier,
  };
}

/** Hybrid gross rental income: LT share x adjusted LT + ST share x adjusted ST (L38). */
export function hybridGrossIncome(adjustedLongTerm: number, adjustedShortTerm: number): number {
  return (
    adjustedLongTerm * HYBRID_SHARE_LONG_TERM.value +
    adjustedShortTerm * HYBRID_SHARE_SHORT_TERM.value
  );
}

export function buildIncomeModel(args: {
  rentPerM2LongTerm: number;
  rentPerM2ShortTerm: number;
  livingAreaM2: number;
  rentMultiplier: number;
  rentalStrategy: RentalStrategy;
}): IncomeModel {
  const longTerm = incomeLine(
    args.rentPerM2LongTerm,
    args.livingAreaM2,
    BASE_OCCUPANCY_LONG_TERM.value,
    args.rentMultiplier,
  );
  const shortTerm = incomeLine(
    args.rentPerM2ShortTerm,
    args.livingAreaM2,
    BASE_OCCUPANCY_SHORT_TERM.value,
    args.rentMultiplier,
  );
  const hybrid = hybridGrossIncome(
    longTerm.adjustedAnnualIncome,
    shortTerm.adjustedAnnualIncome,
  );
  const selected =
    args.rentalStrategy === "longTerm"
      ? longTerm.adjustedAnnualIncome
      : args.rentalStrategy === "shortTerm"
        ? shortTerm.adjustedAnnualIncome
        : hybrid;
  return {
    longTerm,
    shortTerm,
    hybridShareLongTerm: HYBRID_SHARE_LONG_TERM.value,
    hybridShareShortTerm: HYBRID_SHARE_SHORT_TERM.value,
    hybridGrossAnnualIncome: hybrid,
    selectedGrossAnnualIncome: selected,
  };
}
