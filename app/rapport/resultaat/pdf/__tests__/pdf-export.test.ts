import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildEngineInput } from "@/app/rapport/nieuw/_lib/build-engine-input";
import type { WizardData } from "@/app/rapport/nieuw/_state/wizard-state";
import { SESSION_COOKIE } from "@/lib/auth/supabase-mock";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import { formatEuro, formatPercent } from "../../_lib/format";

/**
 * Golden test for the PDF export (fase 3): fetches the actual generated
 * PDF through the real pipeline - a running production server, a real
 * headless Chromium, and a real PDF file parsed back to text - for two
 * different sources, one per PDF route:
 *
 * - the reference-case route (GET /rapport/resultaat/pdf, fase 3 stap 1),
 *   checked against the same core figures the section-level golden-render
 *   tests already pin for this case (scenarios-section.test.tsx,
 *   exit-section.test.tsx, tsg-score-section.test.tsx);
 * - the real-data route (POST /rapport/resultaat/pdf/genereer, fase 3
 *   stap 3), fed a second WizardData fixture that differs from the
 *   reference case in every figure, so a bug that only shows up with
 *   non-reference-case data (like the globalThis fix below) cannot hide
 *   behind numbers this file already expects to see.
 *
 * Neither is a markup check like the section tests; this is the one place
 * that proves the whole chain - build input, run engine, render, print,
 * extract - actually produces the report, not just that the React tree
 * looks right.
 *
 * Heavier than the rest of the suite on purpose: it spawns `next start`
 * against the already-built .next output (this is not `next build` - a
 * production build must already exist, the same precondition `npm start`
 * itself has) and launches a real browser to print each PDF. Runs from
 * `npm test` like everything else, just slower.
 *
 * PDF text extraction does not preserve whitespace exactly as typed - the
 * non-breaking space formatEuro() inserts between "€" and the amount can
 * come back as a different whitespace character, and pdf.js separates
 * table cells with a tab rather than the visual gap. Every comparison
 * therefore normalises runs of whitespace to a single space on both
 * sides, rather than asserting an exact byte sequence the way the HTML
 * golden tests can.
 */

const PORT = 3177;
const BASE_URL = `http://localhost:${PORT}`;
const START_TIMEOUT_MS = 20_000;
const TEST_TIMEOUT_MS = 90_000;

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Both PDF routes now sit behind middleware.ts's session check (fase 4
 * stap 4: "alle /rapport/* routes" includes these two, unlike the
 * internal print routes they drive, which stay excluded on purpose - see
 * middleware.ts's own docstring). This test drives them with a raw
 * fetch(), not a browser, so there is no real supabase-mock.ts session to
 * carry - middleware only checks the cookie's presence and shape, so a
 * hand-built cookie in the same format signUp()/signIn() would have set
 * is sufficient without going through either of those functions (which
 * are client-only, document.cookie-based, and unusable from this
 * Node-side test regardless).
 */
function fakeSessionCookieHeader(): string {
  const value = encodeURIComponent(
    JSON.stringify({ id: "pdf-export-test-user", email: "pdf-export-test@example.com" }),
  );
  return `${SESSION_COOKIE}=${value}`;
}

async function waitForServer(deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) return;
    } catch {
      // Not up yet - keep polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Production server did not become ready on ${BASE_URL} in time`);
}

/**
 * A second, self-contained case: a smaller, vacant, longTerm-only,
 * unlicensed property with no cadastral value - different on every axis
 * from the reference case's rented, hybrid, licensed student housing.
 * Deliberately not a good deal (negative cashflow, sub-1 DSCR, negative
 * IRR) - nothing about buildEngineInput()/runEngine() requires a
 * favourable outcome, and a bad one exercises the same code paths.
 */
