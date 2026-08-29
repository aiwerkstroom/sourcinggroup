import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Golden test for the Yield & Stone colour tokens.
 *
 * Reads app/globals.css directly rather than asserting on rendered
 * markup, because that file is the single place the palette is declared -
 * every component names roles (bg-accent, text-text-muted) and never a
 * hex. So this is the only file where the palette can be wrong, and the
 * only one worth pinning.
 *
 * Three things are checked, and the third is the one this brand change
 * specifically asked for:
 *
 *  1. The six brand colours are present, in the roles they were assigned.
 *  2. WCAG contrast, recomputed here from the hexes rather than trusted
 *     to a comment. DESIGN_SPEC.md §6 is binding on conflict ("een nieuwe
 *     kleur wordt gemeten vóór hij wordt vastgelegd"), so every text
 *     token must clear 4,5:1 against BOTH the page ground and the white
 *     card - a token that only passes on one of them would fail wherever
 *     the other is used.
 *  3. The signal colours are untouched, still legible on the new ground,
 *     and their measured distance from the brand colours is recorded.
 *     Two of those distances are close enough to matter; this file pins
 *     the numbers so the finding cannot quietly drift, and so a later
 *     change to either palette shows up here as a failure rather than as
 *     a report nobody can trust.
 */

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const CSS = readFileSync(path.join(REPO_ROOT, "app/globals.css"), "utf8");

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(CSS);
  expect(match, `--${name} must be declared in app/globals.css`).not.toBeNull();
  return match![1]!.toLowerCase();
}

// --- colour maths, written out rather than imported: a dependency that
// agreed with the implementation by construction would prove nothing. ---

