import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import { formatEuro } from "../../_lib/format";
import { ExitSection } from "../exit-section";

/**
 * Golden-render check against the reference case's base scenario exit
 * (MODEL_SPEC_FASE1B §5's own worked figures, also anchored in
 * exit.test.ts). All six of this section's rows: sellingPrice,
 * sellingCommission, municipalCapitalGainsTax, capitalGainsTax,
 * mortgageBalanceAtExit, netSaleProceeds.
 */
function buildExit() {
  const result = runEngine(referenceCase);
  const outcome = result.scenarioOutcomes!.find((o) => o.scenario === "base")!;
  return outcome.exit;
}

describe("ExitSection - golden render against the reference case", () => {
  it("computes the six golden values before rendering, so the test itself is pinned", () => {
    const exit = buildExit();

    expect(exit.sellingPrice).toBeCloseTo(537535.226836556, 4);
    expect(exit.sellingCommission).toBeCloseTo(21501.40907346224, 4);
    expect(exit.municipalCapitalGainsTax).toBe(3500);
    expect(exit.capitalGainsTax).toBeCloseTo(40449.82537498781, 4);
    expect(exit.mortgageBalanceAtExit).toBeCloseTo(100266.96133348384, 4);
    expect(exit.netSaleProceeds).toBeCloseTo(371817.03105462214, 4);

    // The engine's own formula (exit.ts) - netSaleProceeds is not a second,
    // independently-derived figure.
    expect(exit.netSaleProceeds).toBeCloseTo(
      exit.sellingPrice -
        exit.sellingCommission -
        exit.municipalCapitalGainsTax -
        exit.capitalGainsTax -
        exit.mortgageBalanceAtExit,
      6,
    );
  });

  it("renders all six values as Dutch-formatted euro amounts", () => {
    const exit = buildExit();
    const html = renderToStaticMarkup(<ExitSection exit={exit} />);

    // Compared against formatEuro's own output, not a hand-typed literal:
    // Intl inserts a non-breaking space (U+00A0) after "€" that does not
    // survive being typed and saved as source text in this environment.
    expect(html).toContain(formatEuro(exit.sellingPrice));
    expect(html).toContain(formatEuro(-exit.sellingCommission));
    expect(html).toContain(formatEuro(-exit.municipalCapitalGainsTax));
    expect(html).toContain(formatEuro(-exit.capitalGainsTax));
    expect(html).toContain(formatEuro(-exit.mortgageBalanceAtExit));
    expect(html).toContain(formatEuro(exit.netSaleProceeds));

    // And independently, the literal digit groups so the test still fails
    // if formatEuro's own rounding silently changed.
    expect(html).toMatch(/537\.535/);
    expect(html).toMatch(/-21\.501/);
    expect(html).toMatch(/-3\.500/);
    expect(html).toMatch(/-40\.450/);
    expect(html).toMatch(/-100\.267/);
    expect(html).toMatch(/371\.817/);
  });

  it("renders every row with its own label - no merging", () => {
    const exit = buildExit();
    const html = renderToStaticMarkup(<ExitSection exit={exit} />);

    for (const label of [
      "Verkoopwaarde",
      "Verkoopcourtage",
      "Plusvalía municipal",
      "Vermogenswinstbelasting",
      "Restschuld hypotheek",
      "Netto verkoopopbrengst",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("10 jaar");
  });
});
