import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import { EMPTY_LISTING_FIELD_PROVENANCE } from "@/lib/rules/es/types";
import type {
  ListingFieldProvenanceReport,
  RentInputProvenance,
  RentInputProvenanceReport,
} from "@/lib/rules/es/types";
import { OneLineOutcomeSection } from "../one-line-outcome-section";

/**
 * Golden-render check against the reference case's base scenario:
 * monthlyCashflow -311,138231408102, dscr 0,8323276301747033, IRR 5,544%
 * clearing the 4% hurdle (returnRequirement.meetsMinRequiredReturn true) -
 * the same figures score.test.ts and outcome.test.ts already lock down.
 * The reference property has no neighbourhood, so rentInputProvenance is
 * "noReference" on both rates and no disclosure note should render.
 */

const NO_REFERENCE: RentInputProvenance = {
  status: "noReference",
  referenceRentPerM2: null,
  suppliedRentPerM2: 17,
  deviationFraction: null,
  significantDeviation: false,
};

function emptyReport(): RentInputProvenanceReport {
  return { longTerm: NO_REFERENCE, shortTerm: null };
}

describe("OneLineOutcomeSection - golden render against the reference case", () => {
  function renderBase() {
    const result = runEngine(referenceCase);
    const base = result.scenarioOutcomes!.find((o) => o.scenario === "base")!;
    const scenario = result.scenarios.find((s) => s.id === "base")!;
    const html = renderToStaticMarkup(
      <OneLineOutcomeSection
        monthlyCashflow={scenario.monthlyCashflow}
        dscr={scenario.dscr}
        irr={base.irr}
        meetsMinRequiredReturn={base.returnRequirement.meetsMinRequiredReturn}
        rentInputProvenance={result.rentInputProvenance}
        listingFieldProvenance={result.listingFieldProvenance}
      />,
    );
    return { html, base, scenario };
  }

  it("renders the three core figures at their golden values", () => {
    const { html, scenario } = renderBase();
    expect(scenario.monthlyCashflow).toBeCloseTo(-311.138231408102, 8);
    expect(scenario.dscr).toBeCloseTo(0.8323276301747033, 10);
    // Intl.NumberFormat separates the symbol from the amount with a
    // non-breaking space (U+00A0), not a regular one.
    expect(html).toContain("€ -311");
    expect(html).toContain("0,83");
  });

  it("renders the IRR figure and confirms it clears the hurdle", () => {
    const { html, base } = renderBase();
    expect(base.irr.defined).toBe(true);
    expect(base.returnRequirement.meetsMinRequiredReturn).toBe(true);
    const irrText = base.irr.defined
      ? (base.irr.irr * 100).toFixed(2).replace(".", ",") + "%"
      : null;
    expect(irrText).not.toBeNull();
    expect(html).toContain(irrText!);
  });

  it("uses 'maar' because the operating picture and the return picture disagree", () => {
    // Cashflow negative and DSCR below 1,0 (operating does not clear),
    // while the IRR does clear the hurdle - exactly UI_SPEC.md §7's own
    // example of what the report should surface without interpreting it.
    const { html } = renderBase();
    expect(html).toMatch(/negatieve maandcashflow.*maar.*rendementseis haalt/s);
  });

  it("names the direction each figure sits relative to its own threshold", () => {
    const { html } = renderBase();
    expect(html).toContain("negatieve maandcashflow");
    expect(html).toContain("onder de 1,0");
    expect(html).toContain("die de rendementseis haalt");
  });

  it("renders nothing about rent provenance for a property with no neighbourhood", () => {
    const { html } = renderBase();
    expect(html).not.toContain("wijkreferentie");
    expect(html).not.toContain("werkelijke huidige huur");
  });
});

describe("OneLineOutcomeSection - the connector reflects agreement, not sentiment", () => {
  it("uses 'en' when both pictures clear their bar", () => {
    const html = renderToStaticMarkup(
      <OneLineOutcomeSection
        monthlyCashflow={400}
        dscr={1.3}
        irr={{ defined: true, irr: 0.08, iterations: 6 }}
        meetsMinRequiredReturn={true}
        rentInputProvenance={emptyReport()}
        listingFieldProvenance={EMPTY_LISTING_FIELD_PROVENANCE}
      />,
    );
    expect(html).toMatch(/positieve maandcashflow.*en.*rendementseis haalt/s);
    expect(html).not.toContain(" maar ");
  });

  it("uses 'en' when both pictures fail their bar - no contrast needed for consistent bad news", () => {
    const html = renderToStaticMarkup(
      <OneLineOutcomeSection
        monthlyCashflow={-600}
        dscr={0.6}
        irr={{ defined: true, irr: 0.01, iterations: 6 }}
        meetsMinRequiredReturn={false}
        rentInputProvenance={emptyReport()}
        listingFieldProvenance={EMPTY_LISTING_FIELD_PROVENANCE}
      />,
    );
    expect(html).toMatch(/negatieve maandcashflow.*en.*rendementseis niet haalt/s);
    expect(html).not.toContain(" maar ");
  });

  it("uses 'maar' when operating clears but the return does not", () => {
    const html = renderToStaticMarkup(
      <OneLineOutcomeSection
        monthlyCashflow={300}
        dscr={1.2}
        irr={{ defined: true, irr: 0.01, iterations: 6 }}
        meetsMinRequiredReturn={false}
        rentInputProvenance={emptyReport()}
        listingFieldProvenance={EMPTY_LISTING_FIELD_PROVENANCE}
      />,
    );
    expect(html).toMatch(/positieve maandcashflow.*maar.*rendementseis niet haalt/s);
  });

  it("handles an undefined IRR without leaking engine-internal English", () => {
    const html = renderToStaticMarkup(
      <OneLineOutcomeSection
        monthlyCashflow={-100}
        dscr={0.9}
        irr={{ defined: false, reason: "The cashflow series never changes sign." }}
        meetsMinRequiredReturn={null}
        rentInputProvenance={emptyReport()}
        listingFieldProvenance={EMPTY_LISTING_FIELD_PROVENANCE}
      />,
    );
    expect(html).toContain("Er is geen IRR");
    expect(html).toContain("onbepaald");
    expect(html).not.toMatch(/cashflow series|sign change/i);
  });
});

