import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { describeAssumption } from "@/lib/copy/es/assumption-disclosures";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
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
