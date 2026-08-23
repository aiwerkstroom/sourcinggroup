import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  FREE_TIER_DISCLOSURE_GROUP_HEADING_NL,
  groupFreeTierDisclosures,
} from "@/lib/copy/es/free-tier-disclosure-groups";
import { translateFreeTierDisclosure } from "@/lib/copy/es/free-tier-disclosures";
import { acquisitionCostRates } from "@/lib/rules/es/acquisition";
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
 *
 * The three cases were originally chosen to land on Laag/Gemiddeld/Hoog.
 * Fase A stap 3 added financing to the cashflow figure, which pulled two
 * of the three down a grade (Mislata was "medium", El Carmen was "high");
 * none of the three reaches "high" any more. The labels below are the
 * post-financing values, re-derived against the real code rather than
 * kept at their old grades - retuning the cases themselves, or the
 * thresholds they're graded against, is fase A stap 4's question, not
 * this one's.
 */
const CASES = [
  {
    name: "low cashflow grade (Oliva)",
    input: { neighborhood: "Oliva", purchasePrice: 400_000, builtAreaM2: 40 },
    expectedCashflowLabel: "low" as const,
  },
  {
    name: "low cashflow grade (Mislata, was medium before fase A stap 3)",
    input: { neighborhood: "Mislata", purchasePrice: 250_000, builtAreaM2: 70 },
    expectedCashflowLabel: "low" as const,
  },
  {
    name: "medium cashflow grade (El Carmen, was high before fase A stap 3)",
    input: { neighborhood: "El Carmen (Ciutat Vella)", purchasePrice: 150_000, builtAreaM2: 90 },
    expectedCashflowLabel: "medium" as const,
  },
];

const CASHFLOW_LABEL_NL = { low: "Laag", medium: "Gemiddeld", high: "Hoog" } as const;

function buildProps(input: { neighborhood: string; purchasePrice: number; builtAreaM2: number }) {
  const band = computeFreeTierBand(input);
  const score = computeIndicativeScore(band);
  return { input, band, score, acquisitionCostRates: acquisitionCostRates() };
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

    expect(html).toContain(formatEuro(props.band.monthlyCashflow.low));
    expect(html).toContain(formatEuro(props.band.monthlyCashflow.high));
  });

  it("renders all five FreeTierDisclosureKey texts directly, not behind a collapsed element", () => {
    const props = buildProps(testCase.input);
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);

    const allKeys: (typeof ALL_FREE_TIER_DISCLOSURE_KEYS)[number][] = [
      "band",
      "shortTermLicence",
      "financing",
      "unverified",
      "indicativeScoreScope",
    ];
    for (const key of allKeys) {
      expect(html).toContain(translateFreeTierDisclosure(key));
    }
    // Nothing collapsible: no <details>, no aria-expanded toggle.
    expect(html).not.toContain("<details");
    expect(html).not.toContain("aria-expanded");
  });

  it("no longer shows pandtype/aantal eenheden or their disclosure - datakwaliteitsfix stap 6 removed the fields, not just the caveat", () => {
    const props = buildProps(testCase.input);
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);
    expect(html).not.toContain("Pandtype");
    expect(html).not.toContain("eenheden");
    expect(html).not.toContain("tellen nog niet mee");
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

/**
 * Fase A stap 2: rendering when all three narrowing fields collapse the
 * band to a point (band.pointEstimate true). Uses the same Ruzafa case
 * free-tier-band.test.ts's own golden test is built on, so the figure
 * asserted here is independently checkable against that file too.
 */
describe("IndicatieResult - point estimate (fase A stap 2, alle drie velden ingevuld)", () => {
  function buildPointProps() {
    const input = {
      neighborhood: "Ruzafa",
      purchasePrice: 350_000,
      builtAreaM2: 90,
      communityFeesAnnual: 1_200,
      maintenanceCondition: "poor" as const,
      rentLevel: "above" as const,
    };
    const band = computeFreeTierBand(input);
    const score = computeIndicativeScore(band);
    return { input, band, score, acquisitionCostRates: acquisitionCostRates() };
  }

  it("band.pointEstimate is true and low equals high - the precondition this whole test rests on", () => {
    const { band } = buildPointProps();
    expect(band.pointEstimate).toBe(true);
    expect(band.monthlyCashflow.low).toBe(band.monthlyCashflow.high);
  });

  it("renders 'Cashflow-schatting', not 'Cashflow-bandbreedte'", () => {
    const props = buildPointProps();
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);
    expect(html).toContain("Cashflow-schatting");
    expect(html).not.toContain("Cashflow-bandbreedte");
  });

  it("renders a single figure, not a 'low – high' range", () => {
    const props = buildPointProps();
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);
    const figure = formatEuro(props.band.monthlyCashflow.low);
    expect(html).toContain(figure);
    // The en dash only ever separates a range in this component - its
    // absence is the actual claim, not the figure's presence alone.
    expect(html).not.toContain(`${figure} –`);
  });

  it("renders pointEstimateFromCustomerInput's text, not band's own range-framing text", () => {
    const props = buildPointProps();
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);
    expect(html).toContain(translateFreeTierDisclosure("pointEstimateFromCustomerInput"));
    expect(html).not.toContain(translateFreeTierDisclosure("band"));
    // Nor duplicated into the Toelichting list further down the page.
    const occurrences = html.split(translateFreeTierDisclosure("pointEstimateFromCustomerInput")).length - 1;
    expect(occurrences).toBe(1);
  });

  it("does not render narrowedByCustomerInput's text - that key does not apply once collapsed to a point", () => {
    const props = buildPointProps();
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);
    expect(html).not.toContain(translateFreeTierDisclosure("narrowedByCustomerInput"));
  });

  it("still renders the three unaffected disclosures (shortTermLicence, financing, unverified) and the score's own", () => {
    const props = buildPointProps();
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);
    for (const key of ["shortTermLicence", "financing", "unverified", "indicativeScoreScope"] as const) {
      expect(html).toContain(translateFreeTierDisclosure(key));
    }
  });
});

