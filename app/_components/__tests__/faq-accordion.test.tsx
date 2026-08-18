// @vitest-environment jsdom

/**
 * Golden test for the FAQ accordion (HOMEPAGE_UPGRADE_SPEC.md §7 step 2).
 *
 * Three groups of claims, in descending order of how much they matter:
 *
 *  1. The answers never leave the DOM. §5 turned the FAQ interactive, and
 *     the risk that introduces is that content which used to be plain
 *     HTML becomes click-gated - including the "geen beleggingsadvies"
 *     answer, which is a compliance position (COMPLIANCE_CHECKLIST.md
 *     §3.1) rather than a nice-to-have. These tests pin it in place.
 *  2. Keyboard and assistive technology. A native button gives Enter and
 *     Space for free, and the tests below confirm that rather than
 *     assuming it - together with aria-expanded flipping and collapsed
 *     panels being inert, so nobody tabs into an answer they cannot see.
 *  3. Reduced motion, per §1, via the shared hook.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FaqAccordion } from "../faq-accordion";
import type { FaqItem } from "../faq-accordion";

const ITEMS: FaqItem[] = [
  { question: "Wat kost het?", answer: "De gratis indicatie kost niets." },
  {
    question: "Is dit beleggingsadvies?",
    answer: "Nee. Het geeft geen persoonlijk beleggingsadvies.",
  },
  { question: "Werkt dit alleen voor Spanje?", answer: "Op dit moment wel." },
];

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

function questionButton(text: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(text, "i") });
}

/** The <dd> panel a given button controls. */
function panelFor(button: HTMLElement): HTMLElement {
  const id = button.getAttribute("aria-controls")!;
  return document.getElementById(id)!;
}

beforeEach(() => setReducedMotion(false));
afterEach(() => vi.unstubAllGlobals());

describe("every answer is in the DOM regardless of open state", () => {
  it("renders all questions and all answers when everything is closed", () => {
    render(<FaqAccordion items={ITEMS} />);

    for (const item of ITEMS) {
      expect(screen.getByText(item.question)).toBeInTheDocument();
      expect(screen.getByText(item.answer)).toBeInTheDocument();
    }
  });

  it("puts the answers in the server-rendered HTML, not behind a click", () => {
    const html = renderToStaticMarkup(<FaqAccordion items={ITEMS} />);

    // What a crawler reads, and what the homepage's own golden test
    // asserts on. The compliance answer in particular must ship as HTML.
    expect(html).toContain("Is dit beleggingsadvies?");
    expect(html).toContain("geen persoonlijk beleggingsadvies");
  });

  it("keeps the dl/dt/dd structure the page's golden test counts on", () => {
    const html = renderToStaticMarkup(<FaqAccordion items={ITEMS} />);
    expect((html.match(/<dt/g) ?? []).length).toBe(ITEMS.length);
    expect((html.match(/<dd/g) ?? []).length).toBe(ITEMS.length);
  });
});

