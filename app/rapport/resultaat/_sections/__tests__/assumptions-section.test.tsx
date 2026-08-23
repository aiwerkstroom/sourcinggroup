import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { describeAssumption } from "@/lib/copy/es/assumption-disclosures";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import type { FinancingTermsProvenance } from "@/lib/rules/es/types";
import { AssumptionsSection } from "../assumptions-section";

/**
 * Golden check against the reference case's base scenario. The exact
 * count (40, at time of writing) is not pinned - lib/rules/es/assumptions.ts
 * documents the full trace and is tested there; this section's own
 * contract is that every item collectUsedParameters() returns gets a
 * category, a label and a note, and that all three provenance labels the
 * reference case actually produces (it produces all three) render.
 */
function buildProps() {
  const result = runEngine(referenceCase);
  const outcome = result.scenarioOutcomes!.find((o) => o.scenario === "base")!;
  return {
    assumptionsUsed: outcome.assumptionsUsed,
    listingFieldProvenance: result.listingFieldProvenance,
    // The reference case supplies renovationStrategy directly, with no
    // "staat van onderhoud" behind it, so there is no derivation to report
    // - null here is the honest value, not a fixture shortcut. Fase C stap
    // 1's own rendering is covered in its dedicated describe block below.
    renovationTierProvenance: result.renovationTierProvenance,
    renovationStrategy: result.selectedRenovation.id,
    renovationDurationProvenance: result.renovationDurationProvenance,
    renovationDurationMonths: result.selectedRenovation.durationMonths,
    renovationLeaseUpMonths: result.selectedRenovation.timeToRentMonths,
    financingTermsProvenance: result.financingTermsProvenance,
    financingTermsInForce: {
      allInRate:
        result.selectedFinancing.interestRate + result.selectedFinancing.nonResidentSpread,
      loanTermYears: result.selectedFinancing.loanTermYears,
    },
  };
}

describe("AssumptionsSection - golden data against the reference case", () => {
  it("the reference case's base scenario rests on parameters of all three provenance levels", () => {
    const { assumptionsUsed } = buildProps();
    const provenances = new Set(assumptionsUsed.map((p) => p.provenance));
    expect(provenances).toEqual(new Set(["SOURCED", "ESTIMATE", "PLACEHOLDER"]));
    expect(assumptionsUsed.length).toBeGreaterThan(30);
  });

  it("describeAssumption() has Dutch copy for every one of them", () => {
    const { assumptionsUsed } = buildProps();
    for (const param of assumptionsUsed) {
      const { category, label, note } = describeAssumption(param);
      expect(category.length).toBeGreaterThan(0);
      expect(label.length).toBeGreaterThan(0);
      expect(note.length).toBeGreaterThan(0);
    }
  });
});

describe("AssumptionsSection - rendered against the reference case", () => {
  it("shows all three provenance labels (SOURCED/ESTIMATE/PLACEHOLDER)", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(<AssumptionsSection {...props} />);

    expect(html).toContain("Bron");
    expect(html).toContain("Modelkeuze");
    expect(html).toContain("Schatting");
  });

  it("shows a date for at least one SOURCED parameter", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(<AssumptionsSection {...props} />);
    const sourced = props.assumptionsUsed.find((p) => p.provenance === "SOURCED");
    expect(sourced).toBeDefined();
    if (sourced && sourced.provenance === "SOURCED") {
      expect(html).toContain(sourced.date);
    }
  });

  it("explicitly states the fixed residency and EU-residency assumption", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(<AssumptionsSection {...props} />);

    expect(html).toContain("niet-ingezetene");
    expect(html).toContain("EU-ingezetene");
    expect(html).toContain("niet per pand uitgevraagd");
  });

  it("groups parameters under category headings", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(<AssumptionsSection {...props} />);

    for (const category of ["Huur", "Renovatie", "Financiering", "Exploitatiekosten", "Aankoopkosten", "Belasting"]) {
      expect(html).toContain(category);
    }
  });

  it("renders one list item per assumption used, matching the count exactly", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(<AssumptionsSection {...props} />);
    expect((html.match(/<li/g) ?? []).length).toBe(props.assumptionsUsed.length);
  });

  it("shows nothing about a listing origin for the reference case (no listing was chosen)", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(<AssumptionsSection {...props} />);
    expect(html).not.toContain("overgenomen uit de gekozen listing");
  });
});

