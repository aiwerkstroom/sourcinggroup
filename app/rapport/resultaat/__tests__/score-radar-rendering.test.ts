import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Browser } from "playwright";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The half of the score radar that only a real browser can answer.
 *
 * score-radar.test.tsx covers structure and geometry in jsdom. Three
 * things it cannot touch, and all three are load-bearing:
 *
 *  1. The reveal on hover and on keyboard focus is CSS - the
 *     [data-radar-point] rules in globals.css. jsdom applies no
 *     stylesheet, so only a browser can say whether :focus-visible
 *     actually fires on an SVG <g> and whether the readout appears.
 *     Keyboard is the half that matters most: if the score only showed
 *     on :hover, the data would be mouse-only.
 *  2. The screen/print switch is a media query. Which variant an output
 *     actually gets is a question about media, not about markup.
 *  3. Whether the radar and the threshold badges can ever be seen at the
 *     same time - the colour-proximity question this chart had to answer
 *     before shipping.
 *
 * Driven against /rapport/resultaat/print, which renders the whole paid
 * report from the reference case - the same fixture every section-level
 * golden test uses.
 */

const PORT = 3191;
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

describe("the interactive variant reveals a score on hover AND on keyboard focus", () => {
  it(
    "starts hidden, and a real Tab press brings up that point's own readout",
    async () => {
      const page = await browser.newPage();
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });

      const tipOpacity = () =>
        page.evaluate(() =>
          getComputedStyle(
            document.querySelector('[data-radar="interactive"] [data-radar-tip]')!,
          ).getPropertyValue("opacity"),
        );

      expect(Number(await tipOpacity()), "hidden until asked for").toBe(0);

      // A real Tab press, not element.focus(): :focus-visible is
      // deliberately keyboard-driven, and a programmatic focus does not
      // satisfy it. Tabbing is what a keyboard user actually does.
      let landed = false;
      for (let i = 0; i < 60 && !landed; i += 1) {
        await page.keyboard.press("Tab");
        landed = await page.evaluate(
          () => document.activeElement?.getAttribute("data-radar-point") !== null,
        );
      }
      expect(landed, "a radar point must be reachable by Tab alone").toBe(true);
      await page.waitForTimeout(SETTLE_MS);

      const focused = await page.evaluate(() => {
        const g = document.activeElement!;
        return {
          label: g.getAttribute("data-radar-point"),
          matchesFocusVisible: g.matches(":focus-visible"),
          tipOpacity: getComputedStyle(g.querySelector("[data-radar-tip]")!).opacity,
          tipText: g.querySelector("[data-radar-tip] text")?.textContent ?? null,
          ariaLabel: g.getAttribute("aria-label"),
        };
      });

      expect(focused.matchesFocusVisible).toBe(true);
      expect(Number(focused.tipOpacity), "the readout must actually be visible").toBe(1);
      // The same information a mouse user gets, not a lesser version.
      expect(focused.tipText).toBe(focused.ariaLabel);
      expect(focused.tipText).toMatch(/^.+: \d,\d van 10$/);

      await page.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "shows one readout at a time - moving focus on hides the last one",
    async () => {
      const page = await browser.newPage();
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });

      let landed = false;
      for (let i = 0; i < 60 && !landed; i += 1) {
        await page.keyboard.press("Tab");
        landed = await page.evaluate(
          () => document.activeElement?.getAttribute("data-radar-point") !== null,
        );
      }
      await page.keyboard.press("Tab");
      await page.waitForTimeout(SETTLE_MS);

      const opacities = await page.evaluate(() =>
        [...document.querySelectorAll('[data-radar="interactive"] [data-radar-point]')].map((g) =>
          Number(getComputedStyle(g.querySelector("[data-radar-tip]")!).opacity),
        ),
      );
      expect(opacities.filter((o) => o === 1)).toHaveLength(1);

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

      let landed = false;
      for (let i = 0; i < 60 && !landed; i += 1) {
        await page.keyboard.press("Tab");
        landed = await page.evaluate(
          () => document.activeElement?.getAttribute("data-radar-point") !== null,
        );
      }

      const ring = await page.evaluate(() => {
        const el = document.activeElement!.querySelector("[data-radar-focus-ring]")!;
        const s = getComputedStyle(el);
        return { stroke: s.stroke, width: s.strokeWidth };
      });
      expect(ring.stroke).toBe("rgb(24, 58, 45)"); // --color-accent #183A2D
      expect(parseFloat(ring.width)).toBeGreaterThan(0);

      await page.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "reveals the same readout on hover, for the mouse half",
    async () => {
      const page = await browser.newPage();
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });
      await page.hover('[data-radar="interactive"] [data-radar-point]');
      await page.waitForTimeout(SETTLE_MS);
      const opacity = await page.evaluate(() =>
        Number(
          getComputedStyle(
            document.querySelector('[data-radar="interactive"] [data-radar-tip]')!,
          ).opacity,
        ),
      );
      expect(opacity).toBe(1);
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
        interactive: document.querySelector('[data-radar="interactive"]')!.checkVisibility(),
        static: document.querySelector('[data-radar="static"]')!.checkVisibility(),
      }));
      expect(visible.interactive).toBe(true);
      expect(visible.static).toBe(false);
      await page.close();
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "in print: static visible with all five scores, interactive gone",
    async () => {
      const page = await browser.newPage();
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });
      await page.emulateMedia({ media: "print" });

      const printed = await page.evaluate(() => ({
        interactive: document.querySelector('[data-radar="interactive"]')!.checkVisibility(),
        static: document.querySelector('[data-radar="static"]')!.checkVisibility(),
        values: [...document.querySelectorAll('[data-radar="static"] [data-radar-value]')].map(
          (t) => t.textContent,
        ),
      }));

      expect(printed.interactive).toBe(false);
      expect(printed.static).toBe(true);
      // The reference case's five dimension scores, permanently on the page.
      expect(printed.values).toEqual(["1,5", "3,3", "6,5", "3,0", "2,4"]);

      await page.close();
    },
    TEST_TIMEOUT_MS,
  );
});

