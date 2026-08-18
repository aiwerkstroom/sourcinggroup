import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SCORE_RULER_TICKS } from "@/app/rapport/resultaat/_lib/score-ruler-ticks";
import { searchListings } from "@/lib/sourcing/source/source-mock";
import {
  EXAMPLE_CASHFLOW_ANCHORS,
  EXAMPLE_DEFAULTS,
  EXAMPLE_DSCR_ANCHORS,
  EXAMPLE_FIXED_DATA_CERTAINTY,
  EXAMPLE_FIXED_FEASIBILITY,
  EXAMPLE_RETURN_ANCHORS,
  EXAMPLE_TICKS,
  EXAMPLE_WIJK_TYPES,
  computeExampleOutcome,
} from "../_components/example-calculator-formula";
import type { ExampleAnchor } from "../_components/example-calculator-formula";
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

/**
 * The formula module keeps its interpolation private, so the signature
 * checks below reimplement it here. That is deliberate rather than
 * awkward: a test that called the module's own helper would agree with it
 * by construction, whereas this compares the published curve against an
 * independent reading of the same anchor table.
 */
function interpolateFictional(anchors: readonly ExampleAnchor[], value: number): number {
  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;
  if (value <= first.input) return first.score;
  if (value >= last.input) return last.score;
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const low = anchors[i]!;
    const high = anchors[i + 1]!;
    if (value >= low.input && value <= high.input) {
      return low.score + ((value - low.input) / (high.input - low.input)) * (high.score - low.score);
    }
  }
  return last.score;
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

  it("3. voorbeeld - the interactive tool, with all five dimensions drawn", () => {
    expect(html).toContain("Een voorbeeld");

    const defaults = computeExampleOutcome(
      EXAMPLE_DEFAULTS.priceEUR,
      EXAMPLE_DEFAULTS.rentPerMonthEUR,
      EXAMPLE_DEFAULTS.wijk,
    );
    for (const dimension of defaults.dimensions) {
      expect(html).toContain(dimension.label);
    }
    // Samuel's decision: all five rulers, including the two that hold
    // still, so the illustration shows the report's real shape.
    expect(defaults.dimensions).toHaveLength(5);
    expect((html.match(/data-marker="score"/g) ?? []).length).toBe(5);

    // The tool renders its default outcome server-side, so the section is
    // not blank before JavaScript arrives.
    expect(html).toContain("fictieve totaalscore");
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

  it("is present, in §4.3's own words", () => {
    expect(html).toContain("Interactief voorbeeld");
    expect(html).toContain("Dit is geen echt pand en geen echte berekening.");
  });

  it("also says the CALCULATION is not real, not only the property", () => {
    // The addition §4.3 gained when the section became interactive. Once
    // someone types their own figures and watches a score move, the risk
    // shifts from "thinks this property exists" to "thinks they now know
    // the method" - and only this sentence addresses that.
    expect(html).toContain("vereenvoudigde demonstratieformule");
    expect(html).toContain("niet uit de methode die het betaalde rapport gebruikt");
  });

  it("sits with the visualisation rather than after it, so it is read first", () => {
    const labelAt = html.indexOf("Interactief voorbeeld");
    const firstRulerAt = html.indexOf('data-marker="score"');
    expect(labelAt).toBeGreaterThan(-1);
    expect(firstRulerAt).toBeGreaterThan(-1);
    expect(labelAt).toBeLessThan(firstRulerAt);
  });

  it("is not hidden in small print - §5 asks for 'goed zichtbaar', not a footnote", () => {
    // The report's own faintest tier (text-text-faint text-xs) is what a
    // footnote uses; this label must not be styled down into it.
    const labelAt = html.indexOf("Interactief voorbeeld");
    const labelMarkup = html.slice(Math.max(0, labelAt - 200), labelAt);
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

describe("the fictional curve collides with no real one (HOMEPAGE_UPGRADE_SPEC.md §4.2/§5)", () => {
  /**
   * The three checks §5 of the design asks for. They run in Node, so they
   * may import the real anchors and compare against them directly - the
   * same both-sides technique score-ruler-ticks.test.ts uses. Their whole
   * purpose is that a future edit which parks a fictional anchor on a real
   * value fails the build instead of quietly shipping.
   */
  const REAL_ANCHORS: Record<string, { input: number; score: number }[]> = {
    // SCORE_SPEC.md §2.1-2.3, transcribed here rather than imported: the
    // spec's tables are the authority, and writing them out is what makes
    // this a comparison rather than a tautology.
    cashflow: [
      { input: -500, score: 0 },
      { input: -250, score: 2 },
      { input: 0, score: 4 },
      { input: 250, score: 6 },
      { input: 500, score: 7.5 },
      { input: 1000, score: 9 },
      { input: 1500, score: 10 },
    ],
    dscr: [
      { input: 0.5, score: 0 },
      { input: 0.75, score: 2.5 },
      { input: 1.0, score: 5 },
      { input: 1.2, score: 7 },
      { input: 1.4, score: 8.5 },
      { input: 1.8, score: 10 },
    ],
    returnVsRequirement: [
      { input: -4, score: 0 },
      { input: -2, score: 2 },
      { input: 0, score: 5 },
      { input: 2, score: 7 },
      { input: 4, score: 8.5 },
      { input: 8, score: 10 },
    ],
  };

  const FICTIONAL: Record<string, readonly ExampleAnchor[]> = {
    cashflow: EXAMPLE_CASHFLOW_ANCHORS,
    dscr: EXAMPLE_DSCR_ANCHORS,
    returnVsRequirement: EXAMPLE_RETURN_ANCHORS,
  };

  // Check 1 - no shared (input, score) pair.
  it.each(Object.keys(FICTIONAL))(
    "%s: no fictional anchor sits on a real (input, score) pair",
    (dimension) => {
      const real = new Set(REAL_ANCHORS[dimension]!.map((a) => `${a.input}:${a.score}`));
      for (const anchor of FICTIONAL[dimension]!) {
        expect(
          real.has(`${anchor.input}:${anchor.score}`),
          `fictional anchor ${anchor.input} -> ${anchor.score} duplicates a real one`,
        ).toBe(false);
      }
    },
  );

  // Check 2 - the signature values differ. These are the three places the
  // real curve is recognisable, so matching any of them would be the leak
  // that matters, whatever the rest of the table looked like.
  it("break-even cashflow scores 4,5 here, not the real 4,0", () => {
    expect(interpolateFictional(EXAMPLE_CASHFLOW_ANCHORS, 0)).toBeCloseTo(4.5, 10);
    expect(interpolateFictional(EXAMPLE_CASHFLOW_ANCHORS, 0)).not.toBeCloseTo(4.0, 10);
  });

  it("DSCR exactly 1,00 scores 4,75 here, not the real 5,0", () => {
    expect(interpolateFictional(EXAMPLE_DSCR_ANCHORS, 1.0)).toBeCloseTo(4.75, 10);
    expect(interpolateFictional(EXAMPLE_DSCR_ANCHORS, 1.0)).not.toBeCloseTo(5.0, 10);
  });

  it("the requirement exactly met scores 5,5 here, not the real 5,0", () => {
    expect(interpolateFictional(EXAMPLE_RETURN_ANCHORS, 0)).toBeCloseTo(5.5, 10);
    expect(interpolateFictional(EXAMPLE_RETURN_ANCHORS, 0)).not.toBeCloseTo(5.0, 10);
  });

  // Check 3 - the endpoints differ. The real dimensions span 0-10; a
  // demonstration that cannot reach either extreme reads as an
  // illustration and can never reproduce the real endpoints.
  it("no fictional anchor reaches 0,0 or 10,0", () => {
    for (const anchors of Object.values(FICTIONAL)) {
      for (const anchor of anchors) {
        expect(anchor.score).toBeGreaterThan(0);
        expect(anchor.score).toBeLessThan(10);
      }
    }
  });

  it("the fictional span is 1,0-9,5, narrower than the real 0,0-10,0", () => {
    const scores = Object.values(FICTIONAL).flatMap((a) => a.map((x) => x.score));
    expect(Math.min(...scores)).toBe(1);
    expect(Math.max(...scores)).toBe(9.5);
  });

  it("the fixed dimensions sit on no real anchor score either", () => {
    // Haalbaarheid is 0/3/7/10 in the real model and dataCertainty's
    // ticks are 0/2/4/6/8/10; 8,0 and 6,5 belong to neither... except 8
    // IS a real dataCertainty tick, so the check that matters is that
    // these are not *scores the real model assigns to a real input*.
    expect(EXAMPLE_FIXED_FEASIBILITY).not.toBe(7);
    expect(EXAMPLE_FIXED_FEASIBILITY).not.toBe(10);
    expect(EXAMPLE_FIXED_DATA_CERTAINTY % 1).not.toBe(0);
  });

  it("the wijk types are categories, colliding with none of the real neighbourhoods", async () => {
    const listings = await searchListings({});
    const realNeighbourhoods = new Set(listings.map((l) => l.neighborhood.toLowerCase()));
    expect(realNeighbourhoods.size).toBeGreaterThan(0); // sanity

    for (const type of EXAMPLE_WIJK_TYPES) {
      expect(realNeighbourhoods.has(type.name.toLowerCase())).toBe(false);
    }
  });

  it("carries no real tick set - its ruler ticks match none of the five real ones", () => {
    for (const [dimension, realTicks] of Object.entries(SCORE_RULER_TICKS)) {
      expect(
        EXAMPLE_TICKS,
        `EXAMPLE_TICKS must not equal ${dimension}'s real anchor positions`,
      ).not.toEqual([...realTicks]);
    }
  });
});

describe("bundle sweep - the landing page reaches nothing in the calculation layer", () => {
  /**
   * The example's two modules must import nothing at all. That is a
   * stronger claim than "imports nothing forbidden", and it is the claim
   * their own docstrings make - so it is the one checked here.
   */
  it.each([
    "app/_components/example-calculator-formula.ts",
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
      "./_components/example-calculator",
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
    "app/_components/example-calculator-formula.ts",
    "app/_components/example-calculator.tsx",
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
