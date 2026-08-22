import { describe, expect, it } from "vitest";
import {
  FREE_TIER_DISCLOSURE_COPY_NL,
  translateFreeTierDisclosure,
  translateFreeTierDisclosures,
} from "../../../copy/es/free-tier-disclosures";
import { runEngine } from "../engine";
import { annualAnnuityDebtService } from "../financing";
import { FREE_TIER_DISCLOSURE_KEYS, computeFreeTierBand } from "../free-tier/band";
import {
  BASE_OCCUPANCY_LONG_TERM,
  DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO,
  DEFAULT_USABLE_TO_BUILT_AREA_RATIO,
  FINANCING_STRATEGIES,
  FREE_TIER_BAND_COMMUNITY_FEES_FAVOURABLE,
  FREE_TIER_BAND_COMMUNITY_FEES_UNFAVOURABLE,
  FREE_TIER_BAND_RENOVATION_TIER_FAVOURABLE,
  FREE_TIER_BAND_RENOVATION_TIER_UNFAVOURABLE,
  FREE_TIER_BAND_RENT_MARGIN,
  NEIGHBORHOOD_RENT_LONG_TERM,
  NON_RESIDENT_INTEREST_SPREAD,
  RENOVATION_STRATEGIES,
  RENOVATION_TIER_BY_MAINTENANCE_CONDITION,
  SCENARIOS,
  TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE,
} from "../parameters";
import { ALL_FREE_TIER_DISCLOSURE_KEYS } from "../types";
import type { MaintenanceCondition, RenovationStrategyId } from "../types";

/**
 * Fase A stap 3's fixed financing assumption, recomputed here from the
 * same public constants band.ts itself reuses (FINANCING_STRATEGIES.medium
 * + NON_RESIDENT_INTEREST_SPREAD) - not re-declared as a private literal,
 * so this file's own expected debt-service figures cannot silently drift
 * from band.ts's if either constant ever changes.
 */
const FREE_TIER_EFFECTIVE_RATE =
  FINANCING_STRATEGIES.medium.interestRate.value + NON_RESIDENT_INTEREST_SPREAD.value;
const FREE_TIER_LOAN_TERM_YEARS = FINANCING_STRATEGIES.medium.loanTermYears.value;
const FREE_TIER_LTV = FINANCING_STRATEGIES.medium.ltv.value;

function expectedDebtService(purchasePrice: number): number {
  return annualAnnuityDebtService(
    FREE_TIER_EFFECTIVE_RATE,
    FREE_TIER_LOAN_TERM_YEARS,
    purchasePrice * FREE_TIER_LTV,
  );
}

/**
 * Golden values: independent recomputation in Python, written from the
 * agreed design rather than from band.ts, with every parameter value
 * transcribed by hand from parameters.ts (same method as
 * MODEL_SPEC_FASE1B §8 - there is no Excel counterpart for the free
 * indication, which does not exist in the workbook at all).
 *
 * Three cases deliberately spanning the model's range: a mid-priced
 * central flat, a cheap coastal one whose unfavourable end is negative,
 * and an expensive one in the most expensive wijk.
 */

describe("free indication band - golden values (Ruzafa, € 350.000, 90 m²)", () => {
  const band = computeFreeTierBand({
    neighborhood: "Ruzafa",
    purchasePrice: 350_000,
    builtAreaM2: 90,
  });

  it("reads the wijk's long-term reference rent unchanged", () => {
    expect(band.referenceRentPerM2).toBe(17.0);
  });

  it("computes the unfavourable end line by line, financing included (fase A stap 3)", () => {
    const e = band.unfavourable;
    expect(e.rentPerM2).toBeCloseTo(15.64, 10);
    expect(e.usableAreaM2).toBeCloseTo(76.5, 10);
    expect(e.grossAnnualRent).toBeCloseTo(12_275.6796, 6);
    expect(e.propertyManagement).toBeCloseTo(982.054368, 6);
    expect(e.maintenance).toBeCloseTo(736.540776, 6);
    expect(e.utilities).toBeCloseTo(2_031.75, 6);
    expect(e.propertyTaxIBI).toBeCloseTo(1_400, 6);
    expect(e.fixedCosts).toBeCloseTo(4_330, 6);
    // Financing: mortgage = 350.000 x 70% = 245.000, amortising annuity at
    // 3,85% (2,85% + 1,0% niet-ingezetenen-opslag) over 20 jaar - see the
    // dedicated "fase A stap 3: financing" describe block below for the
    // fully worked, hand-recomputable version of this figure.
    expect(e.mortgageAmount).toBeCloseTo(245_000, 6);
    expect(e.annualDebtService).toBeCloseTo(17_584.304094, 5);
    // Was 4_195.334456 before fase A stap 3; 4_195.334456 - 17_584.304094 = -13_388.969638.
    expect(e.annualCashflow).toBeCloseTo(-13_388.969638, 5);
    expect(e.monthlyCashflow).toBeCloseTo(-1_115.747470, 5);
  });

  it("computes the favourable end line by line, financing included (fase A stap 3)", () => {
    const e = band.favourable;
    expect(e.rentPerM2).toBeCloseTo(18.36, 10);
    expect(e.usableAreaM2).toBeCloseTo(76.5, 10);
    expect(e.grossAnnualRent).toBeCloseTo(16_685.9352, 6);
    expect(e.propertyManagement).toBeCloseTo(1_334.874816, 6);
    expect(e.maintenance).toBeCloseTo(709.152246, 6);
    expect(e.utilities).toBeCloseTo(1_741.5, 6);
    expect(e.propertyTaxIBI).toBeCloseTo(1_400, 6);
    expect(e.fixedCosts).toBeCloseTo(2_930, 6);
    // Same mortgage/debt service as the unfavourable end: financing does
    // not vary by end (this fix's own design - "altijd vast, geen
    // band-driver"), only purchasePrice drives it, and that is shared.
    expect(e.mortgageAmount).toBeCloseTo(245_000, 6);
    expect(e.annualDebtService).toBeCloseTo(17_584.304094, 5);
    // Was 9_970.408138 before fase A stap 3; 9_970.408138 - 17_584.304094 = -7_613.895956.
    expect(e.annualCashflow).toBeCloseTo(-7_613.895956, 5);
    expect(e.monthlyCashflow).toBeCloseTo(-634.491330, 5);
  });

  it("reports the band as the two monthly figures, financing included", () => {
    expect(band.monthlyCashflow.low).toBeCloseTo(-1_115.747470, 5);
    expect(band.monthlyCashflow.high).toBeCloseTo(-634.491330, 5);
  });
});

