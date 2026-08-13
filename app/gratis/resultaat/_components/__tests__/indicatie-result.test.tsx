import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { translateFreeTierDisclosure } from "@/lib/copy/es/free-tier-disclosures";
import { computeFreeTierBand } from "@/lib/rules/es/free-tier/band";
import { computeIndicativeScore } from "@/lib/rules/es/free-tier/indicative-score";
import type { ALL_FREE_TIER_DISCLOSURE_KEYS } from "@/lib/rules/es/types";
import { formatEuro } from "../../_lib/format";
import { IndicatieResult } from "../indicatie-result";

/**
 * Golden-render check against three independently-chosen test cases, not
 * the paid path's reference case (Avenida Primado Reig 19) - that case is
 * specific to the paid engine's full second-order input and does not
 * exercise the free indication's own code path at all. These three
 * instead deliberately span the indicative score's three cashflow grades
 * (Laag/Gemiddeld/Hoog, SCORE_SPEC.md §8.2), computed independently via
 * computeFreeTierBand()/computeIndicativeScore() before rendering.
 *
 * The data-confidence grade is "Laag" in all three: band.ts's
 * collectPlaceholders() always yields the same twelve PLACEHOLDER names
 * (the free indication's inputs never change which parameters are
 * PLACEHOLDER, only their values), so dataCertaintyScore(12) - and
 * therefore its grade - is structurally constant across every possible
 * free-indication input. That is asserted explicitly below, not treated
 * as an oversight in case selection.
 */
const CASES = [
  {
    name: "low cashflow grade",
    input: { neighborhood: "Oliva", purchasePrice: 400_000, builtAreaM2: 40 },
    expectedCashflowLabel: "low" as const,
  },
  {
    name: "medium cashflow grade",
    input: { neighborhood: "Mislata", purchasePrice: 250_000, builtAreaM2: 70 },
    expectedCashflowLabel: "medium" as const,
  },
  {
    name: "high cashflow grade",
    input: { neighborhood: "El Carmen (Ciutat Vella)", purchasePrice: 150_000, builtAreaM2: 90 },
    expectedCashflowLabel: "high" as const,
  },
];

const CASHFLOW_LABEL_NL = { low: "Laag", medium: "Gemiddeld", high: "Hoog" } as const;

function buildProps(input: { neighborhood: string; purchasePrice: number; builtAreaM2: number }) {
  const band = computeFreeTierBand(input);
  const score = computeIndicativeScore(band);
  return { input, band, score };
}

describe("Free-tier band/score - golden data across the three cashflow grades", () => {
  it("computes the expected cashflow grade for each case, and 'low' data confidence for all three", () => {
    for (const testCase of CASES) {
      const { score } = buildProps(testCase.input);
      expect(score.cashflowLabel).toBe(testCase.expectedCashflowLabel);
      expect(score.dataConfidenceLabel).toBe("low");
    }
  });

  it("every case rests on exactly twelve PLACEHOLDER parameters - the free indication's fixed set", () => {
    for (const testCase of CASES) {
      const { band } = buildProps(testCase.input);
      expect(band.placeholdersUsed).toHaveLength(12);
      for (const p of band.placeholdersUsed) {
        expect(p.provenance).toBe("PLACEHOLDER");
      }
    }
  });
});

describe.each(CASES)("IndicatieResult - golden render ($name)", (testCase) => {
  it("renders the correct cashflow and data-confidence labels", () => {
    const props = buildProps(testCase.input);
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);

    expect(html).toContain(`>${CASHFLOW_LABEL_NL[testCase.expectedCashflowLabel]}<`);
    expect(html).toContain(">Laag<"); // data confidence, every case
  });

  it("renders the cashflow band range using the same formatter as the golden figures", () => {
    const props = buildProps(testCase.input);
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);

    expect(html).toContain(formatEuro(props.band.monthlyCashflowBeforeFinancing.low));
    expect(html).toContain(formatEuro(props.band.monthlyCashflowBeforeFinancing.high));
  });

  it("renders all six FreeTierDisclosureKey texts directly, not behind a collapsed element", () => {
    const props = buildProps(testCase.input);
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);

    const allKeys: (typeof ALL_FREE_TIER_DISCLOSURE_KEYS)[number][] = [
      "band",
      "shortTermLicence",
      "financing",
      "unverified",
      "unmodeledFields",
      "indicativeScoreScope",
    ];
    for (const key of allKeys) {
      expect(html).toContain(translateFreeTierDisclosure(key));
    }
    // Nothing collapsible: no <details>, no aria-expanded toggle.
    expect(html).not.toContain("<details");
    expect(html).not.toContain("aria-expanded");
  });

  it("never renders a raw 0-10 score number for either dimension", () => {
    const props = buildProps(testCase.input);
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);
    // IndicativeScore never carries the underlying numbers at all
    // (SCORE_SPEC.md §8.2), so this is really asserting the type system's
    // own guarantee also holds in the rendered output.
    expect(html).not.toMatch(/\b\d[,.]\d\s*\/\s*10\b/);
  });

  it("renders the factual 'what the full report adds' list and a CTA that carries no query params", () => {
    const props = buildProps(testCase.input);
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);

    expect(html).toContain("Wat het volledige rapport toevoegt");
    expect(html).toContain("IRR");
    expect(html).toContain("Tienjarige projectie");
    expect(html).toContain('href="/rapport/nieuw/pand"');
    // No pre-filled query string on the CTA - a fresh, empty wizard entry.
    expect(html).not.toContain('href="/rapport/nieuw/pand?');
  });

  it("renders the share button with no confirmation text before it is clicked", () => {
    const props = buildProps(testCase.input);
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);
    expect(html).toContain("URL kopiëren");
    expect(html).not.toContain("URL gekopieerd");
  });
});