const channels = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const linearise = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map(linearise) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG 2.1 contrast ratio, 1:1 to 21:1. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
/** CIE L*a*b*, D65. */
function lab(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map(linearise) as [number, number, number];
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
/** Hue angle in L*a*b*, degrees. Two colours within ~20 degrees read as the same family. */
function hueAngle(hex: string): number {
  const [, a, b] = lab(hex);
  const d = (Math.atan2(b, a) * 180) / Math.PI;
  return d < 0 ? d + 360 : d;
}
/** L*a*b* chroma - how saturated a colour is, independent of its hue and lightness. */
function chroma(hex: string): number {
  const [, a, b] = lab(hex);
  return Math.hypot(a, b);
}
/** L* lightness, 0-100. This is the axis that survives greyscale. */
function lightness(hex: string): number {
  return lab(hex)[0];
}

const BRAND = {
  primary: "#1f2f28",
  sage: "#6d7f74",
  gold: "#c49a4a",
  sand: "#d9d2c4",
  offWhite: "#f6f4f1",
  darkGrey: "#2d343a",
} as const;

describe("the six brand colours land in the roles they were given", () => {
  it("dark green is the accent - buttons, links, heading accents", () => {
    expect(token("color-accent")).toBe(BRAND.primary);
  });

  it("off-white is the page ground and dark grey is the body text", () => {
    expect(token("color-bg")).toBe(BRAND.offWhite);
    expect(token("color-text")).toBe(BRAND.darkGrey);
  });

  it("warm sand carries the subtle surfaces and borders", () => {
    expect(token("color-border")).toBe(BRAND.sand);
    expect(token("color-surface-raised")).toBe(BRAND.sand);
    expect(token("color-accent-subtle")).toBe(BRAND.sand);
  });

  it("sage green carries the strong border and the focus ring", () => {
    expect(token("color-border-strong")).toBe(BRAND.sage);
    expect(token("color-accent-ring")).toBe(BRAND.sage);
  });

  it("gold exists as its own token rather than being folded into the accent", () => {
    // It cannot do the accent's job (see the contrast block below), so it
    // gets its own name and its own, narrower brief.
    expect(token("color-highlight")).toBe(BRAND.gold);
    expect(token("color-highlight")).not.toBe(token("color-accent"));
  });

  it("cards stay white, so the off-white ground still reads as the page behind them", () => {
    expect(token("color-surface")).toBe("#ffffff");
  });

  it("no colour from the old blue palette survives anywhere in the tokens", () => {
    for (const dead of ["#1e40af", "#1e3a8a", "#eff6ff", "#3b82f6", "#fafaf9", "#111827"]) {
      expect(CSS.toLowerCase(), `${dead} is from the retired palette`).not.toContain(dead);
    }
  });
});

describe("contrast - DESIGN_SPEC.md §6 is binding, and is recomputed here", () => {
  const GROUND = [
    ["page", BRAND.offWhite],
    ["card", "#ffffff"],
  ] as const;

  /**
   * Text must clear 4,5:1 on BOTH grounds. The old palette only ever had
   * to clear the page ground; cards were the same near-white. They are
   * not any more, so both are checked.
   */
  it.each(["color-text", "color-text-muted", "color-text-faint"])(
    "%s reaches AA text contrast on the page ground and on a white card",
    (name) => {
      for (const [label, ground] of GROUND) {
        expect(contrast(token(name), ground), `${name} on the ${label} ground`).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it("the three text tiers stay visibly distinct, darkest to faintest", () => {
    const [text, muted, faint] = ["color-text", "color-text-muted", "color-text-faint"].map((n) =>
      contrast(token(n), BRAND.offWhite),
    ) as [number, number, number];
    expect(text).toBeGreaterThan(muted);
    expect(muted).toBeGreaterThan(faint);
    // Not merely ordered - separated enough to read as three levels.
    expect(text - muted).toBeGreaterThan(1);
    expect(muted - faint).toBeGreaterThan(1);
  });

  it("a filled primary button carries white text comfortably", () => {
    expect(contrast("#ffffff", token("color-accent"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", token("color-accent-hover"))).toBeGreaterThanOrEqual(4.5);
  });

  it("the hover state is darker than the accent, as DESIGN_SPEC.md §4 asks", () => {
    expect(luminance(token("color-accent-hover"))).toBeLessThan(luminance(token("color-accent")));
  });

  it("the focus ring is visible against both the page and a filled primary button", () => {
    // A ring the same colour as the button it surrounds is no ring at
    // all - which is why this is sage and not the accent itself.
    expect(contrast(token("color-accent-ring"), BRAND.offWhite)).toBeGreaterThanOrEqual(3);
    expect(contrast(token("color-accent-ring"), token("color-accent"))).toBeGreaterThanOrEqual(3);
  });

  it("accent links are legible on the page ground and on a card", () => {
    for (const [label, ground] of GROUND) {
      expect(contrast(token("color-accent"), ground), `links on the ${label} ground`).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * The constraint that shapes where gold may appear at all. This is not
   * a bug being pinned in place - it is a measured property of the brand
   * colour, recorded so nobody later promotes gold to a link, a button
   * label or a data marker on a light surface and assumes it was checked.
   */
  it("gold cannot carry text or meaningful graphics on a light surface - it clears neither bar", () => {
    for (const [label, ground] of GROUND) {
      expect(contrast(BRAND.gold, ground), `gold on the ${label} ground`).toBeLessThan(3);
    }
    // Where it does work: on the dark green.
    expect(contrast(BRAND.gold, BRAND.primary)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("the threshold signal colours are untouched by the rebrand", () => {
  const SIGNALS = {
    positive: "#15803d",
    negative: "#b91c1c",
    neutral: "#b45309",
  } as const;

  it.each(Object.entries(SIGNALS))("signal-%s keeps its exact value", (name, hex) => {
    expect(token(`color-signal-${name}`)).toBe(hex);
  });

  it("all three still reach AA on the new, warmer page ground", () => {
    // They were chosen against #FAFAF9. The ground moved, so this is
    // re-measured rather than assumed to have carried over.
    for (const [name, hex] of Object.entries(SIGNALS)) {
      expect(contrast(hex, BRAND.offWhite), `signal-${name}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * THE FINDING THIS BRAND CHANGE WAS ASKED TO REPORT.
   *
   * Two brand colours sit in the same hue family as a signal colour. Both
   * are recorded here with the measurement that makes them a finding
   * rather than an impression, and neither palette was moved to resolve
   * it - that was explicitly not this change's call to make.
   *
   * The thresholds still do not depend on colour alone (each badge
   * carries its own word, "Gehaald" / "Niet gehaald"), so nothing is
   * unreadable today. What these two pin is that the *visual* separation
   * is thin, so a future change that leans harder on colour alone - or
   * that moves either palette - fails here first.
   */
  it("FINDING 1 (the sharp one): sage and the 'gehaald' green share hue AND lightness, differing only in saturation", () => {
    // Same green: ~10 degrees apart on the hue circle.
    expect(Math.abs(hueAngle(BRAND.sage) - hueAngle(SIGNALS.positive))).toBeLessThan(20);
    // And nearly the same lightness - L* 51,5 against 46,9. That is the
    // part that makes this the sharp finding rather than a cosmetic one:
    // lightness is the axis that survives greyscale printing and reduced
    // colour vision, so neither of those fallbacks separates these two.
    expect(Math.abs(lightness(BRAND.sage) - lightness(SIGNALS.positive))).toBeLessThan(8);
    // Saturation is the ONLY axis doing the work: chroma ~10 against ~53.
    expect(chroma(SIGNALS.positive) / chroma(BRAND.sage)).toBeGreaterThan(4);
  });

  it("FINDING 2 (the milder one): gold and the 'waarschuwing' orange share a hue family, but not lightness", () => {
    expect(Math.abs(hueAngle(BRAND.gold) - hueAngle(SIGNALS.neutral))).toBeLessThan(30);
    // Unlike finding 1, lightness does separate these - L* 66 against 47 -
    // so greyscale and reduced colour vision both still tell them apart.
    expect(Math.abs(lightness(BRAND.gold) - lightness(SIGNALS.neutral))).toBeGreaterThan(15);
  });

  it("NOT a collision: the dark green accent is far from the 'gehaald' signal, despite the shared hue", () => {
    // The pairing the brief specifically worried about turns out to be
    // the safe one. The hues are close (165 vs 147 degrees), but the
    // accent is far darker - L* 18 against 47 - and that lightness gap
    // separates them on every axis that matters.
    expect(Math.abs(hueAngle(BRAND.primary) - hueAngle(SIGNALS.positive))).toBeLessThan(25);
    expect(lightness(SIGNALS.positive) - lightness(BRAND.primary)).toBeGreaterThan(25);
    expect(luminance(SIGNALS.positive) / luminance(BRAND.primary)).toBeGreaterThan(3);
  });
});