describe("opening and closing", () => {
  it("starts with every item closed", () => {
    render(<FaqAccordion items={ITEMS} />);
    for (const item of ITEMS) {
      expect(questionButton(item.question)).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("opens an item on click and closes it again", () => {
    render(<FaqAccordion items={ITEMS} />);
    const button = questionButton("Wat kost het");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("allows several open at once - an FAQ is a reference, not a walkthrough", () => {
    render(<FaqAccordion items={ITEMS} />);

    fireEvent.click(questionButton("Wat kost het"));
    fireEvent.click(questionButton("Is dit beleggingsadvies"));

    // Opening the second must not have closed the first.
    expect(questionButton("Wat kost het")).toHaveAttribute("aria-expanded", "true");
    expect(questionButton("Is dit beleggingsadvies")).toHaveAttribute("aria-expanded", "true");
  });

  it("leaves the other items untouched when one is toggled", () => {
    render(<FaqAccordion items={ITEMS} />);

    fireEvent.click(questionButton("Wat kost het"));
    expect(questionButton("Is dit beleggingsadvies")).toHaveAttribute("aria-expanded", "false");
    expect(questionButton("Werkt dit alleen voor Spanje")).toHaveAttribute("aria-expanded", "false");
  });
});

describe("keyboard operation - §5's Enter/Space requirement", () => {
  it("uses a real button, which is what makes Enter and Space work at all", () => {
    render(<FaqAccordion items={ITEMS} />);
    // The requirement is met by construction rather than by a key
    // handler: a <div onClick> would need Enter/Space wired by hand, and
    // would drop out of the tab order too.
    expect(questionButton("Wat kost het").tagName).toBe("BUTTON");
    expect(questionButton("Wat kost het")).toHaveAttribute("type", "button");
  });

  it("is reachable by keyboard and toggles on Enter", () => {
    render(<FaqAccordion items={ITEMS} />);
    const button = questionButton("Wat kost het");

    button.focus();
    expect(button).toHaveFocus();

    // jsdom does not synthesise the click a browser fires for Enter on a
    // button, so this asserts the two halves that make it work: the
    // element is focusable and activating it toggles.
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("carries a visible focus ring, per DESIGN_SPEC §6", () => {
    render(<FaqAccordion items={ITEMS} />);
    expect(questionButton("Wat kost het").className).toContain("focus-visible:ring-2");
  });
});

describe("assistive technology", () => {
  it("links each button to the panel it controls, and back", () => {
    render(<FaqAccordion items={ITEMS} />);
    const button = questionButton("Wat kost het");
    const panel = panelFor(button);

    expect(panel).not.toBeNull();
    expect(panel.getAttribute("aria-labelledby")).toBe(button.id);
  });

  it("makes a closed panel inert, so nobody tabs into an answer they cannot see", () => {
    render(<FaqAccordion items={ITEMS} />);
    const panel = panelFor(questionButton("Wat kost het"));

    // Content staying in the DOM is deliberate; content staying in the
    // tab order while invisible would be a bug.
    expect(panel.hasAttribute("inert")).toBe(true);
  });

  it("drops inert as soon as the panel opens", () => {
    render(<FaqAccordion items={ITEMS} />);
    const button = questionButton("Wat kost het");

    fireEvent.click(button);
    expect(panelFor(button).hasAttribute("inert")).toBe(false);
  });

  it("gives every item its own ids, so two panels never collide", () => {
    render(<FaqAccordion items={ITEMS} />);
    const ids = ITEMS.map((item) => questionButton(item.question).getAttribute("aria-controls"));
    expect(new Set(ids).size).toBe(ITEMS.length);
  });
});

describe("the height transition", () => {
  it("animates grid-template-rows between 0fr and 1fr", () => {
    render(<FaqAccordion items={ITEMS} />);
    const button = questionButton("Wat kost het");
    const panel = panelFor(button);

    expect(panel.style.gridTemplateRows).toBe("0fr");
    fireEvent.click(button);
    expect(panel.style.gridTemplateRows).toBe("1fr");
  });

  it("stays within §5's 150-200ms and uses no bounce easing", () => {
    render(<FaqAccordion items={ITEMS} />);
    const transition = panelFor(questionButton("Wat kost het")).style.transition;

    const ms = Number(/(\d+)ms/.exec(transition)?.[1]);
    expect(ms).toBeGreaterThanOrEqual(150);
    expect(ms).toBeLessThanOrEqual(200);
    expect(transition).not.toMatch(/cubic-bezier|spring|bounce/i);
  });
});

describe("prefers-reduced-motion - §1, through the shared hook", () => {
  it("drops the height transition entirely", () => {
    setReducedMotion(true);
    render(<FaqAccordion items={ITEMS} />);

    expect(panelFor(questionButton("Wat kost het")).style.transition).toBe("");
  });

  it("still opens and closes - the behaviour is kept, only the animation goes", () => {
    setReducedMotion(true);
    render(<FaqAccordion items={ITEMS} />);
    const button = questionButton("Wat kost het");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(panelFor(button).style.gridTemplateRows).toBe("1fr");
  });
});
