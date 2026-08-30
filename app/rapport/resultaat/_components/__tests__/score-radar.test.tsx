// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreRadar } from "../score-radar";
import type { ScoreRadarPoint } from "../score-radar";

/**
 * Golden test for the score radar.
 *
 * The geometry assertions recompute the expected coordinates here from
 * the polar definition rather than importing the component's own helpers:
 * a test that called the same function would agree with it by
 * construction and prove nothing about whether the maths is right.
 *
 * What jsdom can and cannot answer matters here. It renders the markup
 * and exposes attributes, so structure, labels, focusability and the two
 * variants are all fair game. It does not apply the stylesheet's
 * :hover/:focus-visible rules or the print media query - so the actual
 * reveal-on-focus behaviour and the screen/print switch are checked in
 * app/rapport/resultaat/__tests__/score-radar-rendering.test.ts, in a
 * real browser.
 */

const POINTS: readonly ScoreRadarPoint[] = [
  { label: "Cashflow", score: 1.5 },
  { label: "Schuldbestendigheid", score: 3.3 },
  { label: "Rendement", score: 6.5 },
  { label: "Haalbaarheid", score: 3.0 },
  { label: "Datazekerheid", score: 2.4 },
];

// The component's own user space, restated so the expectations below are
// independent of it.
const CX = 240;
const CY = 150;
const R = 100;

/** Where axis i's point for `score` must land, computed from the polar definition. */
function expectedPoint(index: number, score: number, count = 5) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  const radius = (score / 10) * R;
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

function parsePolygon(attr: string): Array<{ x: number; y: number }> {
  return attr
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number) as [number, number];
      return { x, y };
    });
}

describe("the shape is drawn from the scores", () => {
  it("puts every axis point exactly where the polar maths says it goes", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="interactive" />);
    const drawn = parsePolygon(
      container.querySelector("[data-radar-area]")!.getAttribute("points")!,
    );

    expect(drawn).toHaveLength(5);
    POINTS.forEach((p, i) => {
      const want = expectedPoint(i, p.score);
      expect(drawn[i]!.x, `${p.label} x`).toBeCloseTo(want.x, 1);
      expect(drawn[i]!.y, `${p.label} y`).toBeCloseTo(want.y, 1);
    });
  });

  it("starts at the top and runs clockwise, so the first dimension is the top vertex", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="interactive" />);
    const drawn = parsePolygon(
      container.querySelector("[data-radar-area]")!.getAttribute("points")!,
    );
    // Straight up from the centre: same x, smaller y.
    expect(drawn[0]!.x).toBeCloseTo(CX, 1);
    expect(drawn[0]!.y).toBeLessThan(CY);
    // Clockwise: the second vertex is to the right of the centre.
    expect(drawn[1]!.x).toBeGreaterThan(CX);
  });

  it("a lopsided score makes a lopsided shape - the whole point of the chart", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="interactive" />);
    const drawn = parsePolygon(
      container.querySelector("[data-radar-area]")!.getAttribute("points")!,
    );
    const distances = drawn.map((p) => Math.hypot(p.x - CX, p.y - CY));
    // Rendement (6,5) must sit visibly further out than Cashflow (1,5).
    expect(distances[2]).toBeGreaterThan(distances[0]! * 3);
  });

  it("draws five grid rings and one spoke per axis", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="interactive" />);
    expect(container.querySelectorAll("[data-radar-ring]")).toHaveLength(5);
    expect(container.querySelectorAll("[data-radar-spoke]")).toHaveLength(5);
  });

  it("clamps a score outside 0-10 onto the grid instead of drawing off it", () => {
    const { container } = render(
      <ScoreRadar
        points={[
          { label: "A", score: 42 },
          { label: "B", score: -8 },
          { label: "C", score: 5 },
        ]}
        variant="interactive"
      />,
    );
    const drawn = parsePolygon(
      container.querySelector("[data-radar-area]")!.getAttribute("points")!,
    );
    for (const p of drawn) {
      expect(Math.hypot(p.x - CX, p.y - CY)).toBeLessThanOrEqual(R + 0.01);
    }
  });
});

describe("colour follows the palette's own constraints", () => {
  it("fills in sage with transparency and outlines in the dark green accent", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="interactive" />);
    const area = container.querySelector("[data-radar-area]")!;
    expect(area.getAttribute("fill")).toBe("var(--color-border-strong)"); // sage
    expect(Number(area.getAttribute("fill-opacity"))).toBeLessThan(1);
    expect(area.getAttribute("stroke")).toBe("var(--color-accent)");
  });

  it("uses no gold anywhere - it clears neither contrast bar, so it cannot be a data colour", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="static" />);
    const markup = container.innerHTML;
    expect(markup).not.toContain("--color-highlight");
    expect(markup.toLowerCase()).not.toContain("#b99152");
  });

  it("names tokens rather than literal hexes, so a palette change reaches it", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="interactive" />);
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it("draws the same fill whatever the score, so the colour carries no pass/fail meaning", () => {
    const low = render(
      <ScoreRadar points={POINTS.map((p) => ({ ...p, score: 0.5 }))} variant="interactive" />,
    );
    const high = render(
      <ScoreRadar points={POINTS.map((p) => ({ ...p, score: 9.5 }))} variant="interactive" />,
    );
    const fillOf = (c: HTMLElement) => {
      const a = c.querySelector("[data-radar-area]")!;
      return `${a.getAttribute("fill")}|${a.getAttribute("fill-opacity")}|${a.getAttribute("stroke")}`;
    };
    expect(fillOf(low.container)).toBe(fillOf(high.container));
  });
});

