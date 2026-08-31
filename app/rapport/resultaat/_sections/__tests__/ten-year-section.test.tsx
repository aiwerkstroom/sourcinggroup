import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import type { ScenarioId } from "@/lib/rules/es/types";
import { TenYearSection, TenYearTable } from "../ten-year-section";

/**
 * Golden fixture: all 30 scenario-years (conservative/base/optimistic x
 * year 1-10) of the reference case, computed independently of this
 * component (a standalone script running runEngine(referenceCase) and
 * printing ScenarioOutcome.years verbatim) and pasted here as literal
 * numbers - the same anchoring scenarios-section.test.tsx and
 * cashflow-breakdown-section.test.tsx already use. `extrapolated` is
 * false for years 1-5 (2026-2030, within the sourced Correction Factors
 * series) and true for years 6-10 (2031-2035), independently confirming
 * UI_SPEC.md §6.5's "jaar 5 gemarkeerd, geëxtrapoleerde jaren aangeduid"
 * boundary sits where this section says it does.
 */
const GOLDEN: Record<
  ScenarioId,
  Array<{
    yearNumber: number;
    extrapolated: boolean;
    grossIncome: number;
    noi: number;
    cashflowAfterTax: number;
    mortgageBalance: number;
    equityBuilt: number;
  }>