describe("the sage/signal-green proximity question, answered by measurement", () => {
  it(
    "the radar and the threshold badges are never on screen together",
    async () => {
      /**
       * The radar's fill is sage, which sits close in lightness to the
       * "Gehaald" signal green - a documented finding in
       * app/__tests__/design-tokens.test.ts. The question this settles is
       * whether that ever matters HERE: it would only mislead if a reader
       * could see a green-filled chart and a green pass badge in one
       * glance and read the first as the second.
       *
       * They are sections 1 and 7 of the report, thousands of pixels
       * apart. If that ever stops being true - if the sections are
       * reordered, or the badges move up - this test fails and the
       * question has to be asked again rather than assumed settled.
       */
      const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });

      const geometry = await page.evaluate(() => {
        const area = document.querySelector('[data-radar="interactive"] [data-radar-area]')!;
        const badges = [...document.querySelectorAll("span")].filter((el) =>
          /^(Gehaald|Niet gehaald)$/.test(el.textContent?.trim() ?? ""),
        );
        const rect = area.getBoundingClientRect();
        return {
          radarBottom: rect.bottom + window.scrollY,
          badgeCount: badges.length,
          firstBadgeTop:
            badges.length > 0 ? badges[0]!.getBoundingClientRect().top + window.scrollY : null,
        };
      });

      // Sanity: the badges really are in this report, so a gap of
      // "infinity" cannot come from having found none.
      expect(geometry.badgeCount).toBeGreaterThan(0);
      expect(geometry.firstBadgeTop).not.toBeNull();

      const gap = geometry.firstBadgeTop! - geometry.radarBottom;
      // Comfortably more than any plausible viewport height.
      expect(gap).toBeGreaterThan(2000);

      await page.close();
    },
    TEST_TIMEOUT_MS,
  );
});

describe("the score section keeps everything it had", () => {
  it(
    "still renders all five ScoreRulers under the radar - the radar added, replaced nothing",
    async () => {
      const page = await browser.newPage();
      await page.goto(REPORT_URL, { waitUntil: "networkidle" });
      const counts = await page.evaluate(() => {
        const section = document.querySelector("#sectie-tsg-score")!.closest("section")!;
        return {
          rulers: section.querySelectorAll('[data-marker="score"]').length,
          radars: section.querySelectorAll("[data-radar]").length,
          total: section.querySelector(".tabular")?.textContent ?? null,
        };
      });
      expect(counts.rulers).toBe(5);
      expect(counts.radars).toBe(2); // interactive + static
      // The anchor this change must not move.
      expect(counts.total).toBe("3,7");
      await page.close();
    },
    TEST_TIMEOUT_MS,
  );
});
