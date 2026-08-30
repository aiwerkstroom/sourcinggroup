import { execFileSync, spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Browser } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Golden test for the two-family typography (DESIGN_SPEC.md §2): Space
 * Grotesk on headings and the wordmark, Inter on everything that is read
 * or counted.
 *
 * Driven by a real browser against a production build, and asserting on
 * COMPUTED styles rather than on class names or CSS source. That choice
 * is the whole point of the file: the split is enforced by a bare
 * element selector in globals.css (h1, h2, h3), so what matters is not
 * that a rule exists but that it actually wins on the real page, against
 * Tailwind's own resets and every component's own classes. A source-level
 * check would pass just as happily if the rule were being overridden.
 *
 * The report page is the one under test because it is where both halves
 * meet: section headings above, and the numeric tables whose alignment
 * depends on Inter's tabular-nums directly below them. If the two
 * families were ever going to bleed into each other, it would show here.
 */

const PORT = 3193;
const BASE_URL = `http://localhost:${PORT}`;
const START_TIMEOUT_MS = 25_000;
const TEST_TIMEOUT_MS = 60_000;
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

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
let browser: Browser;

beforeAll(async () => {
  const nextBin = path.join(REPO_ROOT, "node_modules/.bin/next");
  if (!existsSync(path.join(REPO_ROOT, ".next/BUILD_ID"))) {
    throw new Error(
      "No production build found (.next/BUILD_ID missing). Run `npm run build` first - " +
        "this golden test reads computed font families from a real rendered page.",
    );
  }
  server = spawn(nextBin, ["start", "-p", String(PORT)], {
    cwd: REPO_ROOT,
    stdio: "pipe",
    env: { ...process.env, TSG_AUTH_STORE: "memory" },
  });
  await waitForServer(Date.now() + START_TIMEOUT_MS);
  browser = await chromium.launch();
}, TEST_TIMEOUT_MS);

afterAll(async () => {
  await browser?.close();
  server?.kill();
});

/** The computed font-family of the first element matching a selector. */
async function familyOf(url: string, selector: string): Promise<string> {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  const family = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el === null) return "__NO_SUCH_ELEMENT__";
    return getComputedStyle(el).fontFamily;
  }, selector);
  await page.close();
  return family;
}

