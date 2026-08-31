import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import DemoReportPage from "../page";

/**
 * Golden-render check for the demo route. middleware.test.ts's browser
 * walkthrough is what actually proves the route is reachable without a
 * session (a real, unauthenticated Playwright context hitting a real
 * server) - what this file adds is the fast, no-server half: that the
 * page component itself needs no auth context, wizard state or request
 * object to render (it is a plain Server Component reading nothing but
 * the fixed reference case), and that the required notice and the full
 * nine-section report are actually in its output.
 */
describe("DemoReportPage - renders the full report with no auth or wizard state", () => {
  it("renders standalone via react-dom/server, needing no provider or request context", () => {
    // If this component reached into auth context, cookies(), or the
    // wizard's client state, this call would throw - it does not, because
    // the page reads nothing but runEngine(referenceCase).
    const html = renderToStaticMarkup(<DemoReportPage />);
    expect(html.length).toBeGreaterThan(0);
  });

  it("shows the demo notice, naming both the reference property and the illustrative purpose", () => {
    const html = renderToStaticMarkup(<DemoReportPage />);
    const noticeAt = html.indexOf("data-demo-notice");
    expect(noticeAt).toBeGreaterThan(-1);

    const text = html.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
    expect(text).toContain("voorbeeldrapport");
    expect(text).toContain(referenceCase.property.address);
    expect(text).toMatch(/ter illustratie/i);
  });

  it("styles the notice as a report card, not a warning banner", () => {
    // Card's own chrome (_components/card.tsx): a plain surface, no
    // alert-style border or background colour.
    const html = renderToStaticMarkup(<DemoReportPage />);
    const cardOpen = html.lastIndexOf("<div", html.indexOf("data-demo-notice"));
    const cardMarkup = html.slice(cardOpen, html.indexOf("data-demo-notice"));
    expect(cardMarkup).toContain("bg-surface");
    expect(cardMarkup).toContain("border-border");
    expect(cardMarkup).not.toMatch(/bg-signal|border-signal|bg-yellow|bg-red|bg-amber/);
  });

  it("puts the notice above the report, so it is read before any figure", () => {
    const html = renderToStaticMarkup(<DemoReportPage />);
    const noticeAt = html.indexOf("data-demo-notice");
    const scoreSectionAt = html.indexOf("sectie-tsg-score");
    expect(noticeAt).toBeGreaterThan(-1);
    expect(scoreSectionAt).toBeGreaterThan(-1);
    expect(noticeAt).toBeLessThan(scoreSectionAt);
  });

  it("renders all nine report sections, including the radar and the cashflow chart", () => {
    const html = renderToStaticMarkup(<DemoReportPage />);
    for (const headingId of [
      "sectie-tsg-score",
      "sectie-uitkomst",
      "sectie-scenarios",
      "sectie-cashflow-opbouw",
      "sectie-tienjarige-reeks",
      "sectie-exit",
      "sectie-toetsing",
      "sectie-aannames",
      "sectie-niet-geverifieerd",
    ]) {
      expect(html, `missing ${headingId}`).toContain(`id="${headingId}"`);
    }
    // Both new visualisations, not just the rulers and the table.
    expect((html.match(/data-radar="/g) ?? []).length).toBe(2);
    expect((html.match(/data-cashflow-chart="/g) ?? []).length).toBe(2);
  });

  it("keeps the reference case's own anchor: total score 3,7, percentile 70", () => {
    const html = renderToStaticMarkup(<DemoReportPage />);
    expect(html).toContain(">3,7<");
    expect(html).toContain("percentiel 70");

    // Independently, against the engine directly - not just string
    // matching the same page's own possibly-wrong markup.
    const base = runEngine(referenceCase).scenarioOutcomes!.find((o) => o.scenario === "base")!;
    expect(base.score!.total).toBe(3.7);
    expect(base.percentile).toBe(70);
  });
});
