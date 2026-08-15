import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import { PrintDocument } from "./_components/print-document";

/**
 * Print-only rendering of the paid report. Not linked from anywhere in the
 * UI - the PDF route (app/rapport/resultaat/pdf/route.ts) is Playwright's
 * only visitor: it navigates a headless Chromium here and calls
 * page.pdf(), so this route can be a plain Server Component with no
 * client state at all. It renders the exact same PaidReport component
 * tree the wizard's result page and the golden-render tests use (CLAUDE.md
 * §3, "één ontwerp, twee outputs") - nothing here is a second design for
 * print, only a different caller of the first one.
 *
 * Fixed to the reference case - a stable, always-available render for the
 * golden test and for manually checking the print pipeline still works.
 * The real download route (fase 3 stap 3) has its own print/[token] page
 * for an actual customer's EngineResult; this one is deliberately never
 * fed real data.
 */
export default function PrintPage() {
  const result = runEngine(referenceCase);
  return <PrintDocument propertyAddress={referenceCase.property.address!} result={result} />;
}
