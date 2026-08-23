/**
 * Dutch, customer-readable labels and categories for §6.8 ("Aannames en
 * bronnen") - one row per parameter in ScenarioOutcome.assumptionsUsed
 * (lib/rules/es/assumptions.ts's collectUsedParameters()), grouped by
 * category as UI_SPEC.md §6.8 asks.
 *
 * Unlike §6.9's placeholder-disclosures.ts (full sentences explaining what
 * a PLACEHOLDER means), this is a reference list: a short label, which
 * category it belongs to, and where its certainty comes from - a source
 * and date for SOURCED, a one-line modelling note for ESTIMATE, and a
 * pointer to §6.9 for PLACEHOLDER (already fully explained there, so this
 * section does not duplicate that prose).
 *
 * describeAssumption() covers the full, closed set collectUsedParameters()
 * can ever produce: the same "exhaustive, fail loudly" discipline as
 * placeholder-disclosures.ts - an unrecognised name throws rather than
 * falling back to the raw parameter name.
 */

import type {
  FinancingStrategyId,
  Parameter,
  RenovationStrategyId,
  ScenarioId,
} from "../../rules/es/types";
import { RENOVATION_STRATEGY_LABEL_NL } from "./placeholder-disclosures";
import { SCENARIO_ID_COPY_NL } from "./scenarios";

export type AssumptionCategory =
  | "Huur"
  | "Renovatie"
  | "Financiering"
  | "Exploitatiekosten"
  | "Aankoopkosten"
  | "Scenario-aannames"
  | "Belasting"
  | "Waardeontwikkeling en indexering";

export interface AssumptionEntry {
  category: AssumptionCategory;
  /** Short reference-list label - not a full sentence, unlike §6.9's descriptions. */
  label: string;
  /** Source + date (SOURCED), a short modelling note (ESTIMATE), or a pointer to §6.9 (PLACEHOLDER, already explained there in full). */
  note: string;
}

const FINANCING_STRATEGY_LABEL_NL: Readonly<Record<FinancingStrategyId, string>> = {
  low: "lage leverage",
  medium: "middelhoge leverage",
  high: "hoge leverage",
};

const PLACEHOLDER_NOTE = "Nog niet extern geverifieerd - toegelicht in hoofdstuk 9.";

function sourcedNote(param: Parameter<unknown>): string {
  if (param.provenance !== "SOURCED") {
    throw new Error(`sourcedNote() called on a non-SOURCED parameter: ${param.name}`);
  }
  return `Bron: ${param.source}, ${param.date}.`;
}

const RENOVATION_FIELD_PATTERN =
  /^RENOVATION_STRATEGIES\.(minimal|light|heavy)\.(capex|rentMultiplier|maintenanceFactor|utilitiesEfficiency|timeToRentMonths)$/;
const FINANCING_FIELD_PATTERN = /^FINANCING_STRATEGIES\.(low|medium|high)\.(ltv|loanTermYears|interestRate)$/;
const SCENARIO_FIELD_PATTERN =
  /^SCENARIOS\.(conservative|base|optimistic)\.(rentLevelMultiplier|occupancyMultiplier|interestRateDelta|utilitiesMultiplier|maintenanceInflationMultiplier)$/;
const DEPRECIATION_FIELD_PATTERN = /^DEPRECIATION_SCENARIO_FACTORS\.(conservative|base|optimistic)$/;
const VALUE_GROWTH_FIELD_PATTERN = /^VALUE_GROWTH_ANNUAL\.(conservative|base|optimistic)$/;

const MODEL_CHOICE_NOTE = "Eigen modelkeuze, geen externe claim over de werkelijkheid.";

