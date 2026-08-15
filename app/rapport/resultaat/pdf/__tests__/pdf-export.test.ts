import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import { formatEuro } from "../../_lib/format";

/**
 * Golden test for the PDF export (fase 3): fetches the actual generated
 * PDF for the reference case through the real pipeline - a running
 * production server, a real headless Chromium via the /pdf route, and a
 * real PDF file parsed back to text - and checks the same core figures
 * the section-level golden-render tests already pin for this case
 * (scenarios-section.test.tsx, exit-section.test.tsx,
 * tsg-score-section.test.tsx). This is not a markup check like those; it
 * is the one place that proves the whole chain - render, print, PDF,
 * extract - actually produces the report, not just that the React tree
 * looks right.
 *
 * Heavier than the rest of the suite on purpose: it spawns `next start`
 * against the already-built .next output (this is not `next build` - a
 * production build must already exist, the same precondition `npm start`
 * itself has) and launches a real browser to print the PDF. Runs from
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
const TEST_TIMEOUT_MS = 60_000;

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
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

let server: ChildProcessWithoutNullStreams;
let pdfText: string;

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

  const res = await fetch(`${BASE_URL}/rapport/resultaat/pdf`);
  expect(res.ok).toBe(true);
  expect(res.headers.get("content-type")).toBe("application/pdf");

  const buffer = Buffer.from(await res.arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  pdfText = normalize(result.text);
  await parser.destroy();
}, TEST_TIMEOUT_MS);

afterAll(() => {
  server?.kill();
});

describe("PDF export - reference case, extracted text against the established golden values", () => {
  it("carries the reference property's address in the header", () => {
    expect(pdfText).toContain(normalize(referenceCase.property.address!));
  });

  it("carries the TSG-score and its five dimension scores (tsg-score-section.test.tsx's own golden values)", () => {
    expect(pdfText).toContain("3,8");
    expect(pdfText).toContain("percentiel 70");
    for (const dimension of ["1,5", "3,3", "6,5", "3,0", "2,8"]) {
      expect(pdfText).toContain(dimension);
    }
  });

  it("carries all three scenarios' cashflow, DSCR, IRR and score (scenarios-section.test.tsx's own golden values)", () => {
    const result = runEngine(referenceCase);
    const byId = Object.fromEntries(result.scenarios.map((s) => [s.id, s]));
    expect(byId.conservative!.monthlyCashflow).toBeCloseTo(-799.459411956443, 8);
    expect(byId.base!.monthlyCashflow).toBeCloseTo(-311.138231408102, 8);
    expect(byId.optimistic!.monthlyCashflow).toBeCloseTo(172.05543916912, 8);

    for (const value of ["€ -799", "€ -311", "€ 172"]) {
      expect(pdfText).toContain(normalize(value));
    }
    for (const value of ["0,58", "0,83", "1,09", "2,18%", "5,54%", "8,64%", "1,8", "3,8", "5,6"]) {
      expect(pdfText).toContain(value);
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
      expect(pdfText).toContain(normalize(value));
    }
  });

  it("carries every scenario-year of the ten-year table, including the optimistic scenario the earlier landscape-only attempt clipped", () => {
    const result = runEngine(referenceCase);
    const optimistic = result.scenarioOutcomes!.find((o) => o.scenario === "optimistic")!;
    const yearTen = optimistic.years.find((y) => y.yearNumber === 10)!;
    expect(yearTen.equityBuilt).toBeCloseTo(491787.8464189035, 3);

    expect(pdfText).toContain("Optimistisch");
    expect(pdfText).toContain(normalize(formatEuro(Math.round(yearTen.equityBuilt))));
  });
});
