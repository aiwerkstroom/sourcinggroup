import { chromium } from "playwright";

/**
 * Shared by both PDF routes (the reference-case route and the real
 * download route, fase 3 stap 1 and 3): only the URL differs - which page
 * Chromium prints - not how it is printed. Landscape A4 (fase 3's print
 * checkpoint) and printBackground (without it the card/page background
 * distinction that carries most of DESIGN_SPEC.md's visual language would
 * not survive print).
 */
const PDF_OPTIONS = {
  format: "A4" as const,
  landscape: true,
  printBackground: true,
  margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
};

export async function renderUrlToPdf(url: string): Promise<Buffer> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    // next/font self-hosts Inter via an async font-loading request;
    // "networkidle" alone does not guarantee the swap has happened yet.
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf(PDF_OPTIONS);
  } finally {
    await browser.close();
  }
}
