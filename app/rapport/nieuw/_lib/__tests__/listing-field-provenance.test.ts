/**
 * Golden test for the listing-field provenance passthrough (SOURCING_SPEC.md
 * §7 step 4, stap 1 van 3): WizardData.listingOrigin -> buildEngineInput()'s
 * comparison -> EngineInput.listingFieldProvenance -> runEngine()'s
 * unchanged passthrough -> EngineResult.listingFieldProvenance.
 *
 * Two things carry real weight here:
 *
 * - EXISTING BEHAVIOUR IS UNCHANGED. Every wizard entry today has
 *   listingOrigin: null, so EngineResult.listingFieldProvenance must be
 *   EMPTY_LISTING_FIELD_PROVENANCE (all four null) and the reference
 *   case's own anchor - base scenario score 3,7 at percentile 70 - must
 *   still land exactly there. If either moved, this step would have
 *   quietly touched the paid path it was never meant to touch.
 * - THE COMPARISON IS NUMERIC, NOT STRING-EXACT, for the three numeric
 *   fields. A customer who retypes "620000" as "620.000" - same number,
 *   different spelling - must still read as "fromListing", not
 *   "confirmed": nothing about that keystroke was a correction.
 */

import { describe, expect, it } from "vitest";
import { runEngine } from "@/lib/rules/es/engine";
import { EMPTY_LISTING_FIELD_PROVENANCE } from "@/lib/rules/es/types";
import { buildEngineInput } from "../build-engine-input";
import type { ListingOrigin, WizardData } from "../../_state/wizard-state";

const referenceWizardData: WizardData = {
  pand: {
    address: "Avenida Primado Reig 19, Valencia",
    neighborhood: "__other__",
    purchasePrice: "330.000",
    builtAreaM2: "133",
    usableAreaM2: "133",
    rooms: "7",
    bedrooms: "5",
    bathrooms: "5",
    constructionYear: "1972",
    energyLabel: "B",
  },
  staatEnLasten: {
    maintenanceCondition: "average",
    renovationStrategyOverride: "",
    renovationDurationMonths: "",
    communityFeesAnnual: "900",
    cadastralSuelo: "",
    cadastralConstruccion: "",
    currentRentStatus: "",
    currentRentMonthly: "",
    hasTouristRentalLicense: "yes",
    hasUpcomingDerramas: false,
    upcomingDerramasAmount: "",
  },
  belegger: {
    ownMoney: "115.000",
    totalBudget: "450.000",
    maxRenovationBudget: "60.000",
    preferredLtvPercent: "75",
    minLtvPercent: "60",
    maxLtvPercent: "75",
    hasOwnFinancingOffer: false,
    interestRatePercent: "",
    loanTermYears: "",
    maxMonthlyDebt: "1.000",
    minMonthlyCashflow: "500",
    minRoiTargetPercent: "4",
    holdingYears: "10",
    taxResidency: "netherlands",
    rentalStrategy: "hybrid",
    rentPerM2LongTerm: "17",
    rentPerM2ShortTerm: "36",
    rentFromActualCurrentRent: "",
    rentPrefilled: true,
    occupancyLongTermPercent: "",
    occupancyShortTermPercent: "",
  },
  exit: {
    sellingCommissionPercent: "4",
    municipalCapitalGainsTax: "3.500",
    plusvaliaPrefilled: true,
  },
  listingOrigin: null,
};

describe("no listing involved (every wizard entry today) - existing behaviour is unchanged", () => {
  it("EngineInput.listingFieldProvenance is EMPTY_LISTING_FIELD_PROVENANCE", () => {
    const input = buildEngineInput(referenceWizardData);
    expect(input.listingFieldProvenance).toEqual(EMPTY_LISTING_FIELD_PROVENANCE);
  });

  it("EngineResult.listingFieldProvenance is EMPTY_LISTING_FIELD_PROVENANCE too - a pure passthrough", () => {
    const input = buildEngineInput(referenceWizardData);
    const result = runEngine(input);
    expect(result.listingFieldProvenance).toEqual(EMPTY_LISTING_FIELD_PROVENANCE);
  });

  it("the reference case's own anchor is untouched: base scenario 3,7 at percentile 70", () => {
    const input = buildEngineInput(referenceWizardData);
    const result = runEngine(input);
    const base = result.scenarioOutcomes!.find((o) => o.scenario === "base")!;
    expect(base.score!.total).toBe(3.7);
    expect(base.percentile).toBe(70);
  });

  it("runEngine() called on a bare EngineInput with no listingFieldProvenance key at all still defaults cleanly", () => {
    const input = buildEngineInput(referenceWizardData);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- deliberately dropping the key to prove the default applies
    const { listingFieldProvenance, ...withoutProvenance } = input;
    const result = runEngine(withoutProvenance);
    expect(result.listingFieldProvenance).toEqual(EMPTY_LISTING_FIELD_PROVENANCE);
  });
});

