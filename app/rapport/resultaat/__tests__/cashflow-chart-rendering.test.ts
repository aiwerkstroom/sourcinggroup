import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Browser } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The half of the cashflow chart that only a real browser can answer -
 * the same three questions score-radar-rendering.test.ts asks of the
 * radar, because the chart is built on the same two mechanisms:
 *
 *  1. The amount reveal is CSS ([data-cashflow-point] in globals.css).
 *     jsdom applies no stylesheet, so only a browser can say whether
 *     :focus-visible fires on an SVG <g> and whether the readout appears.
 *     Keyboard is the half that matters: on :hover alone the thirty
 *     figures would be mouse-only.
 *  2. The screen/print switch is a media query, so which variant an
 *     output gets is a question about media, not about markup. In print
 *     every amount must be permanently on the page, because a headless
 *     browser neither hovers nor focuses.
 *  3. Whether the chart's two sign tints are actually distinguishable
 *     once the browser has resolved the custom properties and the fill
 *     opacities - measured here rather than argued from the source.
 *
 * Driven against /rapport/resultaat/print, which renders the whole paid
 * report from the reference case - the same fixture every section-level
 * golden test uses.
 */

const PORT = 3192;
const BASE_URL = `http://localhost:${PORT}`;
const REPORT_URL = `${BASE_URL}/rapport/resultaat/print`;
const START_TIMEOUT_MS = 25_000;
const TEST_TIMEOUT_MS = 60_000;
const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");

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
        "this golden test reads computed styles from a real rendered report.",
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

/** Long enough for the 150ms opacity transition to finish. */
const SETTLE_MS = 400;

const INTERACTIVE = '[data-cashflow-chart="interactive"]';

/** Tabs until focus lands on a cashflow point, or gives up. */
async function tabToFirstPoint(page: Awaited<ReturnType<Browser["newPage"]>>): Promise<boolean> {
  for (let i = 0; i < 120; i += 1) {
    await page.keyboard.press("Tab");
    const landed = await page.evaluate(
      () => document.activeElement?.getAttribute("data-cashflow-point") !== null,
    );
    if (landed) return true;
  }
  return false;
}

describe("the interactive variant reveals an amount on hover AND on keyboard focus", () => {
  it(
    "starts hidden, and a real Tab press brings up that year's own readout",
    async () => {
      const page = await browser.newPage();
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });

      const firstTipOpacity = await page.evaluate(() =>
        Number(
          getComputedStyle(
            document.querySelector('[data-cashflow-chart="interactive"] [data-cashflow-tip]')!,
          ).opacity,
        ),
      );
      expect(firstTipOpacity, "hidden until asked for").toBe(0);

      // A real Tab press, not element.focus(): :focus-visible is
      // deliberately keyboard-driven and a programmatic focus does not
      // satisfy it. Tabbing is what a keyboard user actually does.
      expect(await tabToFirstPoint(page), "a data point must be reachable by Tab alone").toBe(true);
      await page.waitForTimeout(SETTLE_MS);

      const focused = await page.evaluate(() => {
        const g = document.activeElement!;
        return {
          point: g.getAttribute("data-cashflow-point"),
          matchesFocusVisible: g.matches(":focus-visible"),
          tipOpacity: Number(getComputedStyle(g.querySelector("[data-cashflow-tip]")!).opacity),
          tipText: g.querySelector("[data-cashflow-tip] text")?.textContent ?? null,
          ariaLabel: g.getAttribute("aria-label"),
        };
      });

      expect(focused.matchesFocusVisible).toBe(true);
      expect(focused.tipOpacity, "the readout must actually be visible").toBe(1);
      // The same information a mouse user gets, not a lesser version.
      expect(focused.tipText).toBe(focused.ariaLabel);
      // Scenario, year, monthly amount - the whole reading, standalone.
      expect(focused.tipText).toMatch(/^(Conservatief|Basis|Optimistisch), jaar \d+: €\s.+ per maand/);

      await page.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "shows one readout at a time - moving focus on hides the last one",
    async () => {
      const page = await browser.newPage();
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });

      expect(await tabToFirstPoint(page)).toBe(true);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(SETTLE_MS);

      const visible = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            '[data-cashflow-chart="interactive"] [data-cashflow-point]',
          ),
        ]
          .map((g) => Number(getComputedStyle(g.querySelector("[data-cashflow-tip]")!).opacity))
          .filter((o) => o === 1),
      );
      expect(visible).toHaveLength(1);

      await page.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "gives the focused point a visible ring of its own",
    async () => {
      // The browser's default outline draws around the group's bounding
      // box, which includes the invisible hit circle - so it mostly
      // misses the point. Hence the explicit ring.
      const page = await browser.newPage();
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });
      expect(await tabToFirstPoint(page)).toBe(true);

      const ring = await page.evaluate(() => {
        const el = document.activeElement!.querySelector("[data-cashflow-focus-ring]")!;
        const s = getComputedStyle(el);
        return { stroke: s.stroke, width: parseFloat(s.strokeWidth) };
      });
      expect(ring.stroke).toBe("rgb(24, 58, 45)"); // --color-accent #183A2D
      expect(ring.width).toBeGreaterThan(0);

      await page.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "reveals the same readout on hover, for the mouse half",
    async () => {
      const page = await browser.newPage();
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });
      // A raw mouse move onto the point's own coordinates, rather than
      // locator.hover(): SVG has no z-index, so the visible dot sits over
      // its own group's hit circle and Playwright's actionability check
      // reads that sibling as an interception. Moving the mouse there is
      // what a reader does, and it exercises the browser's real hit test.
      const at = await page.evaluate((sel) => {
        const dot = document.querySelector(`${sel} [data-cashflow-point] circle`)!;
        // Section 5 is far down the report; a mouse move to a viewport
        // coordinate outside the viewport lands nowhere.
        dot.scrollIntoView({ block: "center" });
        const box = dot.getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      }, INTERACTIVE);
      await page.mouse.move(at.x, at.y);
      await page.waitForTimeout(SETTLE_MS);
      const opacity = await page.evaluate(() =>
        Number(
          getComputedStyle(
            document.querySelector('[data-cashflow-chart="interactive"] [data-cashflow-tip]')!,
          ).opacity,
        ),
      );
      expect(opacity).toBe(1);
      await page.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "makes every one of the thirty amounts reachable by keyboard, not just the first",
    async () => {
      // The point of tabbing: a screen-reader or keyboard-only reader has
      // to be able to walk the whole series, or the chart is decoration
      // with a text alternative bolted on.
      const page = await browser.newPage();
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });
      const focusable = await page.evaluate(
        () =>
          document.querySelectorAll(
            '[data-cashflow-chart="interactive"] [data-cashflow-point][tabindex="0"]',
          ).length,
      );
      expect(focusable).toBe(30); // 3 scenarios x 10 years
      await page.close();
    },
    TEST_TIMEOUT_MS,
  );
});