describe("free indication band - golden values (other ends of the range)", () => {
  it("Oliva, € 150.000, 70 m² - both ends are negative once financing is included (fase A stap 3)", () => {
    const band = computeFreeTierBand({
      neighborhood: "Oliva",
      purchasePrice: 150_000,
      builtAreaM2: 70,
    });
    expect(band.unfavourable.grossAnnualRent).toBeCloseTo(5_167.01808, 6);
    // Mortgage 150.000 x 70% = 105.000; before financing these were
    // -666.614451 (unfavourable) and 2_678.499242 (favourable).
    expect(band.unfavourable.mortgageAmount).toBeCloseTo(105_000, 6);
    expect(band.unfavourable.annualDebtService).toBeCloseTo(7_536.130326, 5);
    expect(band.unfavourable.annualCashflow).toBeCloseTo(-8_202.744777, 5);
    expect(band.unfavourable.monthlyCashflow).toBeCloseTo(-683.562065, 5);
    expect(band.favourable.annualCashflow).toBeCloseTo(-4_857.631084, 5);
    expect(band.favourable.monthlyCashflow).toBeCloseTo(-404.802590, 5);
  });

  it("El Carmen, € 600.000, 120 m²", () => {
    const band = computeFreeTierBand({
      neighborhood: "El Carmen (Ciutat Vella)",
      purchasePrice: 600_000,
      builtAreaM2: 120,
    });
    expect(band.unfavourable.grossAnnualRent).toBeCloseTo(22_144.3632, 6);
    // Mortgage 600.000 x 70% = 420.000; before financing these were
    // 917.096029/month (unfavourable) and 1_680.071158/month (favourable).
    expect(band.unfavourable.mortgageAmount).toBeCloseTo(420_000, 6);
    expect(band.unfavourable.annualDebtService).toBeCloseTo(30_144.521305, 5);
    expect(band.unfavourable.monthlyCashflow).toBeCloseTo(-1_594.947413, 5);
    expect(band.favourable.grossAnnualRent).toBeCloseTo(30_100.1184, 6);
    expect(band.favourable.monthlyCashflow).toBeCloseTo(-831.972284, 5);
  });
});

/**
 * Fase A stap 3: a standalone, hand-verifiable worked example of the
 * financing this step added, isolated from the golden-value assertions
 * above so it can be checked with nothing but a calculator - the
 * "handmatig narekenbaar voorbeeld" the task's own instruction asked for.
 *
 * Vraagprijs € 350.000, LTV 70% (FINANCING_STRATEGIES.medium), 20 jaar,
 * 3,85% effectieve rente (2,85% + 1,0% niet-ingezetenen-opslag,
 * NON_RESIDENT_INTEREST_SPREAD):
 *
 *   hypotheekbedrag = 350.000 x 0,70            = 245.000
 *   maandrente r    = 0,0385 / 12                = 0,0032083...
 *   n               = 20 x 12                    = 240 termijnen
 *   maandtermijn    = (245.000 x r) / (1-(1+r)^-n) ≈ 1.465,358674...
 *   jaarlast        = maandtermijn x 12          ≈ 17.584,304094
 *
 * That jaarlast is annualAnnuityDebtService(0.0385, 20, 245_000) - the
 * same function scenarios.ts already uses for the paid engine's own debt
 * service, so this is the fixed assumption applied through the existing
 * primitive, not a reimplementation of the annuity formula.
 */
