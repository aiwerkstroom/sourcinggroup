/**
 * End-to-end golden test for the report-rendering half of the listing
 * handoff (SOURCING_SPEC.md §4/§7 step 4, stap 3 van 3): a chosen
 * listing's values, carried through WizardData.listingOrigin ->
 * buildEngineInput()'s comparison (stap 1) -> EngineResult.
 * listingFieldProvenance -> PaidReport's own rendering of §6.1's boxed
 * price notice and §6.8's quiet wijk/oppervlak line.
 *
 * Three things carry real weight here, matching this step's own task:
 *
 * - A listing chosen and left untouched shows the §6.1 box (with the
 *   listing's own price) and the §6.8 line (naming wijk and both areas).
 * - The customer editing the price away from the listing's value drops
 *   the §6.1 box - the price is confirmed now - while the §6.8 line still
 *   names the three fields that were not edited.
 * - A direct wizard entry (no listing at all, exactly today's existing
 *   behaviour) renders neither section - proving this step did not touch
 *   the paid path for every customer who never used sourcing.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { runEngine } from "@/lib/rules/es/engine";
import { buildEngineInput } from "@/app/rapport/nieuw/_lib/build-engine-input";
import type { ListingOrigin, WizardData } from "@/app/rapport/nieuw/_state/wizard-state";
import { PaidReport } from "../paid-report";

const referenceWizardData: WizardData = {
  pand: {
    address: "Avenida Primado Reig 19, Valencia",
    neighborhood: "__other__",
    propertyType: "",
    units: "",
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
    communityFeesAnnual: "900",
    cadastralSuelo: "",
    cadastralConstruccion: "",
    currentRentStatus: "",
    currentRentMonthly: "",
    hasTouristRentalLicense: "yes",
  },
  belegger: {
    ownMoney: "115.000",
    totalBudget: "450.000",
    maxRenovationBudget: "60.000",
    preferredLtvPercent: "75",
    minLtvPercent: "60",
    maxLtvPercent: "75",
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

const listingOrigin: ListingOrigin = {
  neighborhood: "El Carmen (Ciutat Vella)",
  purchasePriceEUR: 620000,
  builtAreaM2: 180,
  usableAreaM2: 165,
};

function renderReportFor(wizardData: WizardData): string {
  const input = buildEngineInput(wizardData);
  const result = runEngine(input);
  return renderToStaticMarkup(<PaidReport result={result} />);
}

describe("a listing chosen and left exactly as prefilled", () => {
  const wizardData: WizardData = {
    ...referenceWizardData,
    pand: {
      ...referenceWizardData.pand,
      neighborhood: "El Carmen (Ciutat Vella)",
      purchasePrice: "620.000",
      builtAreaM2: "180",
      usableAreaM2: "165",
    },
    listingOrigin,
  };

  it("shows the §6.1 boxed notice with the listing's own price", () => {
    const html = renderReportFor(wizardData);
    expect(html).toContain("€ 620.000");
    expect(html).toContain("nog niet door u bevestigd");
    expect(html).toContain("Controleer of dit bedrag nog actueel is");
    expect(html).toMatch(/border-l-2[^>]*>[\s\S]*Controleer of dit bedrag/);
  });

  it("shows the §6.8 quiet line naming wijk and both areas", () => {
    const html = renderReportFor(wizardData);
    expect(html).toContain(
      "De wijk, het gebouwd oppervlak en het bruikbaar oppervlak zijn overgenomen uit de gekozen listing, niet door u bevestigd.",
    );
  });
});

describe("a listing chosen, then the customer edits the price", () => {
  const wizardData: WizardData = {
    ...referenceWizardData,
    pand: {
      ...referenceWizardData.pand,
      neighborhood: "El Carmen (Ciutat Vella)",
      purchasePrice: "615.000", // edited down from the listing's 620.000
      builtAreaM2: "180",
      usableAreaM2: "165",
    },
    listingOrigin,
  };

  it("does not show the §6.1 box - the price is confirmed now", () => {
    const html = renderReportFor(wizardData);
    expect(html).not.toContain("Controleer of dit bedrag");
    expect(html).not.toMatch(/€\s?620\.000/);
  });

  it("still shows the §6.8 line for the three fields that were not edited", () => {
    const html = renderReportFor(wizardData);
    expect(html).toContain(
      "De wijk, het gebouwd oppervlak en het bruikbaar oppervlak zijn overgenomen uit de gekozen listing, niet door u bevestigd.",
    );
  });
});

describe("a direct wizard entry - no listing involved, today's existing behaviour", () => {
  it("renders neither the §6.1 box nor the §6.8 line", () => {
    const html = renderReportFor(referenceWizardData);
    expect(html).not.toContain("Controleer of dit bedrag");
    expect(html).not.toContain("overgenomen uit de gekozen listing");
  });

  it("the reference case's own anchor is untouched: base scenario 3,8 at percentile 70", () => {
    const input = buildEngineInput(referenceWizardData);
    const result = runEngine(input);
    const base = result.scenarioOutcomes!.find((o) => o.scenario === "base")!;
    expect(base.score!.total).toBe(3.8);
    expect(base.percentile).toBe(70);
  });
});
