/**
 * Turns the four wizard steps into one EngineInput.
 *
 * This is where the whole paid path converges, and where three things
 * that earlier steps only recorded finally take effect:
 *
 * - The two derivations from interview round 1. The customer never picks
 *   a renovation tier or a financing tier; deriveRenovationStrategy()
 *   reads step 2's condition and deriveFinancingStrategy() reads step 3's
 *   desired LTV.
 * - The permit gate. Step 3 already refused to offer short-term or hybrid
 *   without a licence, and validateEngineInput() refuses the combination
 *   too - so the gate holds even if this assembly were ever called with
 *   hand-written data.
 * - The rent provenance declaration, carried through as
 *   ModelSelections.rentPerM2FromActualCurrentRent.
 *
 * Server-side only: it imports derive-selections.ts, which reads
 * parameters.ts. That is deliberate and matches where it is called from
 * (a Server Action).
 *
 * Residency is fixed rather than asked. CLAUDE.md §1 defines the audience
 * as a Dutch private investor, who is non-resident in Spain by definition
 * and EU-resident for the rental income tax split - so asking would be
 * offering a choice that does not exist. The report's assumptions
 * appendix (UI_SPEC.md §6.8) is where these two show up.
 *
 * - The listing-field provenance comparison (SOURCING_SPEC.md §4/§7 step
 *   4). WizardData.listingOrigin records what a chosen listing supplied,
 *   once, at prefill time; this is where that snapshot is compared
 *   against what actually got submitted - the same "derive from a
 *   comparison, no separate touched-flag" approach
 *   computeRentInputProvenance() already established for the rent rate.
 *   runEngine() does none of this comparing itself, only a passthrough.
 */

import {
  deriveFinancingStrategy,
  deriveRenovationStrategy,
} from "@/lib/rules/es/derive-selections";
import { EMPTY_LISTING_FIELD_PROVENANCE } from "@/lib/rules/es/types";
import type {
  CadastralValue,
  EngineInput,
  ListingFieldProvenanceReport,
  ListingFieldProvenanceStatus,
  MaintenanceCondition,
  RentalStrategy,
  TaxResidency,
} from "@/lib/rules/es/types";
import { parseNumberInput } from "./parse-number";
import { OTHER_NEIGHBORHOOD } from "../_state/wizard-state";
import type { ListingOrigin, PandStepData, WizardData } from "../_state/wizard-state";

/**
 * Still fixed by the product's audience: every customer of this report is
 * a non-resident of Spain, which is what the non-resident interest spread
 * keys off.
 */
export const FIXED_RESIDENCY = "nonResident" as const;

/**
 * NO LONGER FIXED. euResident used to be hard-coded true here, which
 * silently assumed EU/EEA treatment for everyone - 19% on net income.
 * For an investor resident outside the EU that is wrong twice over: the
 * rate is 24%, and nothing is deductible, so the real tax is routinely
 * two to three times what the report showed. The wizard now asks
 * (step 3), and this value is derived from the answer.
 *
 * Kept only as the fallback for a WizardData that predates the field.
 * That fallback is EU treatment, which is exactly what the old fixed
 * assumption produced - so an old input still computes what it always
 * computed rather than silently changing meaning.
 */
export const FALLBACK_TAX_RESIDENCY = "netherlands" as const;

export class WizardAssemblyError extends Error {
  constructor(public readonly field: string) {
    super(`Wizard data is incomplete or unparseable at: ${field}`);
    this.name = "WizardAssemblyError";
  }
}

/**
 * Every numeric field reaching this point has already passed its step's
 * validation, so anything unparseable here is a bug rather than user
 * error - hence a throw rather than a returned issue list. The field name
 * travels with it so the failure is locatable.
 */
function number(raw: string, field: string): number {
  const parsed = parseNumberInput(raw);
  if (parsed.state !== "ok") throw new WizardAssemblyError(field);
  return parsed.value;
}

function optionalNumber(raw: string): number | undefined {
  const parsed = parseNumberInput(raw);
  return parsed.state === "ok" ? parsed.value : undefined;
}

function percentAsFraction(raw: string, field: string): number {
  return number(raw, field) / 100;
}

/**
 * The cadastral value is all-or-nothing: IBI needs suelo and construcción
 * together (MODEL_SPEC.md §16), and step 2 enforces that pairing. Half a
 * value here means the customer supplied neither.
 */
function cadastralValue(suelo: string, construccion: string): CadastralValue | undefined {
  const s = optionalNumber(suelo);
  const c = optionalNumber(construccion);
  if (s === undefined || c === undefined) return undefined;
  return { suelo: s, construccion: c };
}

/** "fromListing" when the current value still matches the origin exactly, "confirmed" the moment it does not. */
function fieldStatus(currentValue: unknown, originalValue: unknown): ListingFieldProvenanceStatus {
  return currentValue === originalValue ? "fromListing" : "confirmed";
}

/**
 * Compares WizardData.listingOrigin against what step 1 actually holds,
 * numerically for the three numeric fields (not the raw strings) - so
 * retyping "620000" as "620.000" is not read as an edit it was not. The
 * neighbourhood is a closed dropdown value, so string equality is exact
 * comparison there, not an approximation.
 *
 * propertyType carries no entry here at all: SOURCING_SPEC.md §4's own
 * standard is a value that carries the outcome, and propertyType is
 * recorded but consumed by no calculation - it is prefilled without
 * being tracked, by design, not by omission.
 */
