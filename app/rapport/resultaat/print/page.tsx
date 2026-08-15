import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import { PaidReport } from "../_sections/paid-report";

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
 * Fixed to the reference case for now (fase 3 stap 1: prove the mechanism
 * end to end before wiring up a real customer's EngineResult in the
 * download-integration step).
 */
export default function PrintPage() {
  const result = runEngine(referenceCase);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <header className="border-border border-b pb-6">
        <p className="text-text-faint text-xs tracking-widest uppercase">Rendementsrapport</p>
        <h1 className="mt-1 text-xl font-semibold">{referenceCase.property.address}</h1>
      </header>
      <div className="mt-8">
        <PaidReport result={result} />
      </div>
    </div>
  );
}