describe("a listing was chosen, and every field is left exactly as prefilled", () => {
  const origin: ListingOrigin = {
    neighborhood: "El Carmen (Ciutat Vella)",
    purchasePriceEUR: 620000,
    builtAreaM2: 180,
    usableAreaM2: 165,
  };
  const wizardData: WizardData = {
    ...referenceWizardData,
    pand: {
      ...referenceWizardData.pand,
      neighborhood: "El Carmen (Ciutat Vella)",
      purchasePrice: "620.000",
      builtAreaM2: "180",
      usableAreaM2: "165",
    },
    listingOrigin: origin,
  };

  it("all four fields report fromListing", () => {
    const input = buildEngineInput(wizardData);
    expect(input.listingFieldProvenance).toEqual({
      neighborhood: { status: "fromListing", originalValue: "El Carmen (Ciutat Vella)" },
      purchasePrice: { status: "fromListing", originalValue: 620000 },
      builtAreaM2: { status: "fromListing", originalValue: 180 },
      usableAreaM2: { status: "fromListing", originalValue: 165 },
    });
  });

  it("survives the passthrough into EngineResult unchanged", () => {
    const result = runEngine(buildEngineInput(wizardData));
    expect(result.listingFieldProvenance).toEqual({
      neighborhood: { status: "fromListing", originalValue: "El Carmen (Ciutat Vella)" },
      purchasePrice: { status: "fromListing", originalValue: 620000 },
      builtAreaM2: { status: "fromListing", originalValue: 180 },
      usableAreaM2: { status: "fromListing", originalValue: 165 },
    });
  });
});

describe("a listing was chosen, and the customer edits the price", () => {
  const origin: ListingOrigin = {
    neighborhood: "El Carmen (Ciutat Vella)",
    purchasePriceEUR: 620000,
    builtAreaM2: 180,
    usableAreaM2: 165,
  };
  const wizardData: WizardData = {
    ...referenceWizardData,
    pand: {
      ...referenceWizardData.pand,
      neighborhood: "El Carmen (Ciutat Vella)",
      purchasePrice: "615.000", // edited down from the listing's 620.000
      builtAreaM2: "180",
      usableAreaM2: "165",
    },
    listingOrigin: origin,
  };

  it("only the edited field reports confirmed - the other three stay fromListing", () => {
    const input = buildEngineInput(wizardData);
    expect(input.listingFieldProvenance!.purchasePrice).toEqual({
      status: "confirmed",
      originalValue: 620000,
    });
    expect(input.listingFieldProvenance!.neighborhood!.status).toBe("fromListing");
    expect(input.listingFieldProvenance!.builtAreaM2!.status).toBe("fromListing");
    expect(input.listingFieldProvenance!.usableAreaM2!.status).toBe("fromListing");
  });
});

describe("the comparison is numeric, not string-exact", () => {
  it("retyping the same price in a different but equal-valued format still reads as fromListing", () => {
    const origin: ListingOrigin = { purchasePriceEUR: 620000 };
    const wizardData: WizardData = {
      ...referenceWizardData,
      pand: { ...referenceWizardData.pand, purchasePrice: "620000" }, // no thousands separator - same number as the listing's 620000
      listingOrigin: origin,
    };

    const input = buildEngineInput(wizardData);
    expect(input.listingFieldProvenance!.purchasePrice).toEqual({
      status: "fromListing",
      originalValue: 620000,
    });
  });

  it("a genuinely different number reads as confirmed", () => {
    const origin: ListingOrigin = { purchasePriceEUR: 620000 };
    const wizardData: WizardData = {
      ...referenceWizardData,
      pand: { ...referenceWizardData.pand, purchasePrice: "620.001" },
      listingOrigin: origin,
    };

    const input = buildEngineInput(wizardData);
    expect(input.listingFieldProvenance!.purchasePrice!.status).toBe("confirmed");
  });
});

describe("a listing without its own usableAreaM2", () => {
  it("leaves usableAreaM2 null in the report - there is nothing to compare against", () => {
    const origin: ListingOrigin = {
      neighborhood: "Cullera",
      purchasePriceEUR: 72000,
      builtAreaM2: 38,
      // usableAreaM2 deliberately omitted - mock-009's own fixture has none either.
    };
    const wizardData: WizardData = {
      ...referenceWizardData,
      pand: {
        ...referenceWizardData.pand,
        neighborhood: "Cullera",
        purchasePrice: "72.000",
        builtAreaM2: "38",
        usableAreaM2: "", // the wizard's own field, left blank same as any normal entry
      },
      listingOrigin: origin,
    };

    const input = buildEngineInput(wizardData);
    expect(input.listingFieldProvenance!.usableAreaM2).toBeNull();
    expect(input.listingFieldProvenance!.neighborhood!.status).toBe("fromListing");
    expect(input.listingFieldProvenance!.purchasePrice!.status).toBe("fromListing");
    expect(input.listingFieldProvenance!.builtAreaM2!.status).toBe("fromListing");
  });
});