> = {
  conservative: [
    { yearNumber: 1, extrapolated: false, grossIncome: 13438.240200000002, noi: 4600.696908000002, cashflowAfterTax: -18424.356503477706, mortgageBalance: 235858.79956344826, equityBuilt: 107341.20043655174 },
    { yearNumber: 2, extrapolated: false, grossIncome: 24188.832360000004, noi: 14320.467045528003, cashflowAfterTax: -8741.853319704018, mortgageBalance: 223658.52123563373, equityBuilt: 133269.47876436633 },
    { yearNumber: 3, extrapolated: false, grossIncome: 25156.385654400005, noi: 15044.017643136893, cashflowAfterTax: -8279.930118386827, mortgageBalance: 210872.31485705602, equityBuilt: 160332.80514294404 },
    { yearNumber: 4, extrapolated: false, grossIncome: 26036.859152304, noi: 15692.056118030347, cashflowAfterTax: -7884.164017397531, mortgageBalance: 197472.04076799203, equityBuilt: 188581.28403200803 },
    { yearNumber: 5, extrapolated: false, grossIncome: 26817.964926873126, noi: 16245.436344592152, cashflowAfterTax: -7570.923848481821, mortgageBalance: 183428.20787922444, equityBuilt: 218067.2499127756 },
    { yearNumber: 6, extrapolated: true, grossIncome: 27622.50387467932, noi: 16817.07034881123, cashflowAfterTax: -7249.024962732127, mortgageBalance: 168709.9087685675, equityBuilt: 248845.36733511253 },
    { yearNumber: 7, extrapolated: true, grossIncome: 28451.178990919703, noi: 17407.538791434505, cashflowAfterTax: -6918.284140762358, mortgageBalance: 153284.75166035187, equityBuilt: 280972.7354874754 },
    { yearNumber: 8, extrapolated: true, grossIncome: 29304.7143606473, noi: 18017.44041397966, cashflowAfterTax: -6578.517164113591, mortgageBalance: 137118.7891381706, equityBuilt: 314508.99749556987 },
    { yearNumber: 9, extrapolated: true, grossIncome: 30183.855791466718, noi: 18647.392594377212, cashflowAfterTax: -6229.539017708513, mortgageBalance: 120176.44343399763, equityBuilt: 349516.4546650924 },
    { yearNumber: 10, extrapolated: true, grossIncome: 31089.371465210723, noi: 19298.03191954625, cashflowAfterTax: -5871.164109870654, mortgageBalance: 102420.42812925737, equityBuilt: 386060.18589379627 },
  ],
  base: [
    { yearNumber: 1, extrapolated: false, grossIncome: 16590.420000000002, noi: 7631.650400000002, cashflowAfterTax: -14635.93477689696, mortgageBalance: 235396.18005784432, equityBuilt: 111103.81994215568 },
    { yearNumber: 2, extrapolated: false, grossIncome: 29862.756, noi: 19674.305728, cashflowAfterTax: -3737.309528004759, mortgageBalance: 222774.09866627472, equityBuilt: 141050.90133372528 },
    { yearNumber: 3, extrapolated: false, grossIncome: 31057.266240000004, noi: 20609.467123168004, cashflowAfterTax: -3094.1751604869705, mortgageBalance: 209611.5649028194, equityBuilt: 172404.68509718066 },
    { yearNumber: 4, extrapolated: false, grossIncome: 32144.2705584, noi: 21450.246739743357, cashflowAfterTax: -2531.564791931906, mortgageBalance: 195885.43767392848, equityBuilt: 205231.62482607158 },
    { yearNumber: 5, extrapolated: false, grossIncome: 33108.598675152, noi: 22174.97896367551, cashflowAfterTax: -2067.7646489880117, mortgageBalance: 181571.5850305418, equityBuilt: 239601.33059445833 },
    { yearNumber: 6, extrapolated: true, grossIncome: 34101.85663540657, noi: 22923.077650760424, cashflowAfterTax: -1590.0503673795843, mortgageBalance: 166644.84174163063, equityBuilt: 275586.7196646195 },
    { yearNumber: 7, extrapolated: true, grossIncome: 35124.91233446877, noi: 23695.276284821375, cashflowAfterTax: -1098.0371810198603, mortgageBalance: 151078.96505112303, equityBuilt: 313264.1744254397 },
    { yearNumber: 8, extrapolated: true, grossIncome: 36178.65970450283, noi: 24492.331003994914, cashflowAfterTax: -591.3308324696409, mortgageBalance: 134846.5885404285, equityBuilt: 352713.7079099623 },
    { yearNumber: 9, extrapolated: true, grossIncome: 37264.01949563792, noi: 25315.021293356243, cashflowAfterTax: -69.52738910896323, mortgageBalance: 117919.17401544841, equityBuilt: 394019.1372574619 },
    { yearNumber: 10, extrapolated: true, grossIncome: 38381.94008050706, noi: 26164.15069858324, cashflowAfterTax: 467.7869416239473, mortgageBalance: 100266.96133348384, equityBuilt: 437268.2655030722 },
  ],
  optimistic: [
    { yearNumber: 1, extrapolated: false, grossIncome: 20074.40820000001, noi: 10767.300162000007, cashflowAfterTax: -11127.088689970431, mortgageBalance: 235160.04723738314, equityBuilt: 114639.95276261686 },
    { yearNumber: 2, extrapolated: false, grossIncome: 36133.93476000001, noi: 25372.63917879601, cashflowAfterTax: 1220.3583850542118, mortgageBalance: 222323.7443154121, equityBuilt: 148464.25568458796 },
    { yearNumber: 3, extrapolated: false, grossIncome: 37579.29215040001, noi: 26537.085781155525, cashflowAfterTax: 2054.382917976804, mortgageBalance: 208971.12653199828, equityBuilt: 184064.1534680018 },
    { yearNumber: 4, extrapolated: false, grossIncome: 38894.56737566401, noi: 27586.421728454156, cashflowAfterTax: 2791.5278961876043, mortgageBalance: 195081.42614445387, equityBuilt: 221535.97065554623 },
    { yearNumber: 5, extrapolated: false, grossIncome: 40061.40439693393, noi: 28495.980182879346, cashflowAfterTax: 3411.1330903236617, mortgageBalance: 180633.04006877422, equityBuilt: 260981.40053922587 },
    { yearNumber: 6, extrapolated: true, grossIncome: 41263.246528841955, noi: 29434.464706988732, cashflowAfterTax: 4049.678978638214, mortgageBalance: 165603.49627968727, equityBuilt: 302507.81076479284 },
    { yearNumber: 7, extrapolated: true, grossIncome: 42501.14392470722, noi: 30402.775869193858, cashflowAfterTax: 4707.718887180736, mortgageBalance: 149969.4188592128, equityBuilt: 346228.56660793617 },
    { yearNumber: 8, extrapolated: true, grossIncome: 43776.17824244844, noi: 31401.84191068504, cashflowAfterTax: 5385.821561170658, mortgageBalance: 133706.4916393681, equityBuilt: 392263.3729558098 },
    { yearNumber: 9, extrapolated: true, grossIncome: 45089.4635897219, noi: 32432.619588729274, cashflowAfterTax: 6084.571568454747, mortgageBalance: 116789.420382474, equityBuilt: 440738.6360884147 },
    { yearNumber: 10, extrapolated: true, grossIncome: 46442.147497413556, noi: 33496.095045529306, cashflowAfterTax: 6804.569712457703, mortgageBalance: 99191.8934402385, equityBuilt: 491787.8464189035 },
  ],
};

