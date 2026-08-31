import type { EngineResult } from "@/lib/rules/es/types";
import { PaidReport } from "@/app/rapport/resultaat/_sections/paid-report";
import { DemoNotice } from "./demo-notice";

/**
 * The demo route's layout: the same header shape resultaat-view.tsx and
 * print-document.tsx already use (a small eyebrow label, the property
 * address as the page title), the demo notice directly under it, then the
 * unmodified nine-section PaidReport - the exact component tree the paid
 * result page and the print routes render, so this page shows the real
 * report rather than a second, drifting copy of it (CLAUDE.md §3).
 *
 * No print/screen split to make here: PaidReport already renders both the
 * interactive and static variants of its radar and cashflow chart
 * internally (print:hidden / hidden print:block), and this page is never
 * opened by a headless PDF renderer emulating print media - so loading it
 * in an ordinary browser tab already shows the interactive, on-screen
 * variant of both charts, which is what this route was asked for.
 */
export function DemoDocument({
  propertyAddress,
  result,
}: {
  propertyAddress: string;
  result: EngineResult;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <header className="border-border border-b pb-6">
        <p className="text-text-faint text-xs tracking-widest uppercase">Rendementsrapport</p>
        <h1 className="mt-1 text-xl font-semibold">{propertyAddress}</h1>
      </header>

      <div className="mt-8 flex flex-col gap-8">
        <DemoNotice propertyAddress={propertyAddress} />
        <PaidReport result={result} />
      </div>
    </div>
  );
}