describe("accessibility - the chart is not the only carrier of its data", () => {
  it("gives every point its own label, readable without a mouse", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="interactive" />);
    const labels = [...container.querySelectorAll("[data-radar-point]")].map((g) =>
      g.getAttribute("aria-label"),
    );
    expect(labels).toEqual([
      "Cashflow: 1,5 van 10",
      "Schuldbestendigheid: 3,3 van 10",
      "Rendement: 6,5 van 10",
      "Haalbaarheid: 3,0 van 10",
      "Datazekerheid: 2,4 van 10",
    ]);
  });

  it("makes the points focusable in the interactive variant", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="interactive" />);
    const points = [...container.querySelectorAll("[data-radar-point]")];
    expect(points).toHaveLength(5);
    for (const g of points) expect(g.getAttribute("tabindex")).toBe("0");
  });

  it("does NOT hide the SVG from assistive tech, and does not make it a leaf image", () => {
    // Both would be wrong: aria-hidden over focusable children is a WCAG
    // 4.1.2 failure, and role="img" is a leaf role that would swallow the
    // very points carrying the values.
    const { container } = render(<ScoreRadar points={POINTS} variant="interactive" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBeNull();
    expect(svg.getAttribute("role")).not.toBe("img");
  });

  it("hides the decorative scaffolding, so only the five values are announced", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="interactive" />);
    const area = container.querySelector("[data-radar-area]")!;
    expect(area.closest("[aria-hidden='true']")).not.toBeNull();
    const ring = container.querySelector("[data-radar-ring]")!;
    expect(ring.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("gives each point a hit area far larger than the 4-unit dot", () => {
    // DESIGN_SPEC.md §6 asks for a usable target; the visible dot is not one.
    const { container } = render(<ScoreRadar points={POINTS} variant="interactive" />);
    const radii = [...container.querySelectorAll("[data-radar-point] circle")].map((c) =>
      Number(c.getAttribute("r")),
    );
    expect(Math.max(...radii)).toBeGreaterThanOrEqual(16);
  });
});

describe("the interactive variant", () => {
  it("carries a hover/focus readout with the dimension name and the exact score", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="interactive" />);
    const tips = [...container.querySelectorAll("[data-radar-tip]")];
    expect(tips).toHaveLength(5);
    expect(tips[2]!.textContent).toBe("Rendement: 6,5 van 10");
  });

  it("does not print the scores permanently - that is the static variant's job", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="interactive" />);
    expect(container.querySelectorAll("[data-radar-value]")).toHaveLength(0);
  });

  it("still labels every axis, since a radar without axis labels says nothing", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="interactive" />);
    const labels = [...container.querySelectorAll("[data-radar-label]")].map(
      (t) => t.getAttribute("data-radar-label"),
    );
    expect(labels).toEqual(POINTS.map((p) => p.label));
  });
});

describe("the static variant - what the PDF gets", () => {
  it("prints all five scores permanently, because the PDF has no hover", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="static" />);
    const values = [...container.querySelectorAll("[data-radar-value]")].map((t) => t.textContent);
    expect(values).toEqual(["1,5", "3,3", "6,5", "3,0", "2,4"]);
  });

  it("carries no hover readout, which nothing in a PDF could ever trigger", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="static" />);
    expect(container.querySelectorAll("[data-radar-tip]")).toHaveLength(0);
  });

  it("does not put unreachable tab stops in a printed page", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="static" />);
    for (const g of container.querySelectorAll("[data-radar-point]")) {
      expect(g.getAttribute("tabindex")).toBeNull();
    }
  });

  it("keeps its labels, so the printed chart still reads on its own", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="static" />);
    expect(container.textContent).toContain("Schuldbestendigheid");
    expect(container.textContent).toContain("6,5");
  });

  it("draws the identical shape as the interactive variant - one dataset, two renderings", () => {
    const a = render(<ScoreRadar points={POINTS} variant="interactive" />);
    const b = render(<ScoreRadar points={POINTS} variant="static" />);
    expect(b.container.querySelector("[data-radar-area]")!.getAttribute("points")).toBe(
      a.container.querySelector("[data-radar-area]")!.getAttribute("points"),
    );
  });

  it("tags itself so a caller (and a test) can tell the two apart", () => {
    const { container } = render(<ScoreRadar points={POINTS} variant="static" />);
    expect(container.querySelector("svg")!.getAttribute("data-radar")).toBe("static");
  });
});
