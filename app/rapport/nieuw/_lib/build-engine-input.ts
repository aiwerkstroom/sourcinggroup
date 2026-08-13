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
 */

import {
  deriveFinancingStrategy,
  deriveRenovationStrategy,
} from "@/lib/rules/es/derive-selections";
import type {
  CadastralValue,
  EngineInput,
  MaintenanceCondition,
  RentalStrategy,
} from "@/lib/rules/es/types";
import { parseNumberInput } from "./parse-number";
import { OTHER_NEIGHBORHOOD } from "../_state/wizard-state";
import type { WizardData } from "../_state/wizard-state";

/** Fixed by the product's audience, not asked - see the module docstring. */
export const FIXED_RESIDENCY = "nonResident" as const;
export const FIXED_EU_RESIDENT = true;

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

export function buildEngineInput(data: WizardData): EngineInput {
  const { pand, staatEnLasten, belegger, exit } = data;

  const neighborhood =
    pand.neighborhood === "" || pand.neighborhood === OTHER_NEIGHBORHOOD
      ? undefined
      : pand.neighborhood;

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
      euResident: FIXED_EU_RESIDENT,
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
  };
}