export function describeAssumption(param: Parameter<unknown>): AssumptionEntry {
  switch (param.name) {
    case "BASE_OCCUPANCY_LONG_TERM":
      return { category: "Huur", label: "Bezettingsgraad langetermijnverhuur", note: PLACEHOLDER_NOTE };
    case "BASE_OCCUPANCY_SHORT_TERM":
      return { category: "Huur", label: "Bezettingsgraad kortetermijnverhuur", note: PLACEHOLDER_NOTE };
    case "HYBRID_SHARE_LONG_TERM":
      return { category: "Huur", label: "Aandeel langetermijn in de hybride huurmix", note: MODEL_CHOICE_NOTE };
    case "HYBRID_SHARE_SHORT_TERM":
      return { category: "Huur", label: "Aandeel kortetermijn in de hybride huurmix", note: MODEL_CHOICE_NOTE };
    case "DEFAULT_USABLE_TO_BUILT_AREA_RATIO":
      return {
        category: "Huur",
        label: "Verhouding bruikbaar/gebouwd oppervlak (standaard)",
        note: PLACEHOLDER_NOTE,
      };
    case "DEFAULT_RENOVATION_IMPROVEMENT_SHARE":
      return {
        category: "Renovatie",
        label: "Waardeverhogend aandeel van de renovatiekosten",
        note: PLACEHOLDER_NOTE,
      };
    case "RENOVATION_DURATION_MONTHS_BY_TIER":
      // Fase C stap 2. Named as a duration, not as a vacancy: the vacancy
      // it causes is the consequence, and RENOVATION_STRATEGIES'
      // timeToRentMonths already occupies "leegstand" in this list.
      return { category: "Renovatie", label: "Doorlooptijd van de verbouwing", note: PLACEHOLDER_NOTE };
    case "MAINTENANCE_RATE":
      return { category: "Exploitatiekosten", label: "Onderhoudskosten (% van de huur)", note: PLACEHOLDER_NOTE };
    case "PROPERTY_MANAGEMENT_FEE":
      return { category: "Exploitatiekosten", label: "Beheerkosten (% van de huur)", note: sourcedNote(param) };
    case "PROPERTY_TAX_IBI_RATE":
      return { category: "Exploitatiekosten", label: "IBI-tarief", note: sourcedNote(param) };
    case "DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO":
      return {
        category: "Exploitatiekosten",
        label: "Kadastrale waarde t.o.v. aankoopprijs (standaard)",
        note: PLACEHOLDER_NOTE,
      };
    case "TOTAL_INSURANCE_ANNUAL":
      return { category: "Exploitatiekosten", label: "Verzekeringskosten (jaarlijks)", note: sourcedNote(param) };
    case "TOTAL_UTILITIES_PER_M2_ANNUAL":
      return {
        category: "Exploitatiekosten",
        label: "Nutsvoorzieningen (per m² per jaar)",
        note: sourcedNote(param),
      };
    case "BANK_FEE":
      return { category: "Exploitatiekosten", label: "Bankkosten (jaarlijks)", note: PLACEHOLDER_NOTE };
    case "ACQUISITION_RATES":
      return {
        category: "Aankoopkosten",
        label: "Overdrachtsbelasting, notaris-, registratie- en makelaarskosten",
        note: sourcedNote(param),
      };
    case "LEGAL_ADVICE_FEE":
      return { category: "Aankoopkosten", label: "Juridisch advies (% van de aankoopprijs)", note: sourcedNote(param) };
    case "NON_RESIDENT_INTEREST_SPREAD":
      return { category: "Financiering", label: "Renteopslag voor niet-ingezetenen", note: sourcedNote(param) };
    case "DEPRECIATION_RATE":
      return { category: "Belasting", label: "Fiscale afschrijving (% per jaar)", note: sourcedNote(param) };
    case "DEPRECIATION_BUILDING_SHARE":
      return {
        category: "Belasting",
        label: "Aandeel opstal in de afschrijvingsgrondslag",
        note: PLACEHOLDER_NOTE,
      };
    case "DEFAULT_BUILDING_SHARE_OF_VALUE":
      return {
        category: "Belasting",
        label: "Aandeel opstal in de aankoopprijs (standaard)",
        note: PLACEHOLDER_NOTE,
      };
    case "RENTAL_INCOME_TAX_RATE_EU":
      return {
        category: "Belasting",
        label: "Inkomstenbelasting huurinkomsten (EU-ingezetenen)",
        note: sourcedNote(param),
      };
    case "RENTAL_INCOME_TAX_RATE_NON_EU":
      return {
        category: "Belasting",
        label: "Inkomstenbelasting huurinkomsten (niet-EU-ingezetenen)",
        note: sourcedNote(param),
      };
    case "CAPITAL_GAINS_TAX_RATE_NON_RESIDENT":
      return { category: "Belasting", label: "Vermogenswinstbelasting bij verkoop", note: sourcedNote(param) };
    case "NON_RESIDENT_WITHHOLDING_RATE":
      return {
        category: "Belasting",
        label: "Bronbelasting bij verkoop (voorschot)",
        note: sourcedNote(param),
      };
    case "DEFAULT_MIN_REQUIRED_RETURN":
      return { category: "Belasting", label: "Minimale rendementseis (standaard)", note: PLACEHOLDER_NOTE };
    case "RENT_GROWTH_BY_YEAR":
      return {
        category: "Waardeontwikkeling en indexering",
        label: "Huurgroei per jaar",
        note: sourcedNote(param),
      };
    case "CPI_PERCENT_BY_YEAR":
      return {
        category: "Waardeontwikkeling en indexering",
        label: "Inflatie (CPI) per jaar",
        note: sourcedNote(param),
      };
    case "CORRECTION_FACTORS_LAST_YEAR":
      return {
        category: "Waardeontwikkeling en indexering",
        label: "Laatste jaar met brondata voor groei en inflatie",
        note: MODEL_CHOICE_NOTE,
      };
    case "CORRECTION_FACTORS_FIRST_ESTIMATE_YEAR":
      return {
        category: "Waardeontwikkeling en indexering",
        label: "Eerste jaar van de projectie",
        note: MODEL_CHOICE_NOTE,
      };
    default:
      break;
  }

  const renovationMatch = RENOVATION_FIELD_PATTERN.exec(param.name);
  if (renovationMatch !== null) {
    const tier = RENOVATION_STRATEGY_LABEL_NL[renovationMatch[1] as RenovationStrategyId];
    const field = renovationMatch[2]!;
    const fieldLabel: Readonly<Record<string, string>> = {
      capex: "Renovatiekosten",
      rentMultiplier: "Huureffect van de renovatie",
      maintenanceFactor: "Onderhoudseffect van de renovatie",
      utilitiesEfficiency: "Energie-effect van de renovatie",
      timeToRentMonths: "Leegstand na de renovatie",
    };
    return {
      category: "Renovatie",
      label: `${fieldLabel[field]} (${tier})`,
      note: PLACEHOLDER_NOTE,
    };
  }

  const financingMatch = FINANCING_FIELD_PATTERN.exec(param.name);
  if (financingMatch !== null) {
    const tier = FINANCING_STRATEGY_LABEL_NL[financingMatch[1] as FinancingStrategyId];
    const field = financingMatch[2]!;
    if (field === "interestRate") {
      return { category: "Financiering", label: `Hypotheekrente (${tier})`, note: sourcedNote(param) };
    }
    const fieldLabel: Readonly<Record<string, string>> = {
      ltv: "Loan-to-value",
      loanTermYears: "Hypotheeklooptijd",
    };
    return {
      category: "Financiering",
      label: `${fieldLabel[field]} (${tier})`,
      note: MODEL_CHOICE_NOTE,
    };
  }

  const scenarioMatch = SCENARIO_FIELD_PATTERN.exec(param.name);
  if (scenarioMatch !== null) {
    const scenario = SCENARIO_ID_COPY_NL[scenarioMatch[1] as ScenarioId];
    const field = scenarioMatch[2]!;
    const fieldLabel: Readonly<Record<string, string>> = {
      rentLevelMultiplier: "Huurniveau",
      occupancyMultiplier: "Bezettingsgraad",
      interestRateDelta: "Renteopslag",
      utilitiesMultiplier: "Energiekosten",
      maintenanceInflationMultiplier: "Onderhoudsinflatie",
    };
    return {
      category: "Scenario-aannames",
      label: `${fieldLabel[field]} t.o.v. het basisscenario (${scenario})`,
      note: MODEL_CHOICE_NOTE,
    };
  }

  const depreciationMatch = DEPRECIATION_FIELD_PATTERN.exec(param.name);
  if (depreciationMatch !== null) {
    const scenario = SCENARIO_ID_COPY_NL[depreciationMatch[1] as ScenarioId];
    return {
      category: "Belasting",
      label: `Afschrijvingsfactor (${scenario})`,
      note: PLACEHOLDER_NOTE,
    };
  }

  const valueGrowthMatch = VALUE_GROWTH_FIELD_PATTERN.exec(param.name);
  if (valueGrowthMatch !== null) {
    const scenario = SCENARIO_ID_COPY_NL[valueGrowthMatch[1] as ScenarioId];
    return {
      category: "Waardeontwikkeling en indexering",
      label: `Waardegroei vastgoed, jaarlijks (${scenario})`,
      note: sourcedNote(param),
    };
  }

  throw new Error(`Missing Dutch copy for assumption parameter: ${param.name}`);
}

/** Display order for the categories in §6.8 - roughly the order a deal's own numbers are built up in. */
export const ASSUMPTION_CATEGORY_ORDER: readonly AssumptionCategory[] = [
  "Huur",
  "Renovatie",
  "Financiering",
  "Exploitatiekosten",
  "Aankoopkosten",
  "Belasting",
  "Waardeontwikkeling en indexering",
  "Scenario-aannames",
];
