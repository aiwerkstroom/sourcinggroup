import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { describePlaceholderParameter } from "@/lib/copy/es/placeholder-disclosures";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import { PlaceholdersSection } from "../placeholders-section";

/**
 * Golden check against the reference case's base scenario. MODEL_SPEC.md
 * §14 traces which PLACEHOLDER parameters a hybrid/light-renovation
 * outcome rests on; the reference case (hybrid, light, no cadastral value,
 * usableAreaM2 supplied, minRoiTarget supplied) currently produces
 * thirteen - confirmed by calling runEngine() directly rather than
 * hand-copying MODEL_SPEC.md's own (older, pre-cadastral-value-feature)
 * count, so this test tracks the engine's actual behaviour.
 */
function buildProps() {
  const result = runEngine(referenceCase);
  const outcome = result.scenarioOutcomes!.find((o) => o.scenario === "base")!;
  return { placeholdersUsed: outcome.placeholdersUsed };
}

const EXPECTED_NAMES = [
  "MAINTENANCE_RATE",
  "BANK_FEE",
  "BASE_OCCUPANCY_LONG_TERM",
  "BASE_OCCUPANCY_SHORT_TERM",
  "RENOVATION_STRATEGIES.light.capex",
  "RENOVATION_STRATEGIES.light.rentMultiplier",
  "RENOVATION_STRATEGIES.light.maintenanceFactor",
  "RENOVATION_STRATEGIES.light.utilitiesEfficiency",
  "RENOVATION_STRATEGIES.light.timeToRentMonths",
  "DEPRECIATION_SCENARIO_FACTORS.base",
  "DEFAULT_BUILDING_SHARE_OF_VALUE",
  "DEFAULT_RENOVATION_IMPROVEMENT_SHARE",
  "DEFAULT_CADASTRAL_TO_PURCHASE_PRICE_RATIO",
];

describe("PlaceholdersSection - golden data against the reference case", () => {
  it("the reference case's base scenario rests on exactly these thirteen PLACEHOLDER parameters", () => {
    const { placeholdersUsed } = buildProps();
    expect(placeholdersUsed).toHaveLength(EXPECTED_NAMES.length);
    expect(placeholdersUsed.map((p) => p.name).sort()).toEqual([...EXPECTED_NAMES].sort());
    for (const param of placeholdersUsed) {
      expect(param.provenance).toBe("PLACEHOLDER");
    }
  });

  it("describePlaceholderParameter() has Dutch copy for every one of them, with no leftover parameter name", () => {
    const { placeholdersUsed } = buildProps();
    for (const param of placeholdersUsed) {
      const sentence = describePlaceholderParameter(param);
      expect(sentence.length).toBeGreaterThan(0);
      expect(sentence).not.toContain(param.name);
      // No raw parameter-name vocabulary (upper-snake-case tokens) leaks
      // into the customer-facing sentence.
      expect(sentence).not.toMatch(/[A-Z_]{4,}/);
    }
  });
});

describe("PlaceholdersSection - rendered against the reference case", () => {
  it("renders one list item per placeholder, all thirteen present", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(<PlaceholdersSection {...props} />);

    expect((html.match(/<li/g) ?? []).length).toBe(13);
    for (const param of props.placeholdersUsed) {
      expect(html).toContain(describePlaceholderParameter(param));
    }
  });

  it("frames the section as content, not a disclaimer, and never prints raw parameter names", () => {
    const props = buildProps();
    const html = renderToStaticMarkup(<PlaceholdersSection {...props} />);

    expect(html).toContain("Wat niet geverifieerd is");
    for (const name of EXPECTED_NAMES) {
      expect(html).not.toContain(name);
    }
  });

  it("renders an explicit 'no placeholders' sentence rather than an empty section when the list is empty", () => {
    const html = renderToStaticMarkup(<PlaceholdersSection placeholdersUsed={[]} />);
    expect(html).not.toContain("<li");
    expect(html).toContain("geen enkele niet-geverifieerde");
  });
});
