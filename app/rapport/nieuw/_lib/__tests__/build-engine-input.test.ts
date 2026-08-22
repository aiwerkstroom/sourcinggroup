import { describe, expect, it } from "vitest";
import { runEngine } from "@/lib/rules/es/engine";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { buildEngineInput, FIXED_RESIDENCY } from "../build-engine-input";
import { WizardAssemblyError } from "../build-engine-input";
import type { WizardData } from "../../_state/wizard-state";

/**
 * The anchor for the whole wizard integration: drive the reference case
 * (Avenida Primado Reig 19) through the four steps exactly as a customer
 * would fill them, assemble it, and check the engine produces the figures
 * already locked down in outcome.test.ts - base scenario score 3,8 and
 * percentile 70.
 *
 * Two places where the wizard cannot express the reference case literally,
 * both harmless and checked below:
 *
 * - referencecase.ts leaves preferredLtv undefined and names
 *   financingStrategy "high" outright. The wizard has no "pick a tier"
 *   field, so this fills 75% as the desired LTV, which
 *   deriveFinancingStrategy() maps to "high". Because 75% is also that
 *   tier's own LTV, clampLtv() and selectInterestRate() land on identical
 *   figures either way.
 * - referencecase.ts sets riskTolerance "medium". The wizard does not ask
 *   it and no calculation reads it (it appears only in types.ts).
 */