describe("free indication band - financing worked example (fase A stap 3)", () => {
  it("hand-verifiable: vraagprijs -> hypotheekbedrag -> jaarlast -> cashflow", () => {
    const mortgageAmount = 350_000 * FREE_TIER_LTV;
    expect(mortgageAmount).toBeCloseTo(245_000, 6);

    const monthlyRate = FREE_TIER_EFFECTIVE_RATE / 12;
    const n = FREE_TIER_LOAN_TERM_YEARS * 12;
    const monthlyPayment = (mortgageAmount * monthlyRate) / (1 - (1 + monthlyRate) ** -n);
    expect(monthlyPayment * 12).toBeCloseTo(17_584.304094, 5);

    // The same figure via the shared primitive band.ts itself calls.
    expect(expectedDebtService(350_000)).toBeCloseTo(17_584.304094, 5);

    const band = computeFreeTierBand({ neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 });
    expect(band.unfavourable.mortgageAmount).toBe(mortgageAmount);
    expect(band.unfavourable.annualDebtService).toBeCloseTo(17_584.304094, 5);
    // Cashflow before financing was € 4.195,334456/jaar at this end (see
    // the golden-values describe block above); after it, the debt service
    // is subtracted straight through.
    expect(band.unfavourable.annualCashflow).toBeCloseTo(4_195.334456 - 17_584.304094, 5);
  });

  it("the assumption is fixed, not a band driver: identical mortgage and debt service at both ends, for any input", () => {
    for (const input of [
      { neighborhood: "Oliva", purchasePrice: 150_000, builtAreaM2: 70 },
      { neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 },
      { neighborhood: "El Carmen (Ciutat Vella)", purchasePrice: 600_000, builtAreaM2: 120 },
    ]) {
      const band = computeFreeTierBand(input);
      expect(band.unfavourable.mortgageAmount).toBe(band.favourable.mortgageAmount);
      expect(band.unfavourable.annualDebtService).toBeCloseTo(band.favourable.annualDebtService, 10);
      expect(band.unfavourable.mortgageAmount).toBeCloseTo(input.purchasePrice * FREE_TIER_LTV, 6);
      expect(band.unfavourable.annualDebtService).toBeCloseTo(expectedDebtService(input.purchasePrice), 5);
    }
  });

  it("the financing disclosure key is present, unchanged, in both the band view and the point-estimate view", () => {
    const base = { neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 } as const;

    const unnarrowed = computeFreeTierBand(base);
    expect(unnarrowed.pointEstimate).toBe(false);
    expect(unnarrowed.disclosures).toContain("financing");

    const point = computeFreeTierBand({
      ...base,
      communityFeesAnnual: 1_200,
      maintenanceCondition: "poor",
      rentLevel: "above",
    });
    expect(point.pointEstimate).toBe(true);
    expect(point.disclosures).toContain("financing");

    // Not just present in both - the mortgage/debt service themselves are
    // identical too, because narrowing the other three axes never touches
    // this one (it has no favourable/unfavourable split to narrow).
    expect(point.unfavourable.mortgageAmount).toBe(unnarrowed.unfavourable.mortgageAmount);
    expect(point.unfavourable.annualDebtService).toBeCloseTo(
      unnarrowed.unfavourable.annualDebtService,
      10,
    );
  });
});

describe("free indication band - what spans the band", () => {
  const input = { neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 };
  const band = computeFreeTierBand(input);

  it("puts the rent margin symmetrically around the wijk average", () => {
    const margin = FREE_TIER_BAND_RENT_MARGIN.value;
    expect(band.unfavourable.rentPerM2).toBeCloseTo(band.referenceRentPerM2 * (1 - margin), 10);
    expect(band.favourable.rentPerM2).toBeCloseTo(band.referenceRentPerM2 * (1 + margin), 10);
    // Symmetric by construction: the two ends are equidistant from the average.
    const below = band.referenceRentPerM2 - band.unfavourable.rentPerM2;
    const above = band.favourable.rentPerM2 - band.referenceRentPerM2;
    expect(below).toBeCloseTo(above, 10);
  });

  it("takes the community fees from the existing documented range, not a new figure", () => {
    expect(band.unfavourable.communityFees).toBe(
      TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE.value.max,
    );
    expect(band.favourable.communityFees).toBe(
      TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE.value.min,
    );
  });

  it("uses the outermost renovation tiers the model already defines", () => {
    expect(band.unfavourable.renovationStrategy).toBe("minimal");
    expect(band.favourable.renovationStrategy).toBe("heavy");
  });

  it("holds the three non-drivers at a single value in both ends", () => {
    // Usable area: same ratio on both sides, so the area never moves the band.
    expect(band.unfavourable.usableAreaM2).toBe(band.favourable.usableAreaM2);
    expect(band.unfavourable.usableAreaM2).toBeCloseTo(
      90 * DEFAULT_USABLE_TO_BUILT_AREA_RATIO.value,
      10,
    );
    // Cadastral ratio: identical IBI at both ends.
    expect(band.unfavourable.propertyTaxIBI).toBe(band.favourable.propertyTaxIBI);
    // Occupancy: recomputing either end with the other's occupancy would
    // change it, so pin that it is the single long-term parameter.
    expect(BASE_OCCUPANCY_LONG_TERM.value).toBe(0.9);
  });

  it("orders the band low to high", () => {
    expect(band.monthlyCashflow.low).toBeLessThan(
      band.monthlyCashflow.high,
    );
  });
});