describe("AssumptionsSection - the §6.8 listing-fields note (SOURCING_SPEC.md §4/§7 step 4)", () => {
  it("names wijk and oppervlak together when both are still fromListing", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(
      <AssumptionsSection
        {...props}
        listingFieldProvenance={{
          neighborhood: { status: "fromListing", originalValue: "El Carmen (Ciutat Vella)" },
          purchasePrice: { status: "confirmed", originalValue: 620000 },
          builtAreaM2: { status: "fromListing", originalValue: 180 },
          usableAreaM2: { status: "fromListing", originalValue: 165 },
        }}
      />,
    );
    expect(html).toContain(
      "De wijk, het gebouwd oppervlak en het bruikbaar oppervlak zijn overgenomen uit de gekozen listing, niet door u bevestigd.",
    );
  });

  it("names a single field on its own when only that one is still fromListing", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(
      <AssumptionsSection
        {...props}
        listingFieldProvenance={{
          neighborhood: { status: "confirmed", originalValue: "El Carmen (Ciutat Vella)" },
          purchasePrice: null,
          builtAreaM2: { status: "fromListing", originalValue: 180 },
          usableAreaM2: { status: "confirmed", originalValue: 165 },
        }}
      />,
    );
    expect(html).toContain(
      "Het gebouwd oppervlak is overgenomen uit de gekozen listing, niet door u bevestigd.",
    );
  });

  it("never mentions purchasePrice here - that field has its own §6.1 treatment", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(
      <AssumptionsSection
        {...props}
        listingFieldProvenance={{
          neighborhood: { status: "confirmed", originalValue: "El Carmen (Ciutat Vella)" },
          purchasePrice: { status: "fromListing", originalValue: 620000 },
          builtAreaM2: { status: "confirmed", originalValue: 180 },
          usableAreaM2: { status: "confirmed", originalValue: 165 },
        }}
      />,
    );
    expect(html).not.toContain("overgenomen uit de gekozen listing");
  });

  it("shows nothing once every field is confirmed", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(
      <AssumptionsSection
        {...props}
        listingFieldProvenance={{
          neighborhood: { status: "confirmed", originalValue: "El Carmen (Ciutat Vella)" },
          purchasePrice: { status: "confirmed", originalValue: 620000 },
          builtAreaM2: { status: "confirmed", originalValue: 180 },
          usableAreaM2: { status: "confirmed", originalValue: 165 },
        }}
      />,
    );
    expect(html).not.toContain("overgenomen uit de gekozen listing");
  });
});

/**
 * Fase C stap 1: the renovation tier's own provenance line. Three
 * outcomes, not two - "chosen" splits depending on whether the customer's
 * pick happens to coincide with what the derivation would have said, and
 * a sentence contrasting a tier with itself would read as nonsense.
 */
describe("AssumptionsSection - the renovation tier's provenance (fase C stap 1)", () => {
  it("says the model derived it, and calls the mapping a schatting, under 'derived'", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(
      <AssumptionsSection
        {...props}
        renovationTierProvenance={{ status: "derived", derivedValue: "light" }}
        renovationStrategy="light"
      />,
    );
    expect(html).toContain("is door het model afgeleid");
    expect(html).toContain("staat van onderhoud");
    expect(html).toContain("schatting");
    expect(html).not.toContain("koos");
  });

  it("contrasts the chosen tier against the derived one when they differ", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(
      <AssumptionsSection
        {...props}
        renovationTierProvenance={{ status: "customerChosen", derivedValue: "light" }}
        renovationStrategy="heavy"
      />,
    );
    // Both tiers named, and which one the numbers rest on stated outright.
    expect(html).toContain("U koos het renovatiescenario grondig zelf");
    expect(html).toContain("zou het model licht hebben afgeleid");
    expect(html).toContain("Er is met uw keuze gerekend.");
  });

  it("does not contrast a tier with itself when the choice matches the derivation", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(
      <AssumptionsSection
        {...props}
        renovationTierProvenance={{ status: "customerChosen", derivedValue: "heavy" }}
        renovationStrategy="heavy"
      />,
    );
    expect(html).toContain("U koos het renovatiescenario grondig zelf");
    expect(html).toContain("hetzelfde scenario");
    // The contrasting clause would be self-referential here, so it is absent.
    expect(html).not.toContain("zou het model grondig hebben afgeleid");
  });

  it("shows no line at all when there was no derivation to report on", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(
      <AssumptionsSection {...props} renovationTierProvenance={null} />,
    );
    expect(html).not.toContain("renovatiescenario");
    expect(html).not.toContain("staat van onderhoud");
  });
});

/**
 * Fase C stap 2: the renovation duration's own provenance line, and the
 * separate notice for a renovation that outruns the year the projection
 * prorates.
 */