/**
 * Kosten koper, as a headline rather than a footnote. The figure must be
 * the model's own - a page quoting one percentage while the paid report
 * charges another is the same bait-and-switch fase A spent four steps
 * closing, only on a different line.
 */
describe("IndicatieResult - de aankoopkosten-kopregel", () => {
  const props = buildProps({ neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 });
  const html = renderToStaticMarkup(<IndicatieResult {...props} />);

  it("quotes the rate the calculation layer actually charges, not a hand-written one", () => {
    const rates = acquisitionCostRates();
    const pct = (f: number) => `${(f * 100).toLocaleString("nl-NL", { maximumFractionDigits: 1 })}%`;
    expect(html).toContain(pct(rates.mandatory));
    expect(html).toContain(pct(rates.agency));
  });

  it("names what those costs consist of, so the number is checkable", () => {
    expect(html).toContain("overdrachtsbelasting");
    expect(html).toContain("zegelrecht");
    expect(html).toContain("notaris");
    expect(html).toContain("registratie");
    expect(html).toContain("juridisch advies");
  });

  it("says outright that these sit outside the monthly cashflow", () => {
    // The misreading this exists to prevent: treating the band below as
    // if it already absorbed the purchase costs.
    expect(html).toContain("niet in de maandcashflow");
    expect(html).toContain("eenmalig bij aankoop");
  });

  it("separates the unavoidable costs from the purchase-agent fee", () => {
    expect(html).toContain("aankoopmakelaar");
  });

  it("sits above the score, not among the disclosures", () => {
    // Prominence is the requirement, so position is part of the contract:
    // the line has to precede the indicative-score card in the markup.
    const costsAt = html.indexOf("aan aankoopkosten");
    const scoreAt = html.indexOf("sectie-indicatieve-score");
    expect(costsAt).toBeGreaterThan(-1);
    expect(scoreAt).toBeGreaterThan(-1);
    expect(costsAt).toBeLessThan(scoreAt);
  });
});

/**
 * The consolidated voorbehouden. This is a presentation change only, so
 * what these pin is that nothing was lost in the regrouping: every key a
 * result carries still renders its full text, under one of three
 * headings, and the key set is unchanged.
 */
describe("IndicatieResult - voorbehouden, gegroepeerd in plaats van gestapeld", () => {
  it("still renders every disclosure key's full text, unedited", () => {
    for (const testCase of CASES) {
      const props = buildProps(testCase.input);
      const html = renderToStaticMarkup(<IndicatieResult {...props} />);
      for (const key of [...props.band.disclosures, ...props.score.disclosures]) {
        expect(html).toContain(translateFreeTierDisclosure(key));
      }
    }
  });

  it("shows three headed groups rather than five loose sentences", () => {
    const props = buildProps({ neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 });
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);
    for (const heading of Object.values(FREE_TIER_DISCLOSURE_GROUP_HEADING_NL)) {
      expect(html).toContain(heading);
    }
  });

  it("puts each key under the group it belongs to, for every key a result can carry", () => {
    const props = buildProps({ neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 });
    const grouped = groupFreeTierDisclosures([
      ...props.band.disclosures.filter(
        (k) => k !== "band" && k !== "pointEstimateFromCustomerInput",
      ),
      ...props.score.disclosures,
    ]);
    // Nothing dropped and nothing duplicated by the regrouping.
    const regrouped = grouped.flatMap((g) => g.keys);
    expect(regrouped).toHaveLength(
      props.band.disclosures.filter((k) => k !== "band" && k !== "pointEstimateFromCustomerInput")
        .length + props.score.disclosures.length,
    );
    expect(new Set(regrouped).size).toBe(regrouped.length);
  });

  it("renders no empty heading when a conditional key is absent", () => {
    // narrowedByCustomerInput is conditional, so "data" can hold one key
    // or two - but a group with no keys at all must not print a heading.
    const props = buildProps({ neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 });
    expect(props.band.disclosures).not.toContain("narrowedByCustomerInput");
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);
    // The data group still appears - "unverified" is unconditional.
    expect(html).toContain(FREE_TIER_DISCLOSURE_GROUP_HEADING_NL.data);
    expect(html).toContain(translateFreeTierDisclosure("unverified"));
  });

  it("carries the narrowing key into its group when the customer supplied fields", () => {
    const band = computeFreeTierBand({
      neighborhood: "Ruzafa",
      purchasePrice: 350_000,
      builtAreaM2: 90,
      communityFeesAnnual: 1_200,
    });
    const score = computeIndicativeScore(band);
    expect(band.disclosures).toContain("narrowedByCustomerInput");
    const html = renderToStaticMarkup(
      <IndicatieResult
        input={{ neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 }}
        band={band}
        score={score}
        acquisitionCostRates={acquisitionCostRates()}
      />,
    );
    expect(html).toContain(translateFreeTierDisclosure("narrowedByCustomerInput"));
    expect(html).toContain(FREE_TIER_DISCLOSURE_GROUP_HEADING_NL.data);
  });

  it("still shows nothing behind a collapsed element", () => {
    const props = buildProps({ neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 });
    const html = renderToStaticMarkup(<IndicatieResult {...props} />);
    expect(html).not.toContain("<details");
    expect(html).not.toContain("aria-expanded");
  });
});