function computeListingFieldProvenance(
  pand: PandStepData,
  origin: ListingOrigin | null,
): ListingFieldProvenanceReport {
  if (origin === null) return EMPTY_LISTING_FIELD_PROVENANCE;

  const neighborhood =
    origin.neighborhood === undefined
      ? null
      : {
          status: fieldStatus(pand.neighborhood, origin.neighborhood),
          originalValue: origin.neighborhood,
        };

  const purchasePrice =
    origin.purchasePriceEUR === undefined
      ? null
      : {
          status: fieldStatus(optionalNumber(pand.purchasePrice), origin.purchasePriceEUR),
          originalValue: origin.purchasePriceEUR,
        };

  const builtAreaM2 =
    origin.builtAreaM2 === undefined
      ? null
      : {
          status: fieldStatus(optionalNumber(pand.builtAreaM2), origin.builtAreaM2),
          originalValue: origin.builtAreaM2,
        };

  const usableAreaM2 =
    origin.usableAreaM2 === undefined
      ? null
      : {
          status: fieldStatus(optionalNumber(pand.usableAreaM2), origin.usableAreaM2),
          originalValue: origin.usableAreaM2,
        };

  return { neighborhood, purchasePrice, builtAreaM2, usableAreaM2 };
}

export function buildEngineInput(data: WizardData): EngineInput {
  const { pand, staatEnLasten, belegger, exit } = data;

  const neighborhood =
    pand.neighborhood === "" || pand.neighborhood === OTHER_NEIGHBORHOOD
      ? undefined
      : pand.neighborhood;

  // Required from step 3. Anything unrecognised - including "" from a
  // WizardData that predates the field - falls back to EU treatment, the
  // assumption this replaced, rather than guessing the more expensive one.
  const taxResidency: TaxResidency =
    belegger.taxResidency === "netherlands" ||
    belegger.taxResidency === "otherEu" ||
    belegger.taxResidency === "nonEu"
      ? belegger.taxResidency
      : FALLBACK_TAX_RESIDENCY;

  const rentalStrategy = belegger.rentalStrategy as RentalStrategy;
  const usesShortTerm = rentalStrategy === "shortTerm" || rentalStrategy === "hybrid";

  const preferredLtv = percentAsFraction(belegger.preferredLtvPercent, "preferredLtv");

  return {
    property: {
      // PropertyInput.name is required by the type but is a label, not an
      // input the form asks for; the address is what identifies the deal.
      name: pand.address,
      region: "Valencia",
      neighborhood,
      address: pand.address,
      propertyType: pand.propertyType === "" ? undefined : pand.propertyType,
      currentRentStatus:
        staatEnLasten.currentRentStatus === "" ? undefined : staatEnLasten.currentRentStatus,
      usableAreaM2: optionalNumber(pand.usableAreaM2),
      builtAreaM2: number(pand.builtAreaM2, "builtAreaM2"),
      rooms: optionalNumber(pand.rooms),
      bedrooms: optionalNumber(pand.bedrooms),
      bathrooms: optionalNumber(pand.bathrooms),
      constructionYear: optionalNumber(pand.constructionYear),
      energyLabel: pand.energyLabel === "" ? undefined : pand.energyLabel,
      purchasePrice: number(pand.purchasePrice, "purchasePrice"),
      ownMoney: number(belegger.ownMoney, "ownMoney"),
      communityFeesAnnual: number(staatEnLasten.communityFeesAnnual, "communityFeesAnnual"),
      cadastralValue: cadastralValue(
        staatEnLasten.cadastralSuelo,
        staatEnLasten.cadastralConstruccion,
      ),
      hasTouristRentalLicense: staatEnLasten.hasTouristRentalLicense === "yes",
    },
    constraints: {
      totalBudget: number(belegger.totalBudget, "totalBudget"),
      maxRenovationBudget: number(belegger.maxRenovationBudget, "maxRenovationBudget"),
      preferredLtv,
      minLtv: percentAsFraction(belegger.minLtvPercent, "minLtv"),
      maxLtv: percentAsFraction(belegger.maxLtvPercent, "maxLtv"),
      minRoiTarget: percentAsFraction(belegger.minRoiTargetPercent, "minRoiTarget"),
      minMonthlyCashflow: number(belegger.minMonthlyCashflow, "minMonthlyCashflow"),
      maxMonthlyDebt: number(belegger.maxMonthlyDebt, "maxMonthlyDebt"),
    },
    selections: {
      rentPerM2LongTerm: number(belegger.rentPerM2LongTerm, "rentPerM2LongTerm"),
      // ModelSelections requires both rates even when the strategy uses
      // only one (validateEngineInput insists both are positive). The
      // unused rate reaches no calculation - income.ts computes both
      // IncomeLines but only the selected strategy's figure travels on -
      // and rentInputProvenance reports null for it, so it is not
      // presented as if it mattered.
      rentPerM2ShortTerm: usesShortTerm
        ? number(belegger.rentPerM2ShortTerm, "rentPerM2ShortTerm")
        : 1,
      rentalStrategy,
      renovationStrategy: deriveRenovationStrategy(
        staatEnLasten.maintenanceCondition as MaintenanceCondition,
      ),
      financingStrategy: deriveFinancingStrategy(preferredLtv),
      residency: FIXED_RESIDENCY,
      taxResidency,
      rentPerM2FromActualCurrentRent:
        belegger.rentFromActualCurrentRent === "" ? undefined : belegger.rentFromActualCurrentRent,
    },
    exitPlanning: {
      assumptions: {
        sellingCommissionRate: percentAsFraction(
          exit.sellingCommissionPercent,
          "sellingCommissionRate",
        ),
        municipalCapitalGainsTax: number(
          exit.municipalCapitalGainsTax,
          "municipalCapitalGainsTax",
        ),
      },
      holdingYears: number(belegger.holdingYears, "holdingYears"),
    },
    listingFieldProvenance: computeListingFieldProvenance(pand, data.listingOrigin),
  };
}