describe("free indication band - provenance (CLAUDE.md §6)", () => {
  const band = computeFreeTierBand({
    neighborhood: "Ruzafa",
    purchasePrice: 350_000,
    builtAreaM2: 90,
  });

  it("every listed placeholder really is a PLACEHOLDER", () => {
    for (const p of band.placeholdersUsed) {
      expect(p.provenance).toBe("PLACEHOLDER");
    }
  });

  it("names the rent margin, both area/cadastral fallbacks, occupancy, maintenance and bank fee", () => {
    const names = band.placeholdersUsed.map((p) => p.name);
    expect(names).toContain("FREE_TIER_BAND_RENT_MARGIN");
    expect(names).toContain("DEFAULT_USABLE_TO_BUILT_AREA_RATIO");
    expect(names).toContain("DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO");
    expect(names).toContain("BASE_OCCUPANCY_LONG_TERM");
    expect(names).toContain("MAINTENANCE_RATE");
    expect(names).toContain("BANK_FEE");
  });

  it("carries both ends' renovation multipliers, since both ends produced a number", () => {
    const names = band.placeholdersUsed.map((p) => p.name);
    for (const tier of ["minimal", "heavy"] as const) {
      expect(names).toContain(`RENOVATION_STRATEGIES.${tier}.rentMultiplier`);
      expect(names).toContain(`RENOVATION_STRATEGIES.${tier}.maintenanceFactor`);
      expect(names).toContain(`RENOVATION_STRATEGIES.${tier}.utilitiesEfficiency`);
    }
  });

  it("does not claim to depend on capex or lease-up time, which never enter this figure", () => {
    const names = band.placeholdersUsed.map((p) => p.name);
    expect(names).not.toContain("RENOVATION_STRATEGIES.minimal.capex");
    expect(names).not.toContain("RENOVATION_STRATEGIES.heavy.capex");
    expect(names).not.toContain("RENOVATION_STRATEGIES.minimal.timeToRentMonths");
    expect(names).not.toContain("RENOVATION_STRATEGIES.heavy.timeToRentMonths");
  });

  it("de-duplicates the union without dropping either end's own list", () => {
    const names = band.placeholdersUsed.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const end of [band.unfavourable, band.favourable]) {
      for (const p of end.placeholdersUsed) {
        expect(names).toContain(p.name);
      }
    }
  });

  it("labels the two community-fee ends by derivation, not by hand", () => {
    // deriveParameter takes the weakest label among its components, so if
    // TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE is ever downgraded these
    // follow automatically instead of keeping a stale ESTIMATE.
    expect(FREE_TIER_BAND_COMMUNITY_FEES_UNFAVOURABLE.provenance).toBe(
      TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE.provenance,
    );
    expect(FREE_TIER_BAND_COMMUNITY_FEES_FAVOURABLE.provenance).toBe(
      TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE.provenance,
    );
  });

  it("labels the rent margin PLACEHOLDER, not ESTIMATE", () => {
    // It is a claim about real rent dispersion with no source; the
    // reality-claim test in types.ts permits only SOURCED or PLACEHOLDER.
    expect(FREE_TIER_BAND_RENT_MARGIN.provenance).toBe("PLACEHOLDER");
  });

  it("labels the two tier selections ESTIMATE, since only the selection rule is a model choice", () => {
    expect(FREE_TIER_BAND_RENOVATION_TIER_UNFAVOURABLE.provenance).toBe("ESTIMATE");
    expect(FREE_TIER_BAND_RENOVATION_TIER_FAVOURABLE.provenance).toBe("ESTIMATE");
    // ... and the multipliers they select stay PLACEHOLDER, so the
    // ESTIMATE label above cannot launder them.
    for (const tier of [
      FREE_TIER_BAND_RENOVATION_TIER_UNFAVOURABLE.value,
      FREE_TIER_BAND_RENOVATION_TIER_FAVOURABLE.value,
    ]) {
      expect(RENOVATION_STRATEGIES[tier].rentMultiplier.provenance).toBe("PLACEHOLDER");
      expect(RENOVATION_STRATEGIES[tier].maintenanceFactor.provenance).toBe("PLACEHOLDER");
      expect(RENOVATION_STRATEGIES[tier].utilitiesEfficiency.provenance).toBe("PLACEHOLDER");
    }
  });
});

describe("free indication band - disclosures are keys, not text (CLAUDE.md §6)", () => {
  const band = computeFreeTierBand({
    neighborhood: "Ruzafa",
    purchasePrice: 350_000,
    builtAreaM2: 90,
  });

  it("attaches exactly the four known keys, in order", () => {
    expect(band.disclosures).toBe(FREE_TIER_DISCLOSURE_KEYS);
    expect(band.disclosures).toEqual(["band", "shortTermLicence", "financing", "unverified"]);
  });

  it("carries no Dutch text in the calculation layer's result", () => {
    // The whole point of moving to keys: nothing on FreeTierBand or its
    // disclosures should ever be a rendered sentence.
    for (const key of band.disclosures) {
      expect(key).not.toMatch(/[a-z] [a-z]/); // no key contains a space-separated phrase
      expect(key.length).toBeLessThan(20);
    }
  });
});