function outcomesFromReferenceCase() {
  const result = runEngine(referenceCase);
  return result.scenarioOutcomes!;
}

describe("TenYearSection - golden data against the reference case", () => {
  it("matches all 30 scenario-years on every field EngineResult carries", () => {
    const outcomes = outcomesFromReferenceCase();
    const byId = Object.fromEntries(outcomes.map((o) => [o.scenario, o])) as Record<
      ScenarioId,
      (typeof outcomes)[number]
    >;

    for (const scenario of ["conservative", "base", "optimistic"] as const) {
      const golden = GOLDEN[scenario];
      const years = byId[scenario].years;
      expect(years).toHaveLength(10);

      golden.forEach((expected, i) => {
        const actual = years[i]!;
        expect(actual.yearNumber).toBe(expected.yearNumber);
        expect(actual.extrapolated).toBe(expected.extrapolated);
        expect(actual.grossIncome).toBeCloseTo(expected.grossIncome, 4);
        expect(actual.noi).toBeCloseTo(expected.noi, 4);
        expect(actual.cashflowAfterTax).toBeCloseTo(expected.cashflowAfterTax, 4);
        expect(actual.mortgageBalance).toBeCloseTo(expected.mortgageBalance, 3);
        expect(actual.equityBuilt).toBeCloseTo(expected.equityBuilt, 3);
      });
    }
  });

  it("years 1-5 are not extrapolated and years 6-10 are, for every scenario", () => {
    const outcomes = outcomesFromReferenceCase();
    for (const outcome of outcomes) {
      for (const year of outcome.years) {
        expect(year.extrapolated).toBe(year.yearNumber > 5);
      }
    }
  });
});