describe("screen gets the interactive variant, print gets the static one", () => {
  it(
    "on screen: interactive visible, static not rendered",
    async () => {
      const page = await browser.newPage();
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });
      // checkVisibility() walks the whole ancestor chain, so this does not
      // depend on how many wrappers sit between the SVG and the element
      // carrying the print class.
      const visible = await page.evaluate(() => ({
        interactive: document.querySelector('[data-cashflow-chart="interactive"]')!.checkVisibility(),
        static: document.querySelector('[data-cashflow-chart="static"]')!.checkVisibility(),
      }));
      expect(visible.interactive).toBe(true);
      expect(visible.static).toBe(false);
      await page.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "in print: static visible with all thirty amounts on the page, interactive gone",
    async () => {
      const page = await browser.newPage();
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });
      await page.emulateMedia({ media: "print" });

      const printed = await page.evaluate(() => ({
        interactive: document.querySelector('[data-cashflow-chart="interactive"]')!.checkVisibility(),
        static: document.querySelector('[data-cashflow-chart="static"]')!.checkVisibility(),
        values: [
          ...document.querySelectorAll('[data-cashflow-chart="static"] [data-cashflow-value]'),
        ].map((t) => t.textContent),
        tips: document.querySelectorAll('[data-cashflow-chart="static"] [data-cashflow-tip]')
          .length,
      }));

      expect(printed.interactive).toBe(false);
      expect(printed.static).toBe(true);
      // Every amount permanently drawn: the PDF renderer never hovers.
      expect(printed.values).toHaveLength(30);
      // nl-NL currency formatting puts a non-breaking space after the sign.
      expect(printed.values.every((v) => /^€\s-?[\d.]+$/.test(v ?? ""))).toBe(true);
      // And no hover-only machinery left in the printed variant.
      expect(printed.tips).toBe(0);

      await page.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "prints the reference case's own crossover figures, base year 9 and 10",
    async () => {
      // The single most important thing this chart shows: the base
      // scenario turns positive in year 10, and only just. If either
      // figure moves, the story the chart tells has changed.
      const page = await browser.newPage();
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });
      await page.emulateMedia({ media: "print" });

      const values = await page.evaluate(() =>
        Object.fromEntries(
          [
            ...document.querySelectorAll('[data-cashflow-chart="static"] [data-cashflow-value]'),
          ].map((t) => [
            t.getAttribute("data-cashflow-value"),
            // nl-NL currency puts U+00A0 after the sign; normalised so the
            // expectations below stay readable.
            (t.textContent ?? "").replace(/ /g, " "),
          ]),
        ),
      );
      // -69,53/yr -> -6/month, and 467,79/yr -> 39/month.
      expect(values["Basis-9"]).toBe("€ -6");
      expect(values["Basis-10"]).toBe("€ 39");
      // Conservative never crosses in ten years; optimistic already has by year 2.
      expect(values["Conservatief-10"]).toBe("€ -489");
      expect(values["Optimistisch-2"]).toBe("€ 102");

      await page.close();
    },
    TEST_TIMEOUT_MS,
  );
});

