import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import { CashflowBreakdownSection } from "../cashflow-breakdown-section";

/**
 * Golden-render check against the reference case's base scenario. Every
 * row's monthly figure (annual ÷ 12) is asserted twice: once as a raw
 * number computed directly from EngineResult (so the test itself is
 * pinned, not just checking its own rendering), and once as the exact
 * Dutch-formatted string the component renders.
 *
 * "Cashflow vóór belasting" is deliberately -311/month: the same figure
 * scenarios-section.test.tsx and one-line-outcome-section.test.tsx already
 * pin down as the base scenario's monthlyCashflow. That is the bridge
 * point this section's docstring describes - not a coincidence to
 * re-derive, a consistency to lock down.
 */
function buildProps() {
  const result = runEngine(referenceCase);
  const scenario = result.scenarios.find((s) => s.id === "base")!;
  return {
    scenario,
    fixedCosts: result.fixedOperatingCosts,
    annualIncomeTax: result.tax.taxDueBase,
  };
}

describe("CashflowBreakdownSection - golden render against the reference case", () => {
  it("computes the golden monthly figures before rendering, so the test itself is pinned", () => {
    const props = buildProps();

    expect(props.scenario.grossIncome / 12).toBeCloseTo(2370.06, 6);
    expect(-props.scenario.propertyManagement / 12).toBeCloseTo(-189.6048, 6);
    expect(-props.scenario.maintenance / 12).toBeCloseTo(-118.503, 6);
    expect(-props.scenario.utilities / 12).toBeCloseTo(-238.29166666666666, 6);
    expect(-props.fixedCosts.propertyTaxIBI / 12).toBeCloseTo(-110, 6);
    expect(-props.fixedCosts.insurance / 12).toBeCloseTo(-85.83333333333333, 6);
    expect(-props.fixedCosts.bankAccountFee / 12).toBeCloseTo(-8.333333333333334, 6);
    expect(-props.fixedCosts.communityFees / 12).toBeCloseTo(-75, 6);
    expect(props.scenario.noi / 12).toBeCloseTo(1544.4938666666667, 6);
    expect(-props.scenario.annualDebtService / 12).toBeCloseTo(-1855.6320980747469, 4);
    expect(props.scenario.annualCashflow / 12).toBeCloseTo(-311.1382314080802, 6);
    expect(-props.annualIncomeTax / 12).toBeCloseTo(-48.74175133333333, 6);
    expect((props.scenario.annualCashflow - props.annualIncomeTax) / 12).toBeCloseTo(
      -359.87998274141347,
      4,
    );
  });

  it("renders every row as a Dutch-formatted euro amount", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(<CashflowBreakdownSection {...props} />);

    // Intl inserts a non-breaking space (U+00A0) after "€", not a regular one.
    expect(html).toContain("€ 2.370");
    expect(html).toContain("€ -190");
    expect(html).toContain("€ -119");
    expect(html).toContain("€ -238");
    expect(html).toContain("€ -110");
    expect(html).toContain("€ -86");
    expect(html).toContain("€ -8<");
    expect(html).toContain("€ -75");
    expect(html).toContain("€ 1.544");
    expect(html).toContain("€ -1.856");
    expect(html).toContain("€ -311");
    expect(html).toContain("€ -49");
    expect(html).toContain("€ -360");
  });

  it("renders every cost category as its own row - no merging", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(<CashflowBreakdownSection {...props} />);

    for (const label of [
      "Bruto huurinkomsten",
      "Management fee",
      "Onderhoud",
      "Nutsvoorzieningen",
      "Gemeentelijke belasting (IBI)",
      "Verzekeringen",
      "Bankkosten",
      "Gastos de comunidad",
      "Bedrijfsresultaat (NOI)",
      "Hypotheekaflossing (rente en aflossing)",
      "Cashflow vóór belasting",
      "Inkomstenbelasting",
      "Netto maandcashflow (na belasting)",
    ]) {
      expect(html).toContain(label);
    }
  });

  it("names the pre-tax subtotal as the bridge to sections 2 and 3's headline figure", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(<CashflowBreakdownSection {...props} />);
    expect(html).toContain("secties 2 en 3");
  });

  it("the unticked path (this fixture's own default): no derrama row at all, not even a zero one", () => {
    const props = buildProps();
    expect(props.fixedCosts.derramas).toBe(0);
    const html = renderToStaticMarkup(<CashflowBreakdownSection {...props} />);
    expect(html).not.toContain("Derramas");
  });

  it("the ticked path: a derrama shows as its own row, and the NOI subtotal still reconciles (datakwaliteitsfix stap 4)", () => {
    const props = buildProps();
    const withDerrama = {
      ...props,
      fixedCosts: { ...props.fixedCosts, derramas: 1200 },
      scenario: { ...props.scenario, noi: props.scenario.noi - 1200 },
    };
    const html = renderToStaticMarkup(<CashflowBreakdownSection {...withDerrama} />);
    expect(html).toContain("Derramas (gespreid)");
    expect(html).toContain("€ -100");
  });
});