const secondCase: WizardData = {
  pand: {
    address: "Carrer de Fontanars 8, Valencia",
    neighborhood: "__other__",
    purchasePrice: "220000",
    builtAreaM2: "70",
    usableAreaM2: "60",
    rooms: "4",
    bedrooms: "2",
    bathrooms: "1",
    constructionYear: "1995",
    energyLabel: "D",
  },
  staatEnLasten: {
    maintenanceCondition: "average",
    renovationStrategyOverride: "",
    renovationDurationMonths: "",
    communityFeesAnnual: "700",
    cadastralSuelo: "",
    cadastralConstruccion: "",
    currentRentStatus: "vacant",
    currentRentMonthly: "",
    hasTouristRentalLicense: "no",
    hasUpcomingDerramas: false,
    upcomingDerramasAmount: "",
  },
  belegger: {
    ownMoney: "80000",
    totalBudget: "260000",
    maxRenovationBudget: "20000",
    preferredLtvPercent: "65",
    minLtvPercent: "55",
    maxLtvPercent: "70",
    hasOwnFinancingOffer: false,
    interestRatePercent: "",
    loanTermYears: "",
    maxMonthlyDebt: "700",
    minMonthlyCashflow: "200",
    minRoiTargetPercent: "3",
    holdingYears: "8",
    taxResidency: "netherlands",
    rentalStrategy: "longTerm",
    rentPerM2LongTerm: "14",
    rentPerM2ShortTerm: "",
    rentFromActualCurrentRent: "",
    rentPrefilled: true,
    occupancyLongTermPercent: "",
    occupancyShortTermPercent: "",
  },
  exit: {
    sellingCommissionPercent: "4",
    municipalCapitalGainsTax: "2000",
    plusvaliaPrefilled: true,
  },
  listingOrigin: null,
};

let server: ChildProcessWithoutNullStreams;
let referenceCasePdfText: string;
let secondCasePdfText: string;