describe("AssumptionsSection - the renovation duration (fase C stap 2)", () => {
  it("calls the derived duration a schatting, and says what it costs", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(
      <AssumptionsSection
        {...props}
        renovationDurationProvenance={{ status: "derived", derivedValue: 3 }}
        renovationDurationMonths={3}
        renovationLeaseUpMonths={2}
      />,
    );
    expect(html).toContain("3 maanden");
    expect(html).toContain("schatting");
    expect(html).toContain("geen huurinkomen");
  });

  it("contrasts a customer's figure against the model's when they differ", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(
      <AssumptionsSection
        {...props}
        renovationDurationProvenance={{ status: "customerChosen", derivedValue: 3 }}
        renovationDurationMonths={6}
        renovationLeaseUpMonths={2}
      />,
    );
    expect(html).toContain("U gaf zelf 6 maanden verbouwtijd op");
    expect(html).toContain("schat het model 3 maanden");
    expect(html).toContain("Er is met uw opgave gerekend.");
  });

  it("does not contrast a figure with itself when they coincide", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(
      <AssumptionsSection
        {...props}
        renovationDurationProvenance={{ status: "customerChosen", derivedValue: 3 }}
        renovationDurationMonths={3}
        renovationLeaseUpMonths={2}
      />,
    );
    expect(html).toContain("gelijk aan de schatting");
    expect(html).not.toContain("schat het model 3 maanden");
  });

  it("says nothing about a year-2 spill when the vacancy fits inside year 1", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(
      <AssumptionsSection
        {...props}
        renovationDurationProvenance={{ status: "derived", derivedValue: 3 }}
        renovationDurationMonths={3}
        renovationLeaseUpMonths={2}
      />,
    );
    expect(html).not.toContain("vallen in jaar 2");
  });

  it("discloses the spill, and that year 2 is overstated, once the vacancy outruns the year", () => {
    // The limitation the calculation cannot express: only year 1 is
    // prorated, so months past twelve fall outside the model entirely.
    const props = buildProps();
    const html = renderToStaticMarkup(
      <AssumptionsSection
        {...props}
        renovationDurationProvenance={{ status: "customerChosen", derivedValue: 3 }}
        renovationDurationMonths={12}
        renovationLeaseUpMonths={2}
      />,
    );
    expect(html).toContain("samen 14 maanden");
    expect(html).toContain("2 maanden vallen in jaar 2");
    expect(html).toContain("ligt dus lager dan hier staat");
  });

  it("shows no duration line at all when nobody was asked", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(
      <AssumptionsSection {...props} renovationDurationProvenance={null} />,
    );
    expect(html).not.toContain("verbouwtijd");
    expect(html).not.toContain("doorlooptijd");
  });
});

/**
 * Fase C stap 3: where the mortgage rate and term came from, and the
 * all-in clarification that only appears once a rate was overridden.
 */
describe("AssumptionsSection - the financing terms (fase C stap 3)", () => {
  const derived: FinancingTermsProvenance["interestRate"] = {
    status: "derived",
    derivedValue: 0.042,
  };
  const derivedTerm: FinancingTermsProvenance["loanTermYears"] = {
    status: "derived",
    derivedValue: 15,
  };

  function render(
    provenance: FinancingTermsProvenance,
    inForce: { allInRate: number; loanTermYears: number },
  ) {
    const props = buildProps();
    return renderToStaticMarkup(
      <AssumptionsSection
        {...props}
        financingTermsProvenance={provenance}
        financingTermsInForce={inForce}
      />,
    );
  }

  it("calls both derived when neither was supplied, and says they are not a quote", () => {
    const html = render(
      { interestRate: derived, loanTermYears: derivedTerm },
      { allInRate: 0.042, loanTermYears: 15 },
    );
    expect(html).toContain("4,2%");
    expect(html).toContain("15 jaar");
    expect(html).toContain("niet uit een offerte");
    // Nothing to clarify about all-in when the customer supplied no rate.
    expect(html).not.toContain("als all-in behandeld");
  });

  it("contrasts both against the derived pair when both were supplied", () => {
    const html = render(
      {
        interestRate: { status: "customerChosen", derivedValue: 0.042 },
        loanTermYears: { status: "customerChosen", derivedValue: 15 },
      },
      { allInRate: 0.036, loanTermYears: 25 },
    );
    expect(html).toContain("U gaf zelf een rente van 3,6%");
    expect(html).toContain("looptijd van 25 jaar");
    expect(html).toContain("4,2%");
    expect(html).toContain("15 jaar");
  });

  it("names only the overridden half when just the rate was supplied", () => {
    const html = render(
      {
        interestRate: { status: "customerChosen", derivedValue: 0.042 },
        loanTermYears: derivedTerm,
      },
      { allInRate: 0.036, loanTermYears: 15 },
    );
    expect(html).toContain("U gaf zelf een rente van 3,6%");
    expect(html).toContain("De looptijd (15 jaar) is wel afgeleid.");
  });

  it("names only the overridden half when just the term was supplied", () => {
    const html = render(
      {
        interestRate: derived,
        loanTermYears: { status: "customerChosen", derivedValue: 15 },
      },
      { allInRate: 0.042, loanTermYears: 25 },
    );
    expect(html).toContain("U gaf zelf een looptijd van 25 jaar");
    expect(html).toContain("De rente (4,2%) is wel afgeleid.");
  });

  it("spells out that an own rate is all-in, so nobody wonders about a hidden surcharge", () => {
    const html = render(
      {
        interestRate: { status: "customerChosen", derivedValue: 0.042 },
        loanTermYears: derivedTerm,
      },
      { allInRate: 0.036, loanTermYears: 15 },
    );
    expect(html).toContain("als all-in behandeld");
    expect(html).toContain("geen opslag voor niet-ingezetenen bovenop");
  });

  it("shows no financing line at all when nobody was asked", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(
      <AssumptionsSection {...props} financingTermsProvenance={null} />,
    );
    expect(html).not.toContain("uit een offerte");
    expect(html).not.toContain("als all-in behandeld");
  });
});