describe("headings render in Space Grotesk", () => {
  it(
    "the homepage h1 and h2 both resolve to the heading face",
    async () => {
      for (const selector of ["h1", "h2"]) {
        const family = await familyOf(BASE_URL, selector);
        expect(family, `${selector} on the homepage`).toContain("Space Grotesk");
        expect(family, `${selector} must not fall back to Inter`).not.toMatch(/^Inter/);
      }
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "the report's section headings resolve to it too - the split holds outside the marketing pages",
    async () => {
      const family = await familyOf(`${BASE_URL}/rapport/resultaat/print`, "h2");
      expect(family).toContain("Space Grotesk");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "the wordmark carries it explicitly, without being a heading element",
    async () => {
      const page = await browser.newPage();
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      const nav = page.getByRole("navigation", { name: "Hoofdnavigatie" });
      const brandLink = nav.getByRole("link", { name: "Yield & Stone" });
      expect(await brandLink.count()).toBe(1);

      // The face sits on the wordmark span inside the link, not on the
      // link itself - the link also wraps the icon, which must not
      // inherit a text font.
      expect(
        await brandLink.evaluate(
          (el) => getComputedStyle(el.querySelector(".font-heading")!).fontFamily,
        ),
      ).toContain("Space Grotesk");

      // It is a link, not an h1 - a wordmark in a heading element would
      // put a spurious heading on every page in the site.
      expect(await brandLink.evaluate((el) => el.tagName)).toBe("A");
      await page.close();
    },
    TEST_TIMEOUT_MS,
  );
});

describe("data and body copy stay on Inter", () => {
  it(
    "the report's table cells and headers keep Inter, with tabular figures intact",
    async () => {
      const page = await browser.newPage();
      await page.goto(`${BASE_URL}/rapport/resultaat/print`, { waitUntil: "networkidle" });

      const cell = await page.evaluate(() => {
        const td = document.querySelector("table td");
        const th = document.querySelector("table th");
        if (td === null || th === null) return null;
        return {
          td: getComputedStyle(td).fontFamily,
          th: getComputedStyle(th).fontFamily,
          numeric: getComputedStyle(td).fontVariantNumeric,
        };
      });
      await page.close();

      expect(cell, "the report must actually contain a table").not.toBeNull();
      // <th> is not a heading element, so the h1/h2/h3 rule must not
      // reach it - this is the boundary most likely to be got wrong.
      expect(cell!.th).toContain("Inter");
      expect(cell!.th).not.toContain("Space Grotesk");
      expect(cell!.td).toContain("Inter");
      expect(cell!.td).not.toContain("Space Grotesk");
      // The alignment discipline the whole report rests on, unchanged.
      expect(cell!.numeric).toContain("tabular-nums");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "body paragraphs stay on Inter",
    async () => {
      const family = await familyOf(BASE_URL, "p");
      expect(family).toContain("Inter");
      expect(family).not.toContain("Space Grotesk");
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "the .tabular class still yields tabular figures outside a table",
    async () => {
      const page = await browser.newPage();
      await page.goto(`${BASE_URL}/rapport/resultaat/print`, { waitUntil: "networkidle" });
      const result = await page.evaluate(() => {
        const el = document.querySelector(".tabular");
        if (el === null) return null;
        const s = getComputedStyle(el);
        return { family: s.fontFamily, numeric: s.fontVariantNumeric };
      });
      await page.close();

      expect(result).not.toBeNull();
      expect(result!.family).toContain("Inter");
      expect(result!.numeric).toContain("tabular-nums");
    },
    TEST_TIMEOUT_MS,
  );
});

describe("the configuration behind it", () => {
  const layout = readFileSync(path.join(REPO_ROOT, "app/layout.tsx"), "utf8");
  const css = readFileSync(path.join(REPO_ROOT, "app/globals.css"), "utf8");

  it("both families load through next/font, so neither costs a runtime request", () => {
    expect(layout).toContain('from "next/font/google"');
    expect(layout).toMatch(/Space_Grotesk\(/);
    expect(layout).toMatch(/Inter\(/);
    // Self-hosted at build time is what removes the flash and the
    // third-party fetch; a stylesheet <link> to Google would not.
    expect(layout).not.toMatch(/fonts\.googleapis\.com/);
  });

  it("Space Grotesk is loaded at the three weights the brand asked for, and no more", () => {
    const weights = /Space_Grotesk\(\{[\s\S]*?weight:\s*\[([^\]]*)\]/.exec(layout)?.[1] ?? "";
    expect(weights.replace(/[\s"']/g, "").split(",").filter(Boolean)).toEqual(["500", "600", "700"]);
  });

  it("the heading token falls back to Inter, so a failed font fetch degrades rather than breaks", () => {
    const heading = /--font-heading:([^;]*);/.exec(css)?.[1] ?? "";
    expect(heading).toContain("--font-space-grotesk");
    expect(heading).toContain("--font-inter");
    // Order matters: brand face first, then the body face, then generics.
    expect(heading.indexOf("--font-space-grotesk")).toBeLessThan(heading.indexOf("--font-inter"));
  });

  it("the split is one element rule, not a class every heading has to remember", () => {
    const rule = /((?:h[1-6],?\s*)+)\{\s*font-family:\s*var\(--font-heading\)/.exec(css);
    expect(rule, "no bare-element rule applies the heading face").not.toBeNull();
    // Exactly h1-h3. h4-h6 are deliberately excluded: DESIGN_SPEC.md §2's
    // scale stops at H3, and anything below that is in practice a label.
    expect(rule![1]!.replace(/\s/g, "").replace(/,$/, "").split(",")).toEqual(["h1", "h2", "h3"]);
  });

  it("--font-sans is still Inter alone, so nothing inherits the heading face by accident", () => {
    const sans = /--font-sans:([^;]*);/.exec(css)?.[1] ?? "";
    expect(sans).toContain("--font-inter");
    expect(sans).not.toContain("space-grotesk");
  });

  it("no heading anywhere in the app is a bare figure - the invariant the global rule rests on", () => {
    // The element rule is safe only because no heading is a number. If a
    // future heading were, it would silently lose Inter's tabular-nums.
    const headings = execSyncHeadings();
    for (const text of headings) {
      expect(text.trim(), `heading "${text}" looks like a bare figure`).not.toMatch(
        /^[\s€%0-9.,-]+$/,
      );
    }
  });
});

/** Literal heading text across the app layer - JSX expressions are skipped, they are addresses and labels. */
function execSyncHeadings(): string[] {
  const out = execFileSync(
    "grep",
    ["-rhoE", "--include=*.tsx", "<h[1-3][^>]*>[^<{]+", "app"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  return out
    .split("\n")
    .map((line) => line.replace(/<h[1-3][^>]*>/, ""))
    .filter((t) => t.trim().length > 0);
}