/**
 * Fase A stap 1: three optional FreeTierBandInput fields, each replacing
 * exactly one of the band's three width drivers at both ends when given.
 * Golden values recomputed independently the same way the module's own
 * top-of-file golden test is (hand-transcribed parameters.ts constants),
 * for the same Ruzafa/€350.000/90m² case so the un-narrowed figures above
 * are directly comparable.
 */
describe("free indication band - narrowing via customer input (fase A stap 1)", () => {
  const base = { neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 } as const;
  const unnarrowed = computeFreeTierBand(base);

  describe("communityFeesAnnual", () => {
    it("replaces FREE_TIER_BAND_COMMUNITY_FEES_{UN,}FAVOURABLE with the customer's own figure at both ends", () => {
      const band = computeFreeTierBand({ ...base, communityFeesAnnual: 1_200 });
      expect(band.unfavourable.communityFees).toBe(1_200);
      expect(band.favourable.communityFees).toBe(1_200);
      // The placeholder pair it replaced never appeared in placeholdersUsed
      // in the first place (band.ts's own collectPlaceholders() never
      // listed either), so nothing here should change either.
      const names = band.placeholdersUsed.map((p) => p.name);
      expect(names).not.toContain("FREE_TIER_BAND_COMMUNITY_FEES_UNFAVOURABLE");
      expect(names).not.toContain("FREE_TIER_BAND_COMMUNITY_FEES_FAVOURABLE");
    });

    it("narrows the band width relative to the unfilled default", () => {
      const band = computeFreeTierBand({
        ...base,
        communityFeesAnnual:
          (FREE_TIER_BAND_COMMUNITY_FEES_FAVOURABLE.value +
            FREE_TIER_BAND_COMMUNITY_FEES_UNFAVOURABLE.value) /
          2,
      });
      const unnarrowedWidth =
        unnarrowed.monthlyCashflow.high - unnarrowed.monthlyCashflow.low;
      const narrowedWidth =
        band.monthlyCashflow.high - band.monthlyCashflow.low;
      expect(narrowedWidth).toBeLessThan(unnarrowedWidth);
    });

    it("does not affect the other two axes - renovation tier and rent margin still split as before", () => {
      const band = computeFreeTierBand({ ...base, communityFeesAnnual: 1_200 });
      expect(band.unfavourable.renovationStrategy).toBe(
        FREE_TIER_BAND_RENOVATION_TIER_UNFAVOURABLE.value,
      );
      expect(band.favourable.renovationStrategy).toBe(
        FREE_TIER_BAND_RENOVATION_TIER_FAVOURABLE.value,
      );
      expect(band.unfavourable.rentPerM2).toBeCloseTo(unnarrowed.unfavourable.rentPerM2, 10);
      expect(band.favourable.rentPerM2).toBeCloseTo(unnarrowed.favourable.rentPerM2, 10);
    });
  });

  describe("maintenanceCondition", () => {
    it("resolves via the same RENOVATION_TIER_BY_MAINTENANCE_CONDITION mapping the paid wizard uses, at both ends", () => {
      for (const [condition, tier] of Object.entries(RENOVATION_TIER_BY_MAINTENANCE_CONDITION.value) as [
        MaintenanceCondition,
        RenovationStrategyId,
      ][]) {
        const band = computeFreeTierBand({ ...base, maintenanceCondition: condition });
        expect(band.unfavourable.renovationStrategy).toBe(tier);
        expect(band.favourable.renovationStrategy).toBe(tier);
      }
    });

    it("does not affect the other two axes - community fees and rent margin still split as before", () => {
      const band = computeFreeTierBand({ ...base, maintenanceCondition: "poor" });
      expect(band.unfavourable.communityFees).toBe(FREE_TIER_BAND_COMMUNITY_FEES_UNFAVOURABLE.value);
      expect(band.favourable.communityFees).toBe(FREE_TIER_BAND_COMMUNITY_FEES_FAVOURABLE.value);
      expect(band.unfavourable.rentPerM2).toBeCloseTo(unnarrowed.unfavourable.rentPerM2, 10);
      expect(band.favourable.rentPerM2).toBeCloseTo(unnarrowed.favourable.rentPerM2, 10);
    });
  });

  describe("rentLevel", () => {
    it("'below' collapses both ends to the same -8% direction", () => {
      const band = computeFreeTierBand({ ...base, rentLevel: "below" });
      const expected = band.referenceRentPerM2 * (1 - FREE_TIER_BAND_RENT_MARGIN.value);
      expect(band.unfavourable.rentPerM2).toBeCloseTo(expected, 10);
      expect(band.favourable.rentPerM2).toBeCloseTo(expected, 10);
    });

    it("'above' collapses both ends to the same +8% direction", () => {
      const band = computeFreeTierBand({ ...base, rentLevel: "above" });
      const expected = band.referenceRentPerM2 * (1 + FREE_TIER_BAND_RENT_MARGIN.value);
      expect(band.unfavourable.rentPerM2).toBeCloseTo(expected, 10);
      expect(band.favourable.rentPerM2).toBeCloseTo(expected, 10);
    });

    it("'average' drops the margin to exactly 0 at both ends and excludes FREE_TIER_BAND_RENT_MARGIN from placeholdersUsed", () => {
      const band = computeFreeTierBand({ ...base, rentLevel: "average" });
      expect(band.unfavourable.rentPerM2).toBe(band.referenceRentPerM2);
      expect(band.favourable.rentPerM2).toBe(band.referenceRentPerM2);
      expect(band.placeholdersUsed.map((p) => p.name)).not.toContain("FREE_TIER_BAND_RENT_MARGIN");
    });

    it("FREE_TIER_BAND_RENT_MARGIN stays in placeholdersUsed for 'below'/'above' - the margin's own value still drives the figure", () => {
      for (const rentLevel of ["below", "above"] as const) {
        const band = computeFreeTierBand({ ...base, rentLevel });
        expect(band.placeholdersUsed.map((p) => p.name)).toContain("FREE_TIER_BAND_RENT_MARGIN");
      }
    });

    it("does not affect the other two axes - community fees and renovation tier still split as before", () => {
      const band = computeFreeTierBand({ ...base, rentLevel: "average" });
      expect(band.unfavourable.communityFees).toBe(FREE_TIER_BAND_COMMUNITY_FEES_UNFAVOURABLE.value);
      expect(band.favourable.communityFees).toBe(FREE_TIER_BAND_COMMUNITY_FEES_FAVOURABLE.value);
      expect(band.unfavourable.renovationStrategy).toBe(
        FREE_TIER_BAND_RENOVATION_TIER_UNFAVOURABLE.value,
      );
      expect(band.favourable.renovationStrategy).toBe(
        FREE_TIER_BAND_RENOVATION_TIER_FAVOURABLE.value,
      );
    });
  });

  describe("narrowedByCustomerInput disclosure", () => {
    it("is absent, and disclosures stays the exact same array reference, when nothing is narrowed", () => {
      expect(unnarrowed.disclosures).toBe(FREE_TIER_DISCLOSURE_KEYS);
      expect(unnarrowed.disclosures).not.toContain("narrowedByCustomerInput");
    });

    it("appears the moment any one of the three fields is given, alongside the four unconditional keys", () => {
      for (const input of [
        { ...base, communityFeesAnnual: 1_200 },
        { ...base, maintenanceCondition: "average" as const },
        { ...base, rentLevel: "average" as const },
      ]) {
        const band = computeFreeTierBand(input);
        expect(band.disclosures).toContain("narrowedByCustomerInput");
        for (const key of FREE_TIER_DISCLOSURE_KEYS) {
          expect(band.disclosures).toContain(key);
        }
      }
    });
  });

  /**
   * Fase A stap 2: the point-estimate collapse, and its disclosure
   * swap, across all eight 0/1/2/3-given combinations of the three
   * optional fields - the exhaustive matrix this task's own instruction
   * asked for.
   */
  describe("point estimate collapse (fase A stap 2) - all eight combinations", () => {
    const NARROWING_FIELDS = {
      communityFeesAnnual: 1_200,
      maintenanceCondition: "poor" as const,
      rentLevel: "above" as const,
    };

    function inputWith(keys: (keyof typeof NARROWING_FIELDS)[]) {
      const extra: Partial<typeof NARROWING_FIELDS> = {};
      for (const key of keys) {
        (extra as Record<string, unknown>)[key] = NARROWING_FIELDS[key];
      }
      return { ...base, ...extra };
    }

    const COMBINATIONS: {
      name: string;
      keys: (keyof typeof NARROWING_FIELDS)[];
      expectedGivenCount: 0 | 1 | 2 | 3;
    }[] = [
      { name: "0 given", keys: [], expectedGivenCount: 0 },
      { name: "1 given (communityFeesAnnual)", keys: ["communityFeesAnnual"], expectedGivenCount: 1 },
      { name: "1 given (maintenanceCondition)", keys: ["maintenanceCondition"], expectedGivenCount: 1 },
      { name: "1 given (rentLevel)", keys: ["rentLevel"], expectedGivenCount: 1 },
      {
        name: "2 given (communityFeesAnnual + maintenanceCondition)",
        keys: ["communityFeesAnnual", "maintenanceCondition"],
        expectedGivenCount: 2,
      },
      {
        name: "2 given (communityFeesAnnual + rentLevel)",
        keys: ["communityFeesAnnual", "rentLevel"],
        expectedGivenCount: 2,
      },
      {
        name: "2 given (maintenanceCondition + rentLevel)",
        keys: ["maintenanceCondition", "rentLevel"],
        expectedGivenCount: 2,
      },
      {
        name: "3 given (all)",
        keys: ["communityFeesAnnual", "maintenanceCondition", "rentLevel"],
        expectedGivenCount: 3,
      },
    ];

    for (const combo of COMBINATIONS) {
      it(`${combo.name}: pointEstimate is ${combo.expectedGivenCount === 3}, low===high is ${combo.expectedGivenCount === 3}, and the right disclosure key applies`, () => {
        const band = computeFreeTierBand(inputWith(combo.keys));
        const isPoint = combo.expectedGivenCount === 3;

        expect(band.pointEstimate).toBe(isPoint);
        expect(
          band.monthlyCashflow.low === band.monthlyCashflow.high,
        ).toBe(isPoint);

        if (isPoint) {
          expect(band.disclosures).toContain("pointEstimateFromCustomerInput");
          expect(band.disclosures).not.toContain("narrowedByCustomerInput");
          expect(band.disclosures).not.toContain("band");
        } else if (combo.expectedGivenCount > 0) {
          expect(band.disclosures).toContain("narrowedByCustomerInput");
          expect(band.disclosures).not.toContain("pointEstimateFromCustomerInput");
          expect(band.disclosures).toContain("band");
        } else {
          expect(band.disclosures).not.toContain("narrowedByCustomerInput");
          expect(band.disclosures).not.toContain("pointEstimateFromCustomerInput");
          expect(band.disclosures).toContain("band");
        }

        // shortTermLicence/financing/unverified are never affected by
        // narrowing - they describe things this fix does not touch.
        expect(band.disclosures).toContain("shortTermLicence");
        expect(band.disclosures).toContain("financing");
        expect(band.disclosures).toContain("unverified");
      });
    }

    it("the score's own midpoint calculation needs no special-casing: at the point, midpoint equals the point itself", () => {
      const band = computeFreeTierBand(inputWith(["communityFeesAnnual", "maintenanceCondition", "rentLevel"]));
      const midpoint =
        (band.monthlyCashflow.low + band.monthlyCashflow.high) / 2;
      expect(midpoint).toBe(band.monthlyCashflow.low);
    });
  });
});

