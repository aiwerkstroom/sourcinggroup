import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import { formatEuro, formatPercent } from "../../_lib/format";
import { ThresholdsSection } from "../thresholds-section";

/**
 * Golden-render check against the reference case's base scenario. The
 * reference case is a rejection on two of the three thresholds and a pass
 * on the third (MODEL_SPEC_FASE1B §7 / outcome.test.ts's own worked
 * figures): required equity (€ 197.990) exceeds available (€ 115.000);
 * the base scenario's monthly cashflow (€ -311,14) is below the € 500
 * minimum; but its IRR (5,54%) clears the 4% hurdle rate. UI_SPEC.md §7 is
 * explicit that this mixed, mostly-negative outcome is exactly what the
 * reference case should show - not a report bug to paper over.
 */
function buildProps() {
  const result = runEngine(referenceCase);
  const scenario = result.scenarios.find((s) => s.id === "base")!;
  const outcome = result.scenarioOutcomes!.find((o) => o.scenario === "base")!;
  return {
    equityFit: outcome.equityFit,
    cashflow: {
      minMonthlyCashflow: scenario.minMonthlyCashflow,
      monthlyCashflow: scenario.monthlyCashflow,
      meetsMinMonthlyCashflow: scenario.meetsMinMonthlyCashflow,
    },
    returnRequirement: outcome.returnRequirement,
    irr: outcome.irr,
  };
}

describe("ThresholdsSection - golden data against the reference case", () => {
  it("computes the expected pass/fail per threshold before rendering", () => {
    const props = buildProps();

    expect(props.equityFit.equityRequired).toBeCloseTo(193040, 0);
    expect(props.equityFit.equityAvailable).toBe(115000);
    expect(props.equityFit.fitsWithinAvailableEquity).toBe(false);

    expect(props.cashflow.minMonthlyCashflow).toBe(500);
    expect(props.cashflow.monthlyCashflow).toBeCloseTo(-311.1382314080802, 6);
    expect(props.cashflow.meetsMinMonthlyCashflow).toBe(false);

    expect(props.returnRequirement.minRequiredReturn).toBe(0.04);
    expect(props.irr.defined && props.irr.irr).toBeCloseTo(0.054542739910539234, 6);
    expect(props.returnRequirement.meetsMinRequiredReturn).toBe(true);
  });
});

describe("ThresholdsSection - rendered against the reference case", () => {
  it("renders all three thresholds with the correct pass/fail badge", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(<ThresholdsSection {...props} />);

    expect(html).toContain("Eigen vermogen");
    expect(html).toContain("Maandcashflow");
    expect(html).toContain("Rendementsdoelstelling");

    // Two "Niet gehaald" (equity, cashflow), one "Gehaald" (return).
    expect((html.match(/Niet gehaald/g) ?? []).length).toBe(2);
    expect((html.match(/(?<!Niet )Gehaald/g) ?? []).length).toBe(1);
    expect(html).not.toContain("Onbekend");
  });

  it("renders the requirement and actual figures for every threshold", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(<ThresholdsSection {...props} />);

    expect(html).toContain(formatEuro(props.equityFit.equityRequired));
    expect(html).toContain(formatEuro(props.equityFit.equityAvailable!));
    expect(html).toContain(formatEuro(props.cashflow.minMonthlyCashflow));
    expect(html).toContain(formatEuro(props.cashflow.monthlyCashflow));
    expect(html).toContain(formatPercent(props.returnRequirement.minRequiredReturn));
    expect(props.irr.defined).toBe(true);
    if (props.irr.defined) {
      expect(html).toContain(formatPercent(props.irr.irr));
    }
  });

  it("renders 'Onbekend' rather than a fabricated pass/fail when a check cannot run", () => {
    const html = renderToStaticMarkup(
      <ThresholdsSection
        equityFit={{ equityRequired: 197990, equityAvailable: undefined, fitsWithinAvailableEquity: null }}
        cashflow={{ minMonthlyCashflow: 500, monthlyCashflow: -100, meetsMinMonthlyCashflow: false }}
        returnRequirement={{ minRequiredReturn: 0.04, meetsMinRequiredReturn: null }}
        irr={{ defined: false }}
      />,
    );

    expect((html.match(/Onbekend/g) ?? []).length).toBe(2);
    expect(html).toContain("Geen beschikbaar eigen vermogen opgegeven.");
    expect(html).toContain("Geen IRR bepaald.");
  });
});
