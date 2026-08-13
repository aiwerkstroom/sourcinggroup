/**
 * Dutch, customer-readable sentences for §6.9 ("Wat niet geverifieerd is")
 * - one sentence per PLACEHOLDER parameter a scenario's outcome actually
 * rests on (ScenarioOutcome.placeholdersUsed, built by outcome.ts's
 * collectPlaceholders()). UI_SPEC.md §6.9 is explicit that this is not a
 * disclaimer but a content chapter, so the customer reads what the number
 * means, never the parameter's internal name.
 *
 * describePlaceholderParameter() covers the full, closed set
 * collectPlaceholders() can ever produce (MODEL_SPEC.md §14): nine fixed
 * names, plus two families keyed by RenovationStrategyId and ScenarioId
 * respectively. It throws on an unrecognised name rather than falling back
 * to a generic sentence or the raw parameter name - the same "exhaustive,
 * fail loudly" discipline as lib/copy/es/scenarios.ts's Record and
 * rent-provenance-disclosures.ts's switch, so a new PLACEHOLDER added to
 * the calculation layer cannot silently reach the customer unexplained.
 */

import type { Parameter, RenovationStrategyId, ScenarioId } from "../../rules/es/types";
import { SCENARIO_ID_COPY_NL } from "./scenarios";

const EURO = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const PERCENT = new Intl.NumberFormat("nl-NL", {
  style: "percent",
  maximumFractionDigits: 1,
});

function euro(value: number): string {
  return EURO.format(value);
}

function percent(fraction: number): string {
  return PERCENT.format(fraction);
}

/** Shared with assumption-disclosures.ts - one Dutch label per renovation tier, used in both §6.8 and §6.9. */
export const RENOVATION_STRATEGY_LABEL_NL: Readonly<Record<RenovationStrategyId, string>> = {
  minimal: "minimaal",
  light: "licht",
  heavy: "grondig",
};

/** How a multiplier around 1 reads in a Dutch sentence: unchanged, lower or higher than the baseline it multiplies. */
function multiplierEffect(multiplier: number): string {
  if (multiplier === 1) return "gelijk verondersteld aan het standaardniveau";
  if (multiplier < 1) return `${percent(1 - multiplier)} lager verondersteld dan het standaardniveau`;
  return `${percent(multiplier - 1)} hoger verondersteld dan het standaardniveau`;
}

const RENOVATION_FIELD_PATTERN =
  /^RENOVATION_STRATEGIES\.(minimal|light|heavy)\.(capex|rentMultiplier|maintenanceFactor|utilitiesEfficiency|timeToRentMonths)$/;
const DEPRECIATION_FIELD_PATTERN =
  /^DEPRECIATION_SCENARIO_FACTORS\.(conservative|base|optimistic)$/;

/**
 * One customer-facing sentence for a single PLACEHOLDER parameter. Reads
 * the value directly off `param` rather than accepting it separately, so
 * this can never drift from what the calculation actually used.
 */
export function describePlaceholderParameter(param: Parameter<unknown>): string {
  const value = param.value as number;

  switch (param.name) {
    case "MAINTENANCE_RATE":
      return `Onderhoudskosten zijn geschat op ${percent(value)} van de huurinkomsten.`;
    case "BANK_FEE":
      return `De jaarlijkse bankkosten voor de hypotheek zijn geschat op ${euro(value)}.`;
    case "BASE_OCCUPANCY_LONG_TERM":
      return `De bezettingsgraad bij langetermijnverhuur is geschat op ${percent(value)}.`;
    case "BASE_OCCUPANCY_SHORT_TERM":
      return `De bezettingsgraad bij kortetermijnverhuur is geschat op ${percent(value)}.`;
    case "DEFAULT_BUILDING_SHARE_OF_VALUE":
      return (
        `Zonder kadastrale waarde is aangenomen dat ${percent(value)} van de aankoopprijs ` +
        `toerekenbaar is aan de opstal - de grondslag voor de fiscale afschrijving.`
      );
    case "DEFAULT_RENOVATION_IMPROVEMENT_SHARE":
      return (
        `Er is aangenomen dat ${percent(value)} van de renovatiekosten een waardeverhogende ` +
        `mejora betreft; de rest telt voor de vermogenswinstbelasting als onderhoud.`
      );
    case "DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO":
      return (
        `Zonder kadastrale waarde is de grondslag voor de IBI-berekening gelijkgesteld aan de ` +
        `aankoopprijs (verhouding ${value}:1).`
      );
    case "DEFAULT_USABLE_TO_BUILT_AREA_RATIO":
      return (
        `Zonder opgegeven bruikbaar oppervlak is aangenomen dat dit ${percent(value)} van het ` +
        `gebouwde oppervlak bedraagt.`
      );
    case "DEFAULT_MIN_REQUIRED_RETURN":
      return `Zonder eigen rendementseis is een minimale rendementsdoelstelling van ${percent(value)} aangehouden.`;
    default:
      break;
  }

  const renovationMatch = RENOVATION_FIELD_PATTERN.exec(param.name);
  if (renovationMatch !== null) {
    const tier = RENOVATION_STRATEGY_LABEL_NL[renovationMatch[1] as RenovationStrategyId];
    const field = renovationMatch[2];
    switch (field) {
      case "capex":
        return `De renovatiekosten voor het gekozen scenario ${tier} zijn geschat op ${euro(value)}.`;
      case "rentMultiplier":
        return `Na een ${tier} renovatie is de huurwaarde ${multiplierEffect(value)}.`;
      case "maintenanceFactor":
        return `Na een ${tier} renovatie zijn de onderhoudskosten ${multiplierEffect(value)}.`;
      case "utilitiesEfficiency":
        return `Na een ${tier} renovatie zijn de energiekosten ${multiplierEffect(value)}.`;
      case "timeToRentMonths":
        return (
          `Na een ${tier} renovatie is aangenomen dat het pand ${value} ` +
          `${value === 1 ? "maand" : "maanden"} leeg staat voordat het verhuurd wordt.`
        );
      default:
        break;
    }
  }

  const depreciationMatch = DEPRECIATION_FIELD_PATTERN.exec(param.name);
  if (depreciationMatch !== null) {
    const scenario = SCENARIO_ID_COPY_NL[depreciationMatch[1] as ScenarioId];
    return (
      `De fiscale afschrijvingsfactor voor het scenario ${scenario} is vastgesteld op ${value} ` +
      `ten opzichte van de standaardafschrijving.`
    );
  }

  throw new Error(`Missing Dutch copy for PLACEHOLDER parameter: ${param.name}`);
}
