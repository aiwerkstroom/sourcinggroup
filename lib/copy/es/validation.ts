/**
 * Dutch copy for field validation (UI_SPEC.md: Nederlands in de UI;
 * CLAUDE.md §6: Engels in de code en commentaar).
 *
 * Same split as lib/copy/es/free-tier-disclosures.ts: the calculation
 * layer (lib/rules/es/field-validation.ts) decides whether a field is
 * valid and returns a FieldValidationKey; this module is the only place
 * that key becomes a sentence. Interview round 3 chose this over a
 * separate client-side schema precisely so there is one definition of the
 * rules, not two that can drift.
 *
 * The Record is what keeps that promise enforceable: a key added to
 * FieldValidationKey without a line here fails to compile.
 */

import type { FieldValidationKey } from "../../rules/es/field-validation";

export const FIELD_VALIDATION_COPY_NL: Readonly<Record<FieldValidationKey, string>> = {
  required: "Dit veld is verplicht.",
  mustBeANumber: "Vul een getal in.",
  builtAreaMustBePositive: "Vul een gebouwd oppervlak groter dan 0 m² in.",
  usableAreaMustBePositive: "Vul een bruikbaar oppervlak groter dan 0 m² in.",
  usableAreaCannotExceedBuiltArea:
    "Het bruikbaar oppervlak kan niet groter zijn dan het gebouwde oppervlak.",
  purchasePriceMustBePositive: "Vul een vraagprijs groter dan € 0 in.",
  communityFeesMustBeZeroOrPositive:
    "Vul de gastos de comunidad in — € 0 mag, maar leeg laten niet. Dit bedrag verschilt te sterk per gebouw om te schatten.",
  cadastralSueloMustBeZeroOrPositive: "De waarde van de grond kan niet negatief zijn.",
  cadastralConstruccionMustBeZeroOrPositive:
    "De waarde van de opstal kan niet negatief zijn.",
  ownMoneyMustBeZeroOrPositive: "Vul uw beschikbaar eigen vermogen in — € 0 mag, negatief niet.",
  totalBudgetMustBePositive: "Vul een totaalbudget groter dan € 0 in.",
  maxRenovationBudgetMustBeZeroOrPositive:
    "Het renovatiebudget kan niet negatief zijn — € 0 mag wel.",
  minLtvMustBeFraction: "De minimale LTV moet tussen 0% en 100% liggen.",
  maxLtvMustBeFraction: "De maximale LTV moet tussen 0% en 100% liggen.",
  preferredLtvMustBeFraction: "De gewenste LTV moet tussen 0% en 100% liggen.",
  minLtvCannotExceedMaxLtv: "De minimale LTV kan niet hoger zijn dan de maximale LTV.",
  minMonthlyCashflowMustBeANumber:
    "Vul een bedrag in. Een negatief bedrag mag: dat betekent dat u bereid bent maandelijks bij te leggen.",
  maxMonthlyDebtMustBeZeroOrPositive: "De maximale maandlast kan niet negatief zijn.",
  holdingYearsMustBePositiveInteger: "Vul een heel aantal jaren in, minimaal 1.",
  rentPerM2LongTermMustBePositive: "Vul een langetermijnhuur groter dan € 0 in.",
  rentPerM2ShortTermMustBePositive: "Vul een kortetermijnhuur groter dan € 0 in.",
  occupancyLongTermMustBeFraction: "De bezettingsgraad langetermijn moet tussen 0% en 100% liggen.",
  occupancyShortTermMustBeFraction: "De bezettingsgraad kortetermijn moet tussen 0% en 100% liggen.",
};

/** Translates one validation key, with the same exhaustiveness guard the disclosure copy uses. */
export function translateFieldValidation(key: FieldValidationKey): string {
  switch (key) {
    case "required":
      return FIELD_VALIDATION_COPY_NL.required;
    case "mustBeANumber":
      return FIELD_VALIDATION_COPY_NL.mustBeANumber;
    case "builtAreaMustBePositive":
      return FIELD_VALIDATION_COPY_NL.builtAreaMustBePositive;
    case "usableAreaMustBePositive":
      return FIELD_VALIDATION_COPY_NL.usableAreaMustBePositive;
    case "usableAreaCannotExceedBuiltArea":
      return FIELD_VALIDATION_COPY_NL.usableAreaCannotExceedBuiltArea;
    case "purchasePriceMustBePositive":
      return FIELD_VALIDATION_COPY_NL.purchasePriceMustBePositive;
    case "communityFeesMustBeZeroOrPositive":
      return FIELD_VALIDATION_COPY_NL.communityFeesMustBeZeroOrPositive;
    case "cadastralSueloMustBeZeroOrPositive":
      return FIELD_VALIDATION_COPY_NL.cadastralSueloMustBeZeroOrPositive;
    case "cadastralConstruccionMustBeZeroOrPositive":
      return FIELD_VALIDATION_COPY_NL.cadastralConstruccionMustBeZeroOrPositive;
    case "ownMoneyMustBeZeroOrPositive":
      return FIELD_VALIDATION_COPY_NL.ownMoneyMustBeZeroOrPositive;
    case "totalBudgetMustBePositive":
      return FIELD_VALIDATION_COPY_NL.totalBudgetMustBePositive;
    case "maxRenovationBudgetMustBeZeroOrPositive":
      return FIELD_VALIDATION_COPY_NL.maxRenovationBudgetMustBeZeroOrPositive;
    case "minLtvMustBeFraction":
      return FIELD_VALIDATION_COPY_NL.minLtvMustBeFraction;
    case "maxLtvMustBeFraction":
      return FIELD_VALIDATION_COPY_NL.maxLtvMustBeFraction;
    case "preferredLtvMustBeFraction":
      return FIELD_VALIDATION_COPY_NL.preferredLtvMustBeFraction;
    case "minLtvCannotExceedMaxLtv":
      return FIELD_VALIDATION_COPY_NL.minLtvCannotExceedMaxLtv;
    case "minMonthlyCashflowMustBeANumber":
      return FIELD_VALIDATION_COPY_NL.minMonthlyCashflowMustBeANumber;
    case "maxMonthlyDebtMustBeZeroOrPositive":
      return FIELD_VALIDATION_COPY_NL.maxMonthlyDebtMustBeZeroOrPositive;
    case "holdingYearsMustBePositiveInteger":
      return FIELD_VALIDATION_COPY_NL.holdingYearsMustBePositiveInteger;
    case "rentPerM2LongTermMustBePositive":
      return FIELD_VALIDATION_COPY_NL.rentPerM2LongTermMustBePositive;
    case "rentPerM2ShortTermMustBePositive":
      return FIELD_VALIDATION_COPY_NL.rentPerM2ShortTermMustBePositive;
    case "occupancyLongTermMustBeFraction":
      return FIELD_VALIDATION_COPY_NL.occupancyLongTermMustBeFraction;
    case "occupancyShortTermMustBeFraction":
      return FIELD_VALIDATION_COPY_NL.occupancyShortTermMustBeFraction;
    default: {
      const exhaustive: never = key;
      throw new Error(`Missing Dutch copy for field validation key: ${String(exhaustive)}`);
    }
  }
}