/** The reference case as a customer would have typed it into the four steps. */
const referenceWizardData: WizardData = {
  pand: {
    address: "Avenida Primado Reig 19, Valencia",
    // The reference property carries no neighbourhood, which the wijk
    // dropdown expresses as "Anders / niet in deze lijst".
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
    // "average" is what deriveRenovationStrategy maps to "light", the
    // reference case's own renovation strategy.
    maintenanceCondition: "average",
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

describe("buildEngineInput - the reference case, end to end through the wizard", () => {
  const assembled = buildEngineInput(referenceWizardData);

  it("reproduces the reference case's property input", () => {
    expect(assembled.property.builtAreaM2).toBe(referenceCase.property.builtAreaM2);
    expect(assembled.property.usableAreaM2).toBe(referenceCase.property.usableAreaM2);
    expect(assembled.property.purchasePrice).toBe(referenceCase.property.purchasePrice);
    expect(assembled.property.ownMoney).toBe(referenceCase.property.ownMoney);
    expect(assembled.property.communityFeesAnnual).toBe(
      referenceCase.property.communityFeesAnnual,
    );
    expect(assembled.property.hasTouristRentalLicense).toBe(true);
    expect(assembled.property.neighborhood).toBeUndefined();
    expect(assembled.property.cadastralValue).toBeUndefined();
  });

  it("reproduces the reference case's constraints", () => {
    expect(assembled.constraints.totalBudget).toBe(referenceCase.constraints.totalBudget);
    expect(assembled.constraints.maxRenovationBudget).toBe(
      referenceCase.constraints.maxRenovationBudget,
    );
    expect(assembled.constraints.minLtv).toBeCloseTo(referenceCase.constraints.minLtv, 12);
    expect(assembled.constraints.maxLtv).toBeCloseTo(referenceCase.constraints.maxLtv, 12);
    expect(assembled.constraints.minRoiTarget).toBeCloseTo(0.04, 12);
    expect(assembled.constraints.minMonthlyCashflow).toBe(
      referenceCase.constraints.minMonthlyCashflow,
    );
    expect(assembled.constraints.maxMonthlyDebt).toBe(referenceCase.constraints.maxMonthlyDebt);
  });

  it("derives the two selections the wizard never asks for", () => {
    // Condition "average" -> light; desired LTV 75% -> the high tier.
    expect(assembled.selections.renovationStrategy).toBe(
      referenceCase.selections.renovationStrategy,
    );
    expect(assembled.selections.financingStrategy).toBe(
      referenceCase.selections.financingStrategy,
    );
  });

  it("still fixes Spanish residency, but now ASKS for tax residency", () => {
    expect(assembled.selections.residency).toBe(FIXED_RESIDENCY);
    // No longer a fixed assumption: step 3 asks, and this fixture answers
    // "netherlands" - the treatment that used to be hard-coded for everyone.
    expect(assembled.selections.taxResidency).toBe("netherlands");
    expect(assembled.selections.residency).toBe(referenceCase.selections.residency);
    // euResident is no longer emitted: taxResidency replaced it as the
    // single answer, and it carries the deduction rule the flag never
    // could. The engine still accepts the old flag from other callers.
    expect(assembled.selections.euResident).toBeUndefined();
  });

  it("carries the exit assumptions the engine has no default for", () => {
    expect(assembled.exitPlanning!.assumptions.sellingCommissionRate).toBeCloseTo(0.04, 12);
    expect(assembled.exitPlanning!.assumptions.municipalCapitalGainsTax).toBe(3_500);
    expect(assembled.exitPlanning!.holdingYears).toBe(10);
  });

  it("produces the known base-scenario score and percentile", () => {
    // The anchor. If a wizard change ever shifts these, the chain has
    // silently altered the model's answer for a case whose figures are
    // independently locked down in outcome.test.ts.
    const result = runEngine(assembled);
    const base = result.scenarioOutcomes!.find((o) => o.scenario === "base")!;
    expect(base.score!.total).toBe(3.8);
    expect(base.percentile).toBe(70);
  });

  it("matches the hand-written reference case scenario for scenario", () => {
    const viaWizard = runEngine(assembled);
    const direct = runEngine(referenceCase);

    for (const scenario of ["conservative", "base", "optimistic"] as const) {
      const a = viaWizard.scenarioOutcomes!.find((o) => o.scenario === scenario)!;
      const b = direct.scenarioOutcomes!.find((o) => o.scenario === scenario)!;
      expect(a.score!.total).toBe(b.score!.total);
      expect(a.percentile).toBe(b.percentile);
      expect(a.irr.defined).toBe(b.irr.defined);
      expect(a.totalReturn).toBeCloseTo(b.totalReturn, 10);
      expect(a.exit.netSaleProceeds).toBeCloseTo(b.exit.netSaleProceeds, 8);
      expect(a.placeholdersUsed.map((p) => p.name)).toEqual(b.placeholdersUsed.map((p) => p.name));
    }
  });

  it("reports no rent reference, since the reference property has no wijk", () => {
    const result = runEngine(assembled);
    expect(result.rentInputProvenance.longTerm!.status).toBe("noReference");
    expect(result.rentInputProvenance.shortTerm!.status).toBe("noReference");
  });
});

describe("buildEngineInput - the derivations respond to what the customer answered", () => {
  function withCondition(condition: string) {
    return buildEngineInput({
      ...referenceWizardData,
      staatEnLasten: { ...referenceWizardData.staatEnLasten, maintenanceCondition: condition },
    }).selections.renovationStrategy;
  }

  it("maps each condition to its renovation tier", () => {
    expect(withCondition("good")).toBe("minimal");
    expect(withCondition("average")).toBe("light");
    expect(withCondition("poor")).toBe("heavy");
  });

  function withLtv(percent: string) {
    return buildEngineInput({
      ...referenceWizardData,
      belegger: { ...referenceWizardData.belegger, preferredLtvPercent: percent },
    }).selections.financingStrategy;
  }

  it("maps the desired LTV to the nearest financing tier", () => {
    expect(withLtv("55")).toBe("low");
    expect(withLtv("68")).toBe("medium");
    expect(withLtv("75")).toBe("high");
  });

  it("converts percentages to the engine's fractions", () => {
    const assembled = buildEngineInput(referenceWizardData);
    expect(assembled.constraints.preferredLtv).toBeCloseTo(0.75, 12);
    expect(assembled.constraints.minLtv).toBeCloseTo(0.6, 12);
  });
});

describe("buildEngineInput - occupancy (datakwaliteitsfix stap 3)", () => {
  it("leaves both occupancy rates undefined when the fields are blank - referenceWizardData's own default", () => {
    const assembled = buildEngineInput(referenceWizardData);
    expect(assembled.selections.occupancyLongTerm).toBeUndefined();
    expect(assembled.selections.occupancyShortTerm).toBeUndefined();
  });

  it("converts a supplied occupancy percentage to the engine's fraction", () => {
    const assembled = buildEngineInput({
      ...referenceWizardData,
      belegger: {
        ...referenceWizardData.belegger,
        occupancyLongTermPercent: "75",
        occupancyShortTermPercent: "50",
      },
    });
    expect(assembled.selections.occupancyLongTerm).toBeCloseTo(0.75, 12);
    expect(assembled.selections.occupancyShortTerm).toBeCloseTo(0.5, 12);
  });
});

describe("buildEngineInput - derramas (datakwaliteitsfix stap 4)", () => {
  it("the unticked path: referenceWizardData's own default leaves the estimate undefined", () => {
    const assembled = buildEngineInput(referenceWizardData);
    expect(assembled.property.upcomingDerramasEstimate).toBeUndefined();
  });

  it("the ticked-but-blank path: checked with no amount yet also stays undefined, not zero", () => {
    const assembled = buildEngineInput({
      ...referenceWizardData,
      staatEnLasten: {
        ...referenceWizardData.staatEnLasten,
        hasUpcomingDerramas: true,
        upcomingDerramasAmount: "",
      },
    });
    expect(assembled.property.upcomingDerramasEstimate).toBeUndefined();
  });

  it("the ticked-with-amount path: passes the parsed amount through", () => {
    const assembled = buildEngineInput({
      ...referenceWizardData,
      staatEnLasten: {
        ...referenceWizardData.staatEnLasten,
        hasUpcomingDerramas: true,
        upcomingDerramasAmount: "5.000",
      },
    });
    expect(assembled.property.upcomingDerramasEstimate).toBe(5000);
  });

  it("an amount typed but the checkbox left unticked is ignored - the checkbox gates whether the amount counts", () => {
    const assembled = buildEngineInput({
      ...referenceWizardData,
      staatEnLasten: {
        ...referenceWizardData.staatEnLasten,
        hasUpcomingDerramas: false,
        upcomingDerramasAmount: "5.000",
      },
    });
    expect(assembled.property.upcomingDerramasEstimate).toBeUndefined();
  });
});

describe("buildEngineInput - the permit gate survives assembly", () => {
  it("passes the licence answer through as a boolean", () => {
    const withoutLicence = buildEngineInput({
      ...referenceWizardData,
      staatEnLasten: { ...referenceWizardData.staatEnLasten, hasTouristRentalLicense: "no" },
      belegger: { ...referenceWizardData.belegger, rentalStrategy: "longTerm" },
    });
    expect(withoutLicence.property.hasTouristRentalLicense).toBe(false);
  });

  it("an unanswered licence question is not a licence", () => {
    const unanswered = buildEngineInput({
      ...referenceWizardData,
      staatEnLasten: { ...referenceWizardData.staatEnLasten, hasTouristRentalLicense: "" },
      belegger: { ...referenceWizardData.belegger, rentalStrategy: "longTerm" },
    });
    expect(unanswered.property.hasTouristRentalLicense).toBe(false);
  });

  it("the engine still refuses short-term without a licence, even if assembly were bypassed", () => {
    // Step 3 does not offer the combination, so this can only arise from
    // hand-written data - and validateEngineInput is the backstop.
    const contradictory = buildEngineInput({
      ...referenceWizardData,
      staatEnLasten: { ...referenceWizardData.staatEnLasten, hasTouristRentalLicense: "no" },
      belegger: { ...referenceWizardData.belegger, rentalStrategy: "shortTerm" },
    });
    expect(() => runEngine(contradictory)).toThrow(/t[ií]tulo habilitante/);
  });
});

describe("buildEngineInput - the unused short-term rate", () => {
  it("is filled with a placeholder the calculation never reads, for a long-term deal", () => {
    const longTermOnly = buildEngineInput({
      ...referenceWizardData,
      staatEnLasten: { ...referenceWizardData.staatEnLasten, hasTouristRentalLicense: "no" },
      belegger: {
        ...referenceWizardData.belegger,
        rentalStrategy: "longTerm",
        rentPerM2ShortTerm: "",
      },
    });
    // validateEngineInput requires a positive rate for both, but only the
    // selected strategy's figure reaches the outcome.
    expect(longTermOnly.selections.rentPerM2ShortTerm).toBe(1);
    const result = runEngine(longTermOnly);
    expect(result.rentInputProvenance.shortTerm).toBeNull();
  });
});

describe("buildEngineInput - unparseable data is a bug, not user error", () => {
  it("throws with the offending field named", () => {
    expect(() =>
      buildEngineInput({
        ...referenceWizardData,
        pand: { ...referenceWizardData.pand, purchasePrice: "" },
      }),
    ).toThrow(WizardAssemblyError);
    expect(() =>
      buildEngineInput({
        ...referenceWizardData,
        pand: { ...referenceWizardData.pand, purchasePrice: "abc" },
      }),
    ).toThrow(/purchasePrice/);
  });
});
