// @vitest-environment jsdom

/**
 * Golden test for the interactive calculator (HOMEPAGE_UPGRADE_SPEC.md
 * §4.4's own "golden test" line).
 *
 * The three things §4.4 names, plus the one that matters most:
 *
 *  - different input produces a different score;
 *  - the disclosure text stays visible throughout, including while
 *    someone is typing - which is exactly when a visitor is most likely
 *    to forget this is not the real model;
 *  - reduced motion is honoured;
 *  - and the debounce split: the slider commits immediately, the number
 *    box waits. That is one setting serving opposite purposes on two
 *    controls, so it is worth pinning rather than trusting.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExampleCalculator } from "../example-calculator";
import { EXAMPLE_DEFAULTS, computeExampleOutcome } from "../example-calculator-formula";

function setReducedMotion(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

function totalOnScreen(): string {
  return screen.getByText(/fictieve totaalscore/).previousElementSibling!.textContent!;
}

function expectedTotal(price: number, rent: number, wijk = EXAMPLE_DEFAULTS.wijk): string {
  return computeExampleOutcome(price, rent, wijk).totalScore.toFixed(1).replace(".", ",");
}

beforeEach(() => setReducedMotion(false));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the default state", () => {
  it("shows the outcome for the approved defaults", () => {
    render(<ExampleCalculator />);
    expect(totalOnScreen()).toBe(
      expectedTotal(EXAMPLE_DEFAULTS.priceEUR, EXAMPLE_DEFAULTS.rentPerMonthEUR),
    );
  });

  it("draws all five rulers, including the two that hold still", () => {
    const { container } = render(<ExampleCalculator />);
    expect(container.querySelectorAll('[data-marker="score"]')).toHaveLength(5);
    expect(screen.getByText("Haalbaarheid")).toBeInTheDocument();
    expect(screen.getByText("Datazekerheid")).toBeInTheDocument();
  });

  it("renders server-side too, so the section is not blank before JavaScript", () => {
    const html = renderToStaticMarkup(<ExampleCalculator />);
    expect(html).toContain("fictieve totaalscore");
    expect(html).toContain("Interactief voorbeeld");
  });
});

describe("different input produces a different score (§4.4)", () => {
  it("a higher rent raises the total", () => {
    render(<ExampleCalculator />);
    const before = totalOnScreen();

    fireEvent.change(screen.getByLabelText(/Huur per maand \(schuifregelaar\)/), {
      target: { value: "2200" },
    });

    const after = totalOnScreen();
    expect(after).not.toBe(before);
    expect(after).toBe(expectedTotal(EXAMPLE_DEFAULTS.priceEUR, 2200));
  });

  it("a higher price lowers the total", () => {
    render(<ExampleCalculator />);
    const before = Number(totalOnScreen().replace(",", "."));

    fireEvent.change(screen.getByLabelText(/Vraagprijs \(schuifregelaar\)/), {
      target: { value: "550000" },
    });

    expect(Number(totalOnScreen().replace(",", "."))).toBeLessThan(before);
  });

  it("the wijk type changes the outcome without changing the yield", () => {
    render(<ExampleCalculator />);
    const yieldBefore = screen.getByText(/%$/).textContent;

    fireEvent.change(screen.getByLabelText("Type wijk"), {
      target: { value: "Stadscentrum" },
    });

    expect(totalOnScreen()).toBe(
      expectedTotal(EXAMPLE_DEFAULTS.priceEUR, EXAMPLE_DEFAULTS.rentPerMonthEUR, "Stadscentrum"),
    );
    // The visitor's own rent is untouched, so gross yield cannot move.
    expect(screen.getByText(/%$/).textContent).toBe(yieldBefore);
  });
});

describe("the debounce split (§4.4)", () => {
  it("the slider commits immediately - dragging should track the thumb", () => {
    render(<ExampleCalculator />);
    fireEvent.change(screen.getByLabelText(/Huur per maand \(schuifregelaar\)/), {
      target: { value: "2000" },
    });
    // No timer advanced, and the figure has already moved.
    expect(totalOnScreen()).toBe(expectedTotal(EXAMPLE_DEFAULTS.priceEUR, 2000));
  });

  it("the number box waits 150ms, so a score does not jitter per keystroke", () => {
    vi.useFakeTimers();
    render(<ExampleCalculator />);
    const before = totalOnScreen();

    fireEvent.change(screen.getByLabelText("Huur per maand"), { target: { value: "2000" } });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(totalOnScreen()).toBe(before);

    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(totalOnScreen()).toBe(expectedTotal(EXAMPLE_DEFAULTS.priceEUR, 2000));
  });

  it("clamps a typed value beyond the slider range", async () => {
    render(<ExampleCalculator />);
    fireEvent.change(screen.getByLabelText("Vraagprijs"), { target: { value: "9999999" } });

    await waitFor(() =>
      expect(totalOnScreen()).toBe(expectedTotal(600_000, EXAMPLE_DEFAULTS.rentPerMonthEUR)),
    );
  });

  it("ignores a half-typed value instead of recalculating from it", () => {
    vi.useFakeTimers();
    render(<ExampleCalculator />);
    const before = totalOnScreen();

    fireEvent.change(screen.getByLabelText("Huur per maand"), { target: { value: "" } });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // An empty box is a moment in typing, not an instruction to compute
    // with nothing.
    expect(totalOnScreen()).toBe(before);
  });
});

describe("the disclosure stays put (§4.3)", () => {
  it("names both the property and the calculation as fictional", () => {
    render(<ExampleCalculator />);
    expect(screen.getByText(/Interactief voorbeeld/)).toBeInTheDocument();
    expect(
      screen.getByText(/Dit is geen echt pand en geen echte berekening/),
    ).toBeInTheDocument();
    expect(screen.getByText(/vereenvoudigde demonstratieformule/)).toBeInTheDocument();
  });

  it("is still there while the visitor is typing and after the score has moved", () => {
    render(<ExampleCalculator />);

    fireEvent.change(screen.getByLabelText(/Huur per maand \(schuifregelaar\)/), {
      target: { value: "2400" },
    });
    fireEvent.change(screen.getByLabelText("Vraagprijs"), { target: { value: "175000" } });

    // The moment it would matter most for it to have disappeared.
    expect(screen.getByText(/Dit is geen echt pand en geen echte berekening/)).toBeInTheDocument();
  });

  it("says the wijk types are invented", () => {
    render(<ExampleCalculator />);
    expect(screen.getByText(/Verzonnen categorieën, geen echte wijken/)).toBeInTheDocument();
  });
});

describe("prefers-reduced-motion (§1)", () => {
  it("drops the marker transition", () => {
    setReducedMotion(true);
    const { container } = render(<ExampleCalculator />);

    for (const marker of container.querySelectorAll('[data-marker="score"]')) {
      expect((marker as SVGElement).style.transition).toBe("");
    }
  });

  it("keeps the marker transition when motion is allowed", () => {
    setReducedMotion(false);
    const { container } = render(<ExampleCalculator />);

    const marker = container.querySelector('[data-marker="score"]') as SVGElement;
    expect(marker.style.transition).toContain("150ms");
    expect(marker.style.transition).not.toMatch(/cubic-bezier|spring|bounce/i);
  });

  it("still recalculates - only the animation goes", () => {
    setReducedMotion(true);
    render(<ExampleCalculator />);

    fireEvent.change(screen.getByLabelText(/Huur per maand \(schuifregelaar\)/), {
      target: { value: "2200" },
    });
    expect(totalOnScreen()).toBe(expectedTotal(EXAMPLE_DEFAULTS.priceEUR, 2200));
  });
});
