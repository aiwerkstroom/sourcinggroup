import { chromium } from "playwright";

/**
 * Renders the paid report to a PDF, by driving a real, already-running
 * page of this same app - not a second template. Playwright navigates a
 * headless Chromium to /rapport/resultaat/print (CLAUDE.md §3, "één
 * ontwerp, twee outputs") and prints that page, so every section, every
 * token from the DESIGN_SPEC visual pass, and every future change to the
 * report simply come along for free; nothing about the PDF's appearance
 * is decided in this file.
 *
 * Landscape (not the site's own portrait reading direction): section 5's
 * tienjarige-reeks table is sixteen columns wide and relies on the
 * browser's horizontal scroll to fit a narrow viewport - a PDF page has no
 * scrollbar, and a portrait page's content width can't hold that table at
 * a legible size. Landscape was chosen over a print-only restructure of
 * that one section so every page in the document stays one consistent
 * shape (fase 3 design checkpoint).
 *
 * No browser instance is reused across requests yet - each request
 * launches and closes its own. Fine for proving the mechanism; pooling a
 * long-lived browser is a later performance concern, not a correctness
 * one.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/rapport/resultaat/print`, { waitUntil: "networkidle" });
    // next/font self-hosts Inter via an async font-loading request;
    // "networkidle" alone does not guarantee the swap has happened yet.
    await page.evaluate(() => document.fonts.ready);

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
    });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="rendementsrapport-referentiecasus.pdf"',
      },
    });
  } finally {
    await browser.close();
  }
}