describe("TenYearTable - rendered against the reference case", () => {
  it("renders 10 body rows, 3 scenario column groups, and marks year 5 and years 6-10", () => {
    const outcomes = outcomesFromReferenceCase();
    const html = renderToStaticMarkup(<TenYearTable outcomes={outcomes} />);

    // Two header rows (scenario group labels + metric labels) + 10 year rows.
    expect((html.match(/<tr/g) ?? []).length).toBe(12);
    // 15 metric columns (5 per scenario x 3 scenarios) in the second header row.
    expect((html.match(/Bruto huur/g) ?? []).length).toBe(3);
    expect((html.match(/Cashflow na belasting/g) ?? []).length).toBe(3);
    expect((html.match(/Eigen vermogen opgebouwd/g) ?? []).length).toBe(3);

    expect(html).toContain(">5</span>");
    expect(html.match(/underline/g)?.length).toBeGreaterThan(0);
    // Exactly 5 rows (years 6-10) carry the extrapolated marker - matched
    // by its distinguishing class so the footnote's own example "e" (which
    // explains what the marker means) is not double-counted.
    expect((html.match(/ml-1 text-xs italic">e<\/span>/g) ?? []).length).toBe(5);
  });

  it("renders sample formatted euro figures from the golden fixture", () => {
    const outcomes = outcomesFromReferenceCase();
    const html = renderToStaticMarkup(<TenYearTable outcomes={outcomes} />);

    // Base scenario, year 1: grossIncome 16.590,42 -> rounded to whole euros
    // (was 23.700,60 before fase C stap 2's renovation vacancy).
    expect(html).toContain("€ 16.590");
    // Optimistic, year 10: cashflowAfterTax 6.804,57 - year 10 is untouched.
    expect(html).toContain("€ 6.805");
    // Conservative, year 1: cashflowAfterTax -18.424,36.
    expect(html).toContain("€ -18.424");
  });
});

describe("CashflowChart - the section's chart against the reference case", () => {
  /**
   * The chart moved from three overlaid lines to three stacked panels
   * tinted by sign, so the markup it is asserted through changed. What
   * did NOT change, and is the part worth keeping, is the golden claim:
   * all thirty scenario-years must reach the chart as monthly cashflow,
   * matching the independently computed fixture above.
   */
  const chartHtml = () =>
    renderToStaticMarkup(<TenYearSection outcomes={outcomesFromReferenceCase()} />);

  it("draws one panel per scenario, in report order", () => {
    const panels = [...chartHtml().matchAll(/data-cashflow-panel="([^"]+)"/g)].map((m) => m[1]);
    // Two variants render (interactive + static), so each panel appears twice.
    expect(panels).toEqual([
      "Conservatief",
      "Basis",
      "Optimistisch",
      "Conservatief",
      "Basis",
      "Optimistisch",
    ]);
  });

  it("carries all 30 scenario-years as monthly cashflow, matching the fixture", () => {
    const html = chartHtml();
    const points = [
      ...html.matchAll(/data-cashflow-point="([^"]+)" data-year="([^"]+)" data-value="([^"]+)"/g),
    ];
    // 30 per variant, both variants rendered.
    expect(points).toHaveLength(60);

    const byKey = new Map(points.map((m) => [`${m[1]}`, Number.parseFloat(m[3]!)] as const));
    const LABEL = { conservative: "Conservatief", base: "Basis", optimistic: "Optimistisch" };

    for (const scenario of ["conservative", "base", "optimistic"] as const) {
      for (const expected of GOLDEN[scenario]) {
        const value = byKey.get(`${LABEL[scenario]}-${expected.yearNumber}`);
        expect(value, `${scenario} year ${expected.yearNumber}`).toBeDefined();
        // Monthly, matching sections 2 and 3 rather than the table's annual columns.
        expect(value).toBeCloseTo(expected.cashflowAfterTax / 12, 6);
      }
    }
  });

  it("marks the zero line in every panel - the reference the whole chart is read against", () => {
    const html = chartHtml();
    // Three panels x two variants.
    expect((html.match(/data-cashflow-zero=""/g) ?? []).length).toBe(6);
    expect(html).toContain("€ 0");
  });

  it("tints below and above the line differently, which is what shows the crossover", () => {
    const html = chartHtml();
    const negatives = (html.match(/data-cashflow-fill="negative"/g) ?? []).length;
    const positives = (html.match(/data-cashflow-fill="positive"/g) ?? []).length;
    // The reference case crosses in base (year 10) and optimistic (year 2)
    // and never in conservative, so both tints must be present.
    expect(negatives).toBeGreaterThan(0);
    expect(positives).toBeGreaterThan(0);
  });

  it("shows where the sourced years end, because the base crossover sits past that line", () => {
    // Base turns positive in year 10, which is extrapolated. A reader who
    // took that for measured data would over-read it, so the boundary and
    // the dashed continuation are part of the chart rather than only a
    // footnote under the table.
    const html = chartHtml();
    expect((html.match(/data-cashflow-boundary=""/g) ?? []).length).toBe(6);
    expect((html.match(/data-cashflow-extrapolated=""/g) ?? []).length).toBe(6);
  });

  it("spends no signal colour - section 7's badges stay the only pass/fail colour", () => {
    const html = chartHtml();
    const chartOnly = html.slice(html.indexOf("data-cashflow-chart"), html.indexOf("<table"));
    expect(chartOnly).not.toContain("--color-signal-positive");
    expect(chartOnly).not.toContain("--color-signal-negative");
    expect(chartOnly).not.toContain("--color-signal-neutral");
  });

  it("uses no gold as a data colour", () => {
    expect(chartHtml()).not.toContain("--color-highlight");
  });
});

describe("TenYearSection - composes the table and the chart under one heading", () => {
  it("renders the section heading once, with both parts present", () => {
    const outcomes = outcomesFromReferenceCase();
    const html = renderToStaticMarkup(<TenYearSection outcomes={outcomes} />);

    expect(html).toContain("De tienjarige reeks");
    // Two table shapes for two audiences (fase 3's print checkpoint): one
    // wide, print:hidden screen table with all three scenarios side by
    // side, and three narrow, hidden print:block per-scenario tables that
    // replace it only when printing. "One table" no longer holds; "one of
    // each shape" does.
    expect((html.match(/<table class="w-full min-w-4xl/g) ?? []).length).toBe(1);
    expect((html.match(/<table class="w-full max-w-lg/g) ?? []).length).toBe(3);
    // One chart per medium (interactive on screen, static in print), each
    // one <svg>. The old three-overlaid-lines chart is gone.
    expect((html.match(/<svg/g) ?? []).length).toBe(2);
    expect((html.match(/data-cashflow-chart="interactive"/g) ?? []).length).toBe(1);
    expect((html.match(/data-cashflow-chart="static"/g) ?? []).length).toBe(1);
  });

  it("puts the chart above the table, so the story is read before the detail", () => {
    const html = renderToStaticMarkup(<TenYearSection outcomes={outcomesFromReferenceCase()} />);
    expect(html.indexOf("data-cashflow-chart")).toBeGreaterThan(-1);
    expect(html.indexOf("data-cashflow-chart")).toBeLessThan(html.indexOf("<table"));
  });
});

/**
 * The table is this chart's text alternative AND the only place four of
 * its five metrics appear anywhere in the report: gross rent and NOI
 * exist elsewhere only as a single steady-state year (section 4), the
 * mortgage balance only as its exit value (section 6), and equity built
 * in no other section at all. Adding a chart above it must not become a
 * licence to thin it out later - so this pins every column, every figure
 * and both markers, in both table shapes.
 *
 * Same pattern as the FAQ's no-roadmap-claim guard: it asserts what must
 * still be there, so a refactor that quietly drops it fails loudly.
 */
describe("TenYearSection - no table column may silently disappear", () => {
  const html = renderToStaticMarkup(<TenYearSection outcomes={outcomesFromReferenceCase()} />);
  const screenTable = html.slice(
    html.indexOf('<table class="w-full min-w-4xl'),
    html.indexOf('<table class="w-full max-w-lg'),
  );
  const printTables = html.slice(html.indexOf('<table class="w-full max-w-lg'));

  const COLUMNS = [
    "Bruto huur",
    "NOI",
    "Cashflow na belasting",
    "Hypotheekschuld",
    "Eigen vermogen opgebouwd",
  ] as const;

  it.each(COLUMNS)("keeps the %s column in both table shapes", (column) => {
    // Three scenario groups side by side on screen; one per stacked table in print.
    expect((screenTable.match(new RegExp(column, "g")) ?? []).length).toBe(3);
    expect((printTables.match(new RegExp(column, "g")) ?? []).length).toBe(3);
  });

  it("still renders all 150 figures per table shape - 3 scenarios x 10 years x 5 metrics", () => {
    const cells = (markup: string) =>
      (markup.match(/class="tabular px-4 py-3 text-right"/g) ?? []).length;
    expect(cells(screenTable)).toBe(150);
    expect(cells(printTables)).toBe(150);
  });

  it("keeps year 5's underline and the extrapolated 'e' markers in the table", () => {
    // Deliberately still the table's own markers: the chart draws the same
    // boundary in its own idiom (dashed divider + dashed line), it does not
    // take these over.
    expect((screenTable.match(/underline decoration-1/g) ?? []).length).toBe(1);
    expect((printTables.match(/underline decoration-1/g) ?? []).length).toBe(3);
    expect((screenTable.match(/ml-1 text-xs italic">e<\/span>/g) ?? []).length).toBe(5);
    expect((printTables.match(/ml-1 text-xs italic">e<\/span>/g) ?? []).length).toBe(15);
  });

  it("keeps the footnote that explains both markers", () => {
    expect(html).toContain("Correction Factors");
    expect(html).toContain("geëxtrapoleerd");
  });
});
