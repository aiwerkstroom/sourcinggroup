import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import { PaidReport } from "@/app/rapport/resultaat/_sections/paid-report";
import HomePage from "../page";

/**
 * Golden test for the rename to Yield & Stone.
 *
 * The rename is deliberately partial, and that is the whole difficulty:
 * every string a customer reads changes, while every internal identifier
 * - TSG_SCORE_ANCHORS, TSG_AUTH_STORE, tsgScore, TsgScoreDimension, the
 * tsg-score-section.tsx filename - stays exactly as it was. A rename that
 * swept those up would have been a refactor of the calculation layer
 * wearing a copy change's clothes.
 *
 * So this file checks both directions:
 *
 *  1. What the customer sees carries the new name and none of the old one
 *     - asserted against real rendered output, not against source text,
 *     because rendered output is what a customer actually gets.
 *  2. The internal vocabulary is still intact - asserted by counting real
 *     identifiers, so a later "tidy-up" that renames them fails here.
 *
 * The paid report is rendered from the reference case, the same fixture
 * every section-level golden test uses.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

const OLD_COMPANY = "The Sourcing Group";
/** Word-boundary "TSG" that is NOT part of an identifier like TSG_SCORE_ANCHORS. */
const OLD_SHORT = /\bTSG\b(?!_)/;

function visibleTextOf(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

describe("what the customer reads carries the new name", () => {
  const homepage = visibleTextOf(renderToStaticMarkup(<HomePage />));
  const report = visibleTextOf(
    renderToStaticMarkup(
      <PaidReport result={runEngine(referenceCase)} />,
    ),
  );

  it("the homepage names Yield & Stone and never the old company name", () => {
    expect(homepage).toContain("Yield & Stone");
    expect(homepage).not.toContain(OLD_COMPANY);
    expect(homepage).not.toMatch(OLD_SHORT);
  });

  it("the homepage's three touchpoints all moved: hero, explainer step, FAQ answers", () => {
    expect(homepage).toContain("Yield & Stone rekent het voor u door");
    expect(homepage).toContain("2. Yield & Stone rekent door");
    expect(homepage).toContain("Nee. Yield & Stone rekent een pand voor u door");
    expect(homepage).toContain("Yield & Stone is gebouwd om internationaal te werken");
  });

  it("the paid report's score section is now the Yield & Stone-score", () => {
    expect(report).toContain("Yield & Stone-score");
    expect(report).not.toMatch(OLD_SHORT);
  });

  it("the report's own source attribution names the new company", () => {
    // ACQUISITION_RATES.source is rendered verbatim in the assumptions
    // section ("Bron: ..., 2025."), so the company vouching for the
    // agency-fee figure is customer-visible text like any other.
    expect(report).toContain("Yield & Stone (agency fee)");
    expect(report).not.toContain(OLD_COMPANY);
  });

  it("the browser tab title carries the new name", () => {
    // Read from source rather than imported: app/layout.tsx calls
    // next/font at module scope, which only works inside a Next build.
    const layout = readFileSync(path.join(REPO_ROOT, "app/layout.tsx"), "utf8");
    expect(layout).toContain('title: "Yield & Stone — Rentabiliteitsrapport"');
    expect(layout).not.toContain(OLD_COMPANY);
  });
});

describe("the internal vocabulary is deliberately untouched", () => {
  /**
   * The other half of the rule. These are code identifiers, not copy;
   * renaming them would touch the calculation layer, which this change
   * explicitly does not do.
   */
  function grepCount(pattern: string): number {
    try {
      const out = execFileSync(
        "grep",
        ["-rho", "--include", "*.ts", "--include", "*.tsx", "-E", pattern, "lib", "app"],
        { cwd: REPO_ROOT, encoding: "utf8" },
      );
      return out.split("\n").filter(Boolean).length;
    } catch {
      return 0; // grep exits 1 on no matches
    }
  }

  it.each([
    "TSG_SCORE_DIMENSION_WEIGHTS",
    "TSG_SCORE_ANCHORS",
    "TSG_AUTH_STORE",
    "TSG_PENDING_STORE",
  ])("%s still exists as an identifier", (identifier) => {
    expect(grepCount(identifier)).toBeGreaterThan(0);
  });

  it("the TsgScore type vocabulary survives in the types, engine and sections", () => {
    expect(grepCount("\\bTsgScore\\b")).toBeGreaterThan(0);
    expect(grepCount("\\bTsgScoreDimension\\b")).toBeGreaterThan(0);
    expect(grepCount("\\btsgScore\\b")).toBeGreaterThan(0);
  });

  it("the score section keeps its tsg- filename, which is not customer-visible", () => {
    expect(
      existsSync(path.join(REPO_ROOT, "app/rapport/resultaat/_sections/tsg-score-section.tsx")),
    ).toBe(true);
  });

  it("the calculation layer's own source was not swept by the rename", () => {
    // One targeted edit only: ACQUISITION_RATES.source, which is rendered
    // to the customer. Everything else in parameters.ts that says TSG is
    // a comment or a `reasoning` string, and `reasoning` is never
    // rendered - assumption-disclosures.ts only ever reads `source`.
    const params = readFileSync(path.join(REPO_ROOT, "lib/rules/es/parameters.ts"), "utf8");
    expect(params).toContain("Yield & Stone (agency fee)");
    expect(params).not.toContain(OLD_COMPANY);
    // The internal modelling notes still say TSG, and should.
    expect(params).toContain("TSG's own 'low leverage' tier definition");
  });
});