describe("the two sign tints are distinguishable once the browser has resolved them", () => {
  it(
    "renders the above-zero and below-zero fills as visibly different tones",
    async () => {
      /**
       * Both fills are semi-transparent over the report's own background,
       * so what a reader actually sees is neither token's raw value. This
       * composites them the way the browser does and checks the result
       * still separates - the measurement the fill opacities were chosen
       * from (18 L* points apart), re-taken against the shipped page.
       */
      const page = await browser.newPage();
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });

      const tones = await page.evaluate(() => {
        const parse = (c: string) => c.match(/[\d.]+/g)!.map(Number);
        const compose = (selector: string) => {
          const el = document.querySelector(selector)!;
          const s = getComputedStyle(el);
          const [r, g, b] = parse(s.fill) as [number, number, number];
          const alpha = Number(s.fillOpacity);
          // Over the page's own surface, whatever that currently is.
          const [br, bg, bb] = parse(getComputedStyle(document.body).backgroundColor) as [
            number,
            number,
            number,
          ];
          return [
            r * alpha + br * (1 - alpha),
            g * alpha + bg * (1 - alpha),
            b * alpha + bb * (1 - alpha),
          ];
        };
        // Relative luminance, the same quantity WCAG contrast is built on.
        const luminance = ([r, g, b]: number[]) => {
          const lin = (v: number) => {
            const c = v! / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
        };
        const negative = compose(
          '[data-cashflow-chart="interactive"] [data-cashflow-fill="negative"]',
        );
        const positive = compose(
          '[data-cashflow-chart="interactive"] [data-cashflow-fill="positive"]',
        );
        return { negative: luminance(negative), positive: luminance(positive) };
      });

      // Above zero must read as the darker, more solid of the two - the
      // direction the design chose, not just "different".
      expect(tones.positive).toBeLessThan(tones.negative);
      const ratio = (tones.negative + 0.05) / (tones.positive + 0.05);
      expect(ratio, "the two tints must not collapse into one colour").toBeGreaterThan(1.4);

      await page.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "spends no signal colour on the chart - section 7's badges stay the only pass/fail colour",
    async () => {
      const page = await browser.newPage();
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });

      const signals = await page.evaluate(() => {
        const root = getComputedStyle(document.documentElement);
        const reserved = ["--color-signal-positive", "--color-signal-negative", "--color-signal-neutral"]
          .map((n) => root.getPropertyValue(n).trim())
          .filter(Boolean);
        const used = new Set<string>();
        for (const el of document.querySelectorAll("[data-cashflow-chart] *")) {
          const s = getComputedStyle(el);
          used.add(s.fill);
          used.add(s.stroke);
        }
        // Compare as the browser's own rgb() strings.
        const asRgb = (hex: string) => {
          const probe = document.createElement("span");
          probe.style.color = hex;
          document.body.appendChild(probe);
          const v = getComputedStyle(probe).color;
          probe.remove();
          return v;
        };
        return reserved.map(asRgb).filter((c) => used.has(c));
      });

      expect(signals).toEqual([]);
      await page.close();
    },
    TEST_TIMEOUT_MS,
  );
});

describe("the chart sits above the table and the table is untouched", () => {
  it(
    "draws the chart first and still shows all fifteen metric columns under it",
    async () => {
      const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } });
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });

      const layout = await page.evaluate(() => {
        const section = document.querySelector("#sectie-tienjarige-reeks")!.closest("section")!;
        const chart = section.querySelector('[data-cashflow-chart="interactive"]')!;
        const table = section.querySelector("table")!;
        return {
          chartTop: chart.getBoundingClientRect().top + window.scrollY,
          tableTop: table.getBoundingClientRect().top + window.scrollY,
          metricHeaders: table.querySelectorAll("thead tr:last-child th").length,
          bodyRows: table.querySelectorAll("tbody tr").length,
          figures: table.querySelectorAll("td.tabular").length,
        };
      });

      expect(layout.chartTop).toBeLessThan(layout.tableTop);
      expect(layout.metricHeaders).toBe(15); // 5 metrics x 3 scenarios
      expect(layout.bodyRows).toBe(10);
      expect(layout.figures).toBe(150);

      await page.close();
    },
    TEST_TIMEOUT_MS,
  );
});
