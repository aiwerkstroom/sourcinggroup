import { describe, expect, it } from "vitest";
import {
  FREE_TIER_DISCLOSURE_COPY_NL,
  translateFreeTierDisclosure,
  translateFreeTierDisclosures,
} from "../../../copy/es/free-tier-disclosures";
import { runEngine } from "../engine";
import { FREE_TIER_DISCLOSURE_KEYS, computeFreeTierBand } from "../free-tier/band";
import {
  BASE_OCCUPANCY_LONG_TERM,
  DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO,
  DEFAULT_USABLE_TO_BUILT_AREA_RATIO,
  FREE_TIER_BAND_COMMUNITY_FEES_FAVOURABLE,
  FREE_TIER_BAND_COMMUNITY_FEES_UNFAVOURABLE,
  FREE_TIER_BAND_RENOVATION_TIER_FAVOURABLE,
  FREE_TIER_BAND_RENOVATION_TIER_UNFAVOURABLE,
  FREE_TIER_BAND_RENT_MARGIN,
  NEIGHBORHOOD_RENT_LONG_TERM,
  RENOVATION_STRATEGIES,
  RENOVATION_TIER_BY_MAINTENANCE_CONDITION,
  SCENARIOS,
  TSG_SCORE_DISTRIBUTION_COMMUNITY_FEES_RANGE,
} from "../parameters";
import { ALL_FREE_TIER_DISCLOSURE_KEYS } from "../types";
import type { MaintenanceCondition, RenovationStrategyId } from "../types";

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

  it("computes the unfavourable end line by line", () => {
    const e = band.unfavourable;
    expect(e.rentPerM2).toBeCloseTo(15.64, 10);
    expect(e.usableAreaM2).toBeCloseTo(76.5, 10);
    expect(e.grossAnnualRent).toBeCloseTo(12_275.6796, 6);
    expect(e.propertyManagement).toBeCloseTo(982.054368, 6);
    expect(e.maintenance).toBeCloseTo(736.540776, 6);
    expect(e.utilities).toBeCloseTo(2_031.75, 6);
    expect(e.propertyTaxIBI).toBeCloseTo(1_400, 6);
    expect(e.fixedCosts).toBeCloseTo(4_330, 6);
    expect(e.annualCashflowBeforeFinancing).toBeCloseTo(4_195.334456, 6);
    expect(e.monthlyCashflowBeforeFinancing).toBeCloseTo(349.611205, 6);
  });

  it("computes the favourable end line by line", () => {
    const e = band.favourable;
    expect(e.rentPerM2).toBeCloseTo(18.36, 10);
    expect(e.usableAreaM2).toBeCloseTo(76.5, 10);
    expect(e.grossAnnualRent).toBeCloseTo(16_685.9352, 6);
    expect(e.propertyManagement).toBeCloseTo(1_334.874816, 6);
    expect(e.maintenance).toBeCloseTo(709.152246, 6);
    expect(e.utilities).toBeCloseTo(1_741.5, 6);
    expect(e.propertyTaxIBI).toBeCloseTo(1_400, 6);
    expect(e.fixedCosts).toBeCloseTo(2_930, 6);
    expect(e.annualCashflowBeforeFinancing).toBeCloseTo(9_970.408138, 6);
    expect(e.monthlyCashflowBeforeFinancing).toBeCloseTo(830.867345, 6);
  });

  it("reports the band as the two monthly figures", () => {
    expect(band.monthlyCashflowBeforeFinancing.low).toBeCloseTo(349.611205, 6);
    expect(band.monthlyCashflowBeforeFinancing.high).toBeCloseTo(830.867345, 6);
  });
});

describe("free indication band - golden values (other ends of the range)", () => {
  it("Oliva, € 150.000, 70 m² - unfavourable end is negative and stays negative", () => {
    const band = computeFreeTierBand({
      neighborhood: "Oliva",
      purchasePrice: 150_000,
      builtAreaM2: 70,
    });
    expect(band.unfavourable.grossAnnualRent).toBeCloseTo(5_167.01808, 6);
    expect(band.unfavourable.annualCashflowBeforeFinancing).toBeCloseTo(-666.614451, 6);
    expect(band.unfavourable.monthlyCashflowBeforeFinancing).toBeCloseTo(-55.551204, 6);
    expect(band.favourable.annualCashflowBeforeFinancing).toBeCloseTo(2_678.499242, 6);
    expect(band.favourable.monthlyCashflowBeforeFinancing).toBeCloseTo(223.20827, 6);
  });

  it("El Carmen, € 600.000, 120 m²", () => {
    const band = computeFreeTierBand({
      neighborhood: "El Carmen (Ciutat Vella)",
      purchasePrice: 600_000,
      builtAreaM2: 120,
    });
    expect(band.unfavourable.grossAnnualRent).toBeCloseTo(22_144.3632, 6);
    expect(band.unfavourable.monthlyCashflowBeforeFinancing).toBeCloseTo(917.096029, 6);
    expect(band.favourable.grossAnnualRent).toBeCloseTo(30_100.1184, 6);
    expect(band.favourable.monthlyCashflowBeforeFinancing).toBeCloseTo(1_680.071158, 6);
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
    expect(band.monthlyCashflowBeforeFinancing.low).toBeLessThan(
      band.monthlyCashflowBeforeFinancing.high,
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
        unnarrowed.monthlyCashflowBeforeFinancing.high - unnarrowed.monthlyCashflowBeforeFinancing.low;
      const narrowedWidth =
        band.monthlyCashflowBeforeFinancing.high - band.monthlyCashflowBeforeFinancing.low;
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

  it("says the figure is before financing", () => {
    expect(translateFreeTierDisclosure("financing")).toContain("vóór financiering");
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
    // grow its own cost structure. runEngine is given exactly what the
    // band's unfavourable end assumes - the margin-adjusted rent
    // (17 x 0.92), the minimal tier, € 1.800 gastos, long-term only - and
    // its base scenario's NOI is, by definition, gross income minus
    // management, maintenance, utilities and fixed costs, with no debt
    // service. That is the same quantity this module calls
    // annualCashflowBeforeFinancing, so the two must agree to the cent.
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

    expect(band.unfavourable.annualCashflowBeforeFinancing).toBeCloseTo(baseNoi, 8);
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
      expect(band.monthlyCashflowBeforeFinancing.low).toBeLessThan(
        band.monthlyCashflowBeforeFinancing.high,
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