beforeAll(async () => {
  const repoRoot = path.resolve(import.meta.dirname, "../../../../..");
  const nextBin = path.join(repoRoot, "node_modules/.bin/next");

  if (!existsSync(path.join(repoRoot, ".next/BUILD_ID"))) {
    throw new Error(
      "No production build found (.next/BUILD_ID missing). Run `npm run build` before " +
        "`npm test` - this golden test drives the PDF export through a real `next start` " +
        "server, the same precondition `npm start` itself has.",
    );
  }

  server = spawn(nextBin, ["start", "-p", String(PORT)], {
    cwd: repoRoot,
    stdio: "pipe",
  });

  await waitForServer(Date.now() + START_TIMEOUT_MS);

  const referenceRes = await fetch(`${BASE_URL}/rapport/resultaat/pdf`, {
    headers: { Cookie: fakeSessionCookieHeader() },
  });
  expect(referenceRes.ok).toBe(true);
  expect(referenceRes.headers.get("content-type")).toBe("application/pdf");
  const referenceBuffer = Buffer.from(await referenceRes.arrayBuffer());
  const referenceParser = new PDFParse({ data: referenceBuffer });
  referenceCasePdfText = normalize((await referenceParser.getText()).text);
  await referenceParser.destroy();

  const secondRes = await fetch(`${BASE_URL}/rapport/resultaat/pdf/genereer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: fakeSessionCookieHeader() },
    body: JSON.stringify(secondCase),
  });
  expect(secondRes.ok).toBe(true);
  expect(secondRes.headers.get("content-type")).toBe("application/pdf");
  const secondBuffer = Buffer.from(await secondRes.arrayBuffer());
  const secondParser = new PDFParse({ data: secondBuffer });
  secondCasePdfText = normalize((await secondParser.getText()).text);
  await secondParser.destroy();
}, TEST_TIMEOUT_MS);

afterAll(() => {
  server?.kill();
});

describe("PDF export - reference case, extracted text against the established golden values", () => {
  it("carries the reference property's address in the header", () => {
    expect(referenceCasePdfText).toContain(normalize(referenceCase.property.address!));
  });

  it("carries the TSG-score and its five dimension scores (tsg-score-section.test.tsx's own golden values)", () => {
    expect(referenceCasePdfText).toContain("3,6");
    expect(referenceCasePdfText).toContain("percentiel 68");
    for (const dimension of ["1,5", "3,3", "6,2", "3,0", "2,4"]) {
      expect(referenceCasePdfText).toContain(dimension);
    }
  });

  it("carries all three scenarios' cashflow, DSCR, IRR and score (scenarios-section.test.tsx's own golden values)", () => {
    const result = runEngine(referenceCase);
    const byId = Object.fromEntries(result.scenarios.map((s) => [s.id, s]));
    expect(byId.conservative!.monthlyCashflow).toBeCloseTo(-799.459411956443, 8);
    expect(byId.base!.monthlyCashflow).toBeCloseTo(-311.138231408102, 8);
    expect(byId.optimistic!.monthlyCashflow).toBeCloseTo(172.05543916912, 8);

    for (const value of ["€ -799", "€ -311", "€ 172"]) {
      expect(referenceCasePdfText).toContain(normalize(value));
    }
    for (const value of ["0,58", "0,83", "1,09", "1,95%", "5,24%", "8,28%", "1,7", "3,6", "5,5"]) {
      expect(referenceCasePdfText).toContain(value);
    }
  });

  it("carries the base scenario's exit figures (exit-section.test.tsx's own reference-case exit)", () => {
    const result = runEngine(referenceCase);
    const base = result.scenarioOutcomes!.find((o) => o.scenario === "base")!;
    const { exit } = base;
    expect(exit.netSaleProceeds).toBeCloseTo(372757.53105462214, 4);

    for (const value of [
      formatEuro(exit.sellingPrice),
      formatEuro(-exit.sellingCommission),
      formatEuro(-exit.capitalGainsTax),
      formatEuro(-exit.mortgageBalanceAtExit),
      formatEuro(exit.netSaleProceeds),
    ]) {
      expect(referenceCasePdfText).toContain(normalize(value));
    }
  });

  it("carries every scenario-year of the ten-year table, including the optimistic scenario the earlier landscape-only attempt clipped", () => {
    const result = runEngine(referenceCase);
    const optimistic = result.scenarioOutcomes!.find((o) => o.scenario === "optimistic")!;
    const yearTen = optimistic.years.find((y) => y.yearNumber === 10)!;
    expect(yearTen.equityBuilt).toBeCloseTo(491787.8464189035, 3);

    expect(referenceCasePdfText).toContain("Optimistisch");
    expect(referenceCasePdfText).toContain(normalize(formatEuro(Math.round(yearTen.equityBuilt))));
  });
});

describe("PDF export - a second, non-reference case through POST /rapport/resultaat/pdf/genereer", () => {
  // Independently derived from secondCase via the same buildEngineInput()
  // + runEngine() the route itself calls - not a re-assertion that the
  // engine is correct (engine.test.ts's own job), but the source of truth
  // for what this specific WizardData should carry all the way through
  // the HTTP + Playwright + PDF pipeline this test actually exercises.
  const engineResult = runEngine(buildEngineInput(secondCase));
  const base = engineResult.scenarioOutcomes!.find((o) => o.scenario === "base")!;
  const baseScenario = engineResult.scenarios.find((s) => s.id === "base")!;

  it("computed the expected, unfavourable outcome for this fixture (sanity check on the fixture itself)", () => {
    expect(base.score!.total).toBeCloseTo(0.4, 6);
    expect(base.percentile).toBe(0);
    expect(baseScenario.monthlyCashflow).toBeCloseTo(-548.8209814572721, 6);
    expect(baseScenario.dscr).toBeCloseTo(0.3583224968394108, 6);
    expect(base.irr.defined && base.irr.irr).toBeCloseTo(-0.019567118379054588, 6);
    expect(base.exit.netSaleProceeds).toBeCloseTo(192962.31366249273, 3);
  });

  it("carries this case's own address, not the reference case's", () => {
    expect(secondCasePdfText).toContain(normalize(secondCase.pand.address));
    expect(secondCasePdfText).not.toContain(normalize(referenceCase.property.address!));
  });

  it("carries this case's own score, percentile, and base-scenario cashflow/DSCR/IRR - none of them reference-case values", () => {
    expect(secondCasePdfText).toContain("0,4");
    expect(secondCasePdfText).toContain("percentiel 0 ");
    expect(secondCasePdfText).toContain(normalize(formatEuro(Math.round(baseScenario.monthlyCashflow))));
    expect(secondCasePdfText).toContain(baseScenario.dscr.toFixed(2).replace(".", ","));
    expect(base.irr.defined).toBe(true);
    expect(secondCasePdfText).toContain(
      normalize(formatPercent(base.irr.defined ? base.irr.irr : 0)),
    );
    // A reference-case figure that would only appear here if the two
    // routes were somehow sharing state (e.g. the globalThis map serving
    // a stale entry to the wrong request).
    expect(secondCasePdfText).not.toContain("€ -311");
  });

  it("carries this case's own exit figures, at its own eight-year holding period (not the reference case's ten)", () => {
    expect(secondCasePdfText).toContain(normalize(formatEuro(base.exit.netSaleProceeds)));
    const yearEight = base.years.find((y) => y.yearNumber === 8)!;
    expect(yearEight.equityBuilt).toBeCloseTo(226534.25361620402, 3);
    expect(secondCasePdfText).toContain(normalize(formatEuro(Math.round(yearEight.equityBuilt))));
    expect(base.years.find((y) => y.yearNumber === 10)).toBeUndefined();
  });
});