describe("free indication band - Dutch copy (lib/copy/es/free-tier-disclosures.ts)", () => {
  it("translates every key FREE_TIER_DISCLOSURE_KEYS emits", () => {
    const translated = translateFreeTierDisclosures(FREE_TIER_DISCLOSURE_KEYS);
    expect(translated).toHaveLength(FREE_TIER_DISCLOSURE_KEYS.length);
    for (const line of translated) {
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it("has exactly one Record entry per FreeTierDisclosureKey - none missing, none stray", () => {
    // TypeScript's Record<FreeTierDisclosureKey, string> already enforces
    // this at compile time (a missing or extra key fails to compile); this
    // is the runtime mirror so the guarantee shows up in the test suite too.
    // Checked against the full union, not just the band's own four
    // unconditional keys: narrowedByCustomerInput (conditional, this same
    // module) and indicativeScoreScope (indicative-score.ts) both still
    // have to be translatable.
    expect(Object.keys(FREE_TIER_DISCLOSURE_COPY_NL).sort()).toEqual(
      [...ALL_FREE_TIER_DISCLOSURE_KEYS].sort(),
    );
  });

  it("the band emits a strict subset of the union - it does not claim the score's key", () => {
    for (const key of FREE_TIER_DISCLOSURE_KEYS) {
      expect(ALL_FREE_TIER_DISCLOSURE_KEYS).toContain(key);
    }
    expect(FREE_TIER_DISCLOSURE_KEYS).not.toContain("indicativeScoreScope");
  });

  it("says the band is not a probability interval", () => {
    // The one framing CLAUDE.md §1 makes non-negotiable: the report does
    // not forecast. Pinning the substance, not the wording.
    const text = translateFreeTierDisclosure("band");
    expect(text).toContain("niet de kans dat het zo uitpakt");
    expect(text).toContain("dichter bij het midden");
  });

  it("says short-term rental needs a permit and is not in the figure", () => {
    const text = translateFreeTierDisclosure("shortTermLicence");
    expect(text).toContain("título habilitante");
    expect(text).toContain("niet in dit bedrag verwerkt");
  });

  it("says the figure is after financing, and names the fixed assumption's LTV/looptijd/rente explicitly (fase A stap 3)", () => {
    const text = translateFreeTierDisclosure("financing");
    expect(text).toContain("ná financiering");
    expect(text).toContain("70%");
    expect(text).toContain("20 jaar");
    expect(text).toContain("3,85%");
  });

  it("names the three assumptions held fixed for lack of a documented range", () => {
    const text = translateFreeTierDisclosure("unverified");
    expect(text).toContain("bruikbaar oppervlak");
    expect(text).toContain("kadastrale waarde");
    expect(text).toContain("bezettingsgraad");
  });

  it("throws rather than silently returning empty text for an unknown key", () => {
    expect(() =>
      translateFreeTierDisclosure("nonexistent" as unknown as never),
    ).toThrow(/Missing Dutch copy/);
  });
});

describe("free indication band - the permit gate is not a band dimension", () => {
  it("computes long-term rental only, at both ends", () => {
    const band = computeFreeTierBand({
      neighborhood: "Ruzafa",
      purchasePrice: 350_000,
      builtAreaM2: 90,
    });
    // Long-term occupancy at both ends, and no short-term occupancy
    // anywhere in the provenance trail: if either end had computed a
    // short-term or hybrid income, BASE_OCCUPANCY_SHORT_TERM would appear.
    const names = band.placeholdersUsed.map((p) => p.name);
    expect(names).toContain("BASE_OCCUPANCY_LONG_TERM");
    expect(names).not.toContain("BASE_OCCUPANCY_SHORT_TERM");
    // The gross rent at each end is the long-term reference rent's own
    // arithmetic, with no short-term blend mixed in.
    const e = band.unfavourable;
    expect(e.grossAnnualRent).toBeCloseTo(
      e.rentPerM2 *
        e.usableAreaM2 *
        12 *
        BASE_OCCUPANCY_LONG_TERM.value *
        RENOVATION_STRATEGIES.minimal.rentMultiplier.value,
      6,
    );
  });
});

describe("free indication band - drift against the main engine", () => {
  it("stays valid only while the base scenario's multipliers are all 1.0", () => {
    // This module computes the base scenario's cost structure without
    // re-multiplying by its multipliers, which is only harmless while they
    // are the identity. If any of them moves, the free path silently stops
    // matching the paid path's base case - so fail here instead.
    const base = SCENARIOS.base;
    expect(base.rentLevelMultiplier.value).toBe(1);
    expect(base.occupancyMultiplier.value).toBe(1);
    expect(base.utilitiesMultiplier.value).toBe(1);
    expect(base.maintenanceInflationMultiplier.value).toBe(1);
    expect(base.interestRateDelta.value).toBe(0);
  });

  it("equals the full engine's base-scenario NOI when fed the same property", () => {
    // The strongest guarantee that the simplified path did not quietly
    // grow its own operating cost structure. runEngine is given exactly
    // what the band's unfavourable end assumes - the margin-adjusted rent
    // (17 x 0.92), the minimal tier, € 1.800 gastos, long-term only - and
    // its base scenario's NOI is, by definition, gross income minus
    // management, maintenance, utilities and fixed costs, with no debt
    // service. Since fase A stap 3, band.unfavourable.annualCashflow is
    // no longer that same quantity on its own - it now has this fix's own
    // debt service subtracted - so the comparison adds annualDebtService
    // back before checking: this pins that the *operating* cost structure
    // has not drifted, independent of financing having been added on top.
    const band = computeFreeTierBand({
      neighborhood: "Ruzafa",
      purchasePrice: 350_000,
      builtAreaM2: 90,
    });

    const viaEngine = runEngine({
      property: {
        name: "cross-check",
        region: "Valencia",
        usableAreaM2: 90 * DEFAULT_USABLE_TO_BUILT_AREA_RATIO.value,
        builtAreaM2: 90,
        purchasePrice: 350_000,
        communityFeesAnnual: FREE_TIER_BAND_COMMUNITY_FEES_UNFAVOURABLE.value,
        hasTouristRentalLicense: false,
      },
      constraints: {
        totalBudget: 1_000_000,
        maxRenovationBudget: 60_000,
        minLtv: 0.6,
        maxLtv: 0.75,
        riskTolerance: "medium",
        minRoiTarget: 0.04,
        minMonthlyCashflow: 500,
        maxMonthlyDebt: 1_000,
      },
      selections: {
        rentPerM2LongTerm: 17 * (1 - FREE_TIER_BAND_RENT_MARGIN.value),
        // Required to be positive by validateEngineInput even when the
        // selected strategy never reads it; "longTerm" below means this
        // value cannot reach selectedGrossAnnualIncome.
        rentPerM2ShortTerm: 1,
        rentalStrategy: "longTerm",
        renovationStrategy: FREE_TIER_BAND_RENOVATION_TIER_UNFAVOURABLE.value,
        financingStrategy: "high",
        residency: "nonResident",
        euResident: true,
      },
    });
    const baseNoi = viaEngine.scenarios.find((s) => s.id === "base")!.noi;

    const operatingCashflow = band.unfavourable.annualCashflow + band.unfavourable.annualDebtService;
    expect(operatingCashflow).toBeCloseTo(baseNoi, 8);
  });

  it("reuses the engine's own IBI base rather than restating it", () => {
    const band = computeFreeTierBand({
      neighborhood: "Ruzafa",
      purchasePrice: 350_000,
      builtAreaM2: 90,
    });
    expect(band.unfavourable.propertyTaxIBI).toBeCloseTo(
      350_000 * 0.004 * DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO.value,
      10,
    );
  });
});

describe("free indication band - input handling", () => {
  it("rejects an unknown wijk instead of falling back to a city average", () => {
    expect(() =>
      computeFreeTierBand({ neighborhood: "Amsterdam", purchasePrice: 300_000, builtAreaM2: 80 }),
    ).toThrow(/No long-term reference rent/);
  });

  it("accepts every wijk the dropdown will offer", () => {
    for (const wijk of Object.keys(NEIGHBORHOOD_RENT_LONG_TERM.value)) {
      const band = computeFreeTierBand({
        neighborhood: wijk,
        purchasePrice: 300_000,
        builtAreaM2: 80,
      });
      expect(band.referenceRentPerM2).toBe(NEIGHBORHOOD_RENT_LONG_TERM.value[wijk]);
      expect(band.monthlyCashflow.low).toBeLessThan(
        band.monthlyCashflow.high,
      );
    }
  });

  it("rejects a non-positive area or price rather than returning a nonsense band", () => {
    expect(() =>
      computeFreeTierBand({ neighborhood: "Ruzafa", purchasePrice: 300_000, builtAreaM2: 0 }),
    ).toThrow(/builtAreaM2/);
    expect(() =>
      computeFreeTierBand({ neighborhood: "Ruzafa", purchasePrice: 0, builtAreaM2: 80 }),
    ).toThrow(/purchasePrice/);
  });
});
