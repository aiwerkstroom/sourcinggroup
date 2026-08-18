// @vitest-environment jsdom

/**
 * Golden test for the fade-in infrastructure (HOMEPAGE_UPGRADE_SPEC.md §7
 * step 1). Needs a real DOM: the whole point of this component is what it
 * does with IntersectionObserver and matchMedia, neither of which exists
 * in a renderToStaticMarkup pass.
 *
 * The claim that matters most, and the reason several of these tests
 * exist: content must never end up permanently invisible. A fade-in is a
 * decoration, but the mechanism that drives it sits between the visitor
 * and the text - so every path where the mechanism cannot do its job
 * (reduced motion, no observer, no JS) has to resolve towards visible,
 * not away from it.
 *
 * data-fade="in" is the visible state and data-fade="" the hidden one;
 * globals.css keys the opacity off exactly that attribute, so asserting
 * on it is asserting on what the visitor sees, not on an internal flag.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FadeIn } from "../fade-in";

type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;

let observerCallbacks: ObserverCallback[] = [];
let observeCount = 0;
let disconnectCount = 0;
let lastObserverOptions: IntersectionObserverInit | undefined;

function installObserver() {
  observerCallbacks = [];
  observeCount = 0;
  disconnectCount = 0;

  class FakeObserver {
    constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
      observerCallbacks.push(callback);
      lastObserverOptions = options;
    }
    observe() {
      observeCount += 1;
    }
    disconnect() {
      disconnectCount += 1;
    }
    unobserve() {}
    takeRecords() {
      return [];
    }
  }

  vi.stubGlobal("IntersectionObserver", FakeObserver);
}

function setReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    (query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  );
}

function fadeState(testId = "content"): string | null {
  return screen.getByTestId(testId).parentElement?.getAttribute("data-fade") ?? null;
}

beforeEach(() => {
  installObserver();
  setReducedMotion(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("trigger='scroll' - the default, for everything below the fold", () => {
  it("starts hidden and observes the element", () => {
    render(
      <FadeIn>
        <p data-testid="content">Hoe het werkt</p>
      </FadeIn>,
    );

    expect(fadeState()).toBe("");
    expect(observeCount).toBe(1);
  });

  it("becomes visible once the element intersects", async () => {
    render(
      <FadeIn>
        <p data-testid="content">Hoe het werkt</p>
      </FadeIn>,
    );

    observerCallbacks[0]!([{ isIntersecting: true }]);
    await waitFor(() => expect(fadeState()).toBe("in"));
  });

  it("stays hidden while the element has not intersected", async () => {
    render(
      <FadeIn>
        <p data-testid="content">Hoe het werkt</p>
      </FadeIn>,
    );

    observerCallbacks[0]!([{ isIntersecting: false }]);
    await waitFor(() => expect(fadeState()).toBe(""));
  });

  it("disconnects after the first intersection, so content never re-hides on scroll", async () => {
    render(
      <FadeIn>
        <p data-testid="content">Hoe het werkt</p>
      </FadeIn>,
    );

    observerCallbacks[0]!([{ isIntersecting: true }]);
    await waitFor(() => expect(fadeState()).toBe("in"));
    expect(disconnectCount).toBeGreaterThanOrEqual(1);

    // A later "left the viewport" event must not take it back out.
    observerCallbacks[0]!([{ isIntersecting: false }]);
    await waitFor(() => expect(fadeState()).toBe("in"));
  });

  it("observes slightly ahead of the viewport edge rather than exactly at it", () => {
    render(
      <FadeIn>
        <p data-testid="content">Hoe het werkt</p>
      </FadeIn>,
    );
    expect(lastObserverOptions?.rootMargin).toBe("0px 0px -10% 0px");
  });
});

describe("trigger='load' - the hero, which has nothing to scroll into", () => {
  it("becomes visible without any intersection, and never observes", async () => {
    render(
      <FadeIn trigger="load">
        <h1 data-testid="content">Een pand kopen in Spanje voelt vaak als een gok.</h1>
      </FadeIn>,
    );

    await waitFor(() => expect(fadeState()).toBe("in"));
    expect(observeCount).toBe(0);
  });
});

describe("prefers-reduced-motion - §1's hard requirement", () => {
  it("is visible immediately, on the very first render, with no observer attached", () => {
    setReducedMotion(true);
    render(
      <FadeIn>
        <p data-testid="content">Hoe het werkt</p>
      </FadeIn>,
    );

    // Not "eventually visible" - visible synchronously, before any effect
    // has had a chance to run. A reduced-motion visitor never sees a
    // hidden state at all.
    expect(fadeState()).toBe("in");
    expect(observeCount).toBe(0);
  });

  it("applies to the hero too", () => {
    setReducedMotion(true);
    render(
      <FadeIn trigger="load">
        <h1 data-testid="content">Hero</h1>
      </FadeIn>,
    );
    expect(fadeState()).toBe("in");
  });
});

describe("failing towards visible when the mechanism is unavailable", () => {
  it("shows the content when IntersectionObserver does not exist", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    setReducedMotion(false);

    render(
      <FadeIn>
        <p data-testid="content">Hoe het werkt</p>
      </FadeIn>,
    );

    // The alternative - leaving it at opacity 0 forever - would hide the
    // section outright. Never acceptable for a decorative mechanism.
    await waitFor(() => expect(fadeState()).toBe("in"));
  });

  it("shows the content when matchMedia does not exist", async () => {
    vi.stubGlobal("matchMedia", undefined);

    render(
      <FadeIn trigger="load">
        <p data-testid="content">Hero</p>
      </FadeIn>,
    );

    await waitFor(() => expect(fadeState()).toBe("in"));
  });
});

describe("the stagger and layout hooks section 2 needs", () => {
  it("applies delayMs as a transition-delay, not a timer", () => {
    render(
      <FadeIn delayMs={90}>
        <p data-testid="content">Tweede kaart</p>
      </FadeIn>,
    );
    // A CSS delay is overridden by the same reduced-motion media query
    // that overrides the transition; a setTimeout would still be pending.
    expect(screen.getByTestId("content").parentElement?.style.transitionDelay).toBe("90ms");
  });

  it("sets no delay at all when delayMs is zero", () => {
    render(
      <FadeIn>
        <p data-testid="content">Eerste kaart</p>
      </FadeIn>,
    );
    expect(screen.getByTestId("content").parentElement?.style.transitionDelay).toBe("");
  });

  it("passes className through, so the wrapper can carry a grid cell", () => {
    render(
      <FadeIn className="h-full">
        <p data-testid="content">Kaart</p>
      </FadeIn>,
    );
    expect(screen.getByTestId("content").parentElement?.className).toBe("h-full");
  });

  it("renders its children regardless of fade state - the text is in the DOM from the start", () => {
    render(
      <FadeIn>
        <p data-testid="content">Drie stappen, dezelfde methode</p>
      </FadeIn>,
    );
    // Hidden is opacity, never absence: the content is present for
    // assistive technology and for crawlers even before it fades in.
    expect(screen.getByText("Drie stappen, dezelfde methode")).toBeInTheDocument();
    expect(fadeState()).toBe("");
  });
});