describe("OneLineOutcomeSection - rent provenance styling by severity", () => {
  function reportWith(status: RentInputProvenance["status"], overrides: Partial<RentInputProvenance> = {}) {
    const provenance: RentInputProvenance = {
      status,
      referenceRentPerM2: 17,
      suppliedRentPerM2: 14.5,
      deviationFraction: -0.147,
      significantDeviation: false,
      ...overrides,
    };
    const report: RentInputProvenanceReport = { longTerm: provenance, shortTerm: null };
    return renderToStaticMarkup(
      <OneLineOutcomeSection
        monthlyCashflow={100}
        dscr={1.1}
        irr={{ defined: true, irr: 0.05, iterations: 6 }}
        meetsMinRequiredReturn={true}
        rentInputProvenance={report}
        listingFieldProvenance={EMPTY_LISTING_FIELD_PROVENANCE}
      />,
    );
  }

  it("renders a significant override in a bordered, prominent block", () => {
    const html = reportWith("customerOverride", {
      deviationFraction: -0.3,
      significantDeviation: true,
    });
    expect(html).toContain("U heeft zelf een langetermijnhuur ingevuld");
    expect(html).toMatch(/border-l-2[^>]*>[\s\S]*U heeft zelf/);
  });

  it("renders a minor override as a faint aside", () => {
    const html = reportWith("customerOverride", {
      deviationFraction: -0.05,
      significantDeviation: false,
    });
    expect(html).toContain("wijkt licht af");
    expect(html).toMatch(/text-text-faint[^>]*>[\s\S]*wijkt licht af/);
  });

  it("renders the actualCurrentRent case as a reassuring, unboxed sentence", () => {
    const html = reportWith("actualCurrentRent", {
      deviationFraction: null,
      significantDeviation: false,
    });
    expect(html).toContain("werkelijke huidige huur van dit pand");
    expect(html).toContain("niet op een schatting");
    expect(html).not.toMatch(/border-l-2/);
  });

  it("renders nothing at all for matchesReference", () => {
    const html = reportWith("matchesReference", {
      suppliedRentPerM2: 17,
      deviationFraction: 0,
    });
    expect(html).not.toContain("wijkreferentie");
    expect(html).not.toContain("werkelijke huidige huur");
  });
});

describe("OneLineOutcomeSection - the §6.1 listing-price notice (SOURCING_SPEC.md §4/§7 step 4)", () => {
  function renderWithPurchasePrice(
    purchasePrice: ListingFieldProvenanceReport["purchasePrice"],
  ) {
    return renderToStaticMarkup(
      <OneLineOutcomeSection
        monthlyCashflow={100}
        dscr={1.1}
        irr={{ defined: true, irr: 0.05, iterations: 6 }}
        meetsMinRequiredReturn={true}
        rentInputProvenance={{ longTerm: null, shortTerm: null }}
        listingFieldProvenance={{
          ...EMPTY_LISTING_FIELD_PROVENANCE,
          purchasePrice,
        }}
      />,
    );
  }

  it("shows a bordered notice, at the same visual weight as a significant rent override, when the price is still fromListing", () => {
    const html = renderWithPurchasePrice({ status: "fromListing", originalValue: 620000 });
    expect(html).toContain("€ 620.000");
    expect(html).toContain("nog niet door u bevestigd");
    expect(html).toContain("Controleer of dit bedrag nog actueel is");
    expect(html).toMatch(/border-l-2[^>]*>[\s\S]*Controleer of dit bedrag/);
  });

  it("shows nothing once the customer has confirmed or edited the price", () => {
    const html = renderWithPurchasePrice({ status: "confirmed", originalValue: 620000 });
    expect(html).not.toContain("overgenomen uit de");
    expect(html).not.toContain("Controleer of dit bedrag");
  });

  it("shows nothing when no listing was involved at all", () => {
    const html = renderWithPurchasePrice(null);
    expect(html).not.toContain("overgenomen uit de");
    expect(html).not.toContain("Controleer of dit bedrag");
  });
});
