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
    default: {
      const exhaustive: never = key;
      throw new Error(`Missing Dutch copy for field validation key: ${String(exhaustive)}`);
    }
  }
}
