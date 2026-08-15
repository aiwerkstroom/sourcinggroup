import type { EngineResult } from "@/lib/rules/es/types";
import { PaidReport } from "../../_sections/paid-report";

/**
 * The print layout both print routes share (fase 3): the reference-case
 * route (print/page.tsx) and the real-data route (print/[token]/page.tsx)
 * differ only in where their EngineResult and address come from, not in
 * how the report is laid out - this is the one place that layout lives.
 */
export function PrintDocument({
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
      <div className="mt-8">
        <PaidReport result={result} />
      </div>
    </div>
  );
}
