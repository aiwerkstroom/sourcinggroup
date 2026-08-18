import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SCORE_RULER_TICKS } from "@/app/rapport/resultaat/_lib/score-ruler-ticks";
import { searchListings } from "@/lib/sourcing/source/source-mock";
import { EXAMPLE_DIMENSIONS, EXAMPLE_PROPERTY, EXAMPLE_TICKS } from "../_components/example-property";
import HomePage from "../page";

/**
 * Golden test for the wervende landing page (LANDING_SPEC.md §8's own
 * "golden test" line, built as step 3 of §9).
 *
 * Three kinds of check, in the order §8 asks for them:
 *
 * 1. RENDER. The five sections of §3 are present, the mandatory
 *    fictional-example label is visible, and the closing CTA points at
 *    /gratis. HomePage is a plain sync Server Component with no data
 *    fetching, so renderToStaticMarkup drives the real thing - the same
 *    technique every section-level golden test in this project uses.
 * 2. NO REAL DATA. §5 forbids the example from being a reused mock
 *    listing or from carrying real anchor points. This file runs in Node,
 *    so it can import both the real listings and the real tick sets and
 *    check the fictional values against them directly - the same
 *    both-sides technique score-ruler-ticks.test.ts already uses to keep
 *    its own hardcoded copy honest. Both checks caught a real collision
 *    when first written (see example-property.ts's docstring); they are
 *    here so the next one is caught too.
 * 3. NO REAL IMPORTS - the formal, repeatable form of the bundle sweep
 *    this project has run by hand after every feature. A structural check
 *    on the source text, in the manner of sieve-yield.test.ts's own
 *    "never touches runEngine" check, plus a scan of the built client
 *    chunks. The structural half is the one with teeth: an import
 *    allowlist makes reaching parameters.ts syntactically impossible,
 *    which no amount of grepping minified output can prove on its own
 *    (identifiers are mangled; only string literals reliably survive).
 *    The chunk scan complements it by catching a leak that arrives
 *    through some path the allowlist does not describe.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

function sourceOf(relativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function importLinesOf(relativePath: string): string[] {
  return sourceOf(relativePath)
    .split("\n")
    .filter((line) => /^\s*import\b/.test(line));
}

describe("the landing page renders all five sections of LANDING_SPEC.md §3", () => {
  const html = renderToStaticMarkup(<HomePage />);

  it("1. hero - opens on the problem, not on the result or the method", () => {
    expect(html).toContain("Een pand kopen in Spanje voelt vaak als een gok.");
  });

  it("2. wat het is / hoe het werkt", () => {
    expect(html).toContain("Hoe het werkt");
    // All three steps, not just the heading.
    expect(html).toContain("1. Pand en cijfers");
    expect(html).toContain("2. TSG rekent door");
    expect(html).toContain("3. U ziet de aannames");
  });

  it("3. voorbeeld - the illustration, with every dimension drawn", () => {
    expect(html).toContain("Een voorbeeld");
    for (const dimension of EXAMPLE_DIMENSIONS) {
      expect(html).toContain(dimension.label);
    }
    // The rulers are really drawn, not just labelled.
    expect((html.match(/data-marker="score"/g) ?? []).length).toBe(EXAMPLE_DIMENSIONS.length);
  });

  it("4. FAQ - within §6's 4-6 range, including the mandatory 'is dit advies' question", () => {
    expect(html).toContain("Veelgestelde vragen");
    const questionCount = (html.match(/<dt/g) ?? []).length;
    expect(questionCount).toBeGreaterThanOrEqual(4);
    expect(questionCount).toBeLessThanOrEqual(6);
    // COMPLIANCE: §6 names this one explicitly, and the answer must be "no".
    expect(html).toContain("Is dit beleggingsadvies?");
    expect(html).toContain("geen persoonlijk beleggingsadvies");
  });

  it("5. sluiting - one soft CTA, no urgency language", () => {
    expect(html).toContain("Begin met een gratis indicatie");
    expect(html).not.toMatch(/start nu|nu beginnen|mis niet|laatste kans/i);
  });
});

describe("the mandatory fictional-example label (LANDING_SPEC.md §5)", () => {
  const html = renderToStaticMarkup(<HomePage />);

  it("is present, in §5's own words", () => {
    expect(html).toContain("Ter illustratie");
    expect(html).toContain("dit is geen echt pand");
  });

  it("sits with the visualisation rather than after it, so it is read first", () => {
    const labelAt = html.indexOf("Ter illustratie");
    const firstRulerAt = html.indexOf('data-marker="score"');
    expect(labelAt).toBeGreaterThan(-1);
    expect(firstRulerAt).toBeGreaterThan(-1);
    expect(labelAt).toBeLessThan(firstRulerAt);
  });

  it("is not hidden in small print - §5 asks for 'goed zichtbaar', not a footnote", () => {
    // The report's own faintest tier (text-text-faint text-xs) is what a
    // footnote uses; this label must not be styled down into it.
    const labelMarkup = html.slice(html.indexOf("<span"), html.indexOf("Ter illustratie"));
    expect(labelMarkup).not.toContain("text-text-faint");
  });
});

describe("the closing CTA (LANDING_SPEC.md §7)", () => {
  const html = renderToStaticMarkup(<HomePage />);

  it("links to /gratis", () => {
    expect(html).toMatch(/<a[^>]*href="\/gratis"[^>]*>[\s\S]*?Gratis indicatie starten/);
  });

  it("is the page's only prominent CTA - the hero's two links stay secondary", () => {
    // §7: "Geen herhaalde CTA's door de pagina heen". The filled accent
    // button style is what marks the one real destination, so it must
    // appear exactly once.
    expect((html.match(/bg-accent /g) ?? []).length).toBe(1);
  });
});

describe("the example is genuinely fictional (LANDING_SPEC.md §5)", () => {
  it("is not a reused mock listing - no listing shares its price", async () => {
    const listings = await searchListings({});
    expect(listings.length).toBeGreaterThan(0); // sanity: we really loaded them
    const prices = listings.map((listing) => listing.priceEUR);
    expect(prices).not.toContain(EXAMPLE_PROPERTY.priceEUR);
  });

  it("is not a reused mock listing - no listing shares its price and built area", async () => {
    const listings = await searchListings({});
    const collision = listings.find(
      (listing) =>
        listing.priceEUR === EXAMPLE_PROPERTY.priceEUR &&
        listing.builtAreaM2 === EXAMPLE_PROPERTY.builtAreaM2,
    );
    expect(collision).toBeUndefined();
  });

  it("carries no real anchor set - its ticks match none of the five real ones", () => {
    for (const [dimension, realTicks] of Object.entries(SCORE_RULER_TICKS)) {
      expect(
        EXAMPLE_TICKS,
        `EXAMPLE_TICKS must not equal ${dimension}'s real anchor positions`,
      ).not.toEqual([...realTicks]);
    }
  });

  it("scores are plain literals in 0-10, not values recomputed from anything", () => {
    for (const dimension of EXAMPLE_DIMENSIONS) {
      expect(dimension.score).toBeGreaterThanOrEqual(0);
      expect(dimension.score).toBeLessThanOrEqual(10);
    }
    expect(EXAMPLE_PROPERTY.totalScore).toBeGreaterThanOrEqual(0);
    expect(EXAMPLE_PROPERTY.totalScore).toBeLessThanOrEqual(10);
  });
});

describe("bundle sweep - the landing page reaches nothing in the calculation layer", () => {
  /**
   * The example's two modules must import nothing at all. That is a
   * stronger claim than "imports nothing forbidden", and it is the claim
   * their own docstrings make - so it is the one checked here.
   */
  it.each([
    "app/_components/example-property.ts",
    "app/_components/example-score-ruler.tsx",
  ])("%s has no import statements at all", (file) => {
    expect(importLinesOf(file)).toEqual([]);
  });

  /**
   * The page itself may import, but only from an allowlist. With this
   * list held, reaching parameters.ts - and with it
   * TSG_SCORE_DIMENSION_WEIGHTS, which UI_SPEC.md §5 never publishes - is
   * not syntactically possible from this route.
   */
  it("app/page.tsx imports only next/link and its own local components", () => {
    const allowed = [
      "next/link",
      "./_components/card",
      "./_components/example-property",
      "./_components/example-score-ruler",
      // HOMEPAGE_UPGRADE_SPEC.md §7 step 1. A client wrapper, but one
      // that takes children as a prop, so it moves no page content into
      // the browser bundle - and it reaches nothing in lib/rules/es
      // itself, which is what this allowlist is guarding.
      "./_components/fade-in",
      // §7 step 2. Client component too, and this one does serialise its
      // items - but they are the page's own public FAQ copy, declared in
      // this file. Same point stands: it reaches nothing in lib/rules/es.
      "./_components/faq-accordion",
    ];

    const lines = importLinesOf("app/page.tsx");
    expect(lines.length).toBeGreaterThan(0); // sanity: it really does import something

    for (const line of lines) {
      const specifier = /from\s+"([^"]+)"/.exec(line)?.[1];
      expect(specifier, `unparsed import line: ${line}`).toBeDefined();
      expect(allowed, `app/page.tsx may not import ${specifier}`).toContain(specifier);
    }
  });

  it.each([
    "app/page.tsx",
    "app/_components/example-property.ts",
    "app/_components/example-score-ruler.tsx",
  ])("%s contains no real parameter, anchor or mock-listing identifier", (file) => {
    const source = sourceOf(file);
    // Stripped of comments first: every one of these files explains in
    // prose precisely which real thing it is avoiding and why, and a
    // naive text scan would fail on the explanation rather than on a
    // genuine reference.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !/^\s*\/\//.test(line))
      .join("\n");

    for (const forbidden of [
      "TSG_SCORE_DIMENSION_WEIGHTS",
      "SCORE_RULER_TICKS",
      "TSG_SCORE_ANCHORS",
      "TSG_SCORE_FEASIBILITY_LEVELS",
      "searchListings",
      "getListingDetail",
      "runEngine",
      "mock-0",
    ]) {
      expect(code, `${file} must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });

  /**
   * The built-output half of the sweep, matching what this project has
   * run by hand after every feature - now pinned so it runs with the
   * suite. Requires a production build, the same precondition (and the
   * same clear error) the route-level golden tests already carry.
   */
  it("the built client chunks carry no engine or score internals", () => {
    const staticDir = path.join(REPO_ROOT, ".next/static");
    if (!existsSync(path.join(REPO_ROOT, ".next/BUILD_ID"))) {
      throw new Error(
        "No production build found (.next/BUILD_ID missing). Run `npm run build` first - " +
          "this sweep scans the built client chunks for leaked calculation-layer internals.",
      );
    }

    const chunks: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith(".js")) chunks.push(full);
      }
    };
    walk(staticDir);
    expect(chunks.length).toBeGreaterThan(0); // sanity: we really found the build output

    // String literals, not identifiers: minification mangles the latter,
    // so only these can be relied on to survive into the output at all.
    const canaries = [
      "TSG_SCORE_DIMENSION_WEIGHTS",
      "TSG_Model_v3",
      "Costs & Income",
      "mock-source.internal",
    ];

    for (const chunk of chunks) {
      const contents = readFileSync(chunk, "utf8");
      for (const canary of canaries) {
        expect(contents, `${path.relative(REPO_ROOT, chunk)} leaks ${canary}`).not.toContain(
          canary,
        );
      }
    }
  });
});
