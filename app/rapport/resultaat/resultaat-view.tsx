"use client";

/**
 * Thin client wrapper around the report. Its only job is reading the
 * wizard's result out of context and guarding the cold-entry case -
 * nothing is persisted (wizard-state.tsx), so a refresh or a direct visit
 * has no result to show, and starting over is the honest answer.
 *
 * The report itself (PaidReport, UI_SPEC.md §6's nine sections) is a
 * plain function component that takes the engine's own EngineResult, not
 * this wizard's client state - so the same component renders here, in a
 * golden-render test, and later from Playwright for the PDF (CLAUDE.md
 * §3, "één ontwerp, twee outputs").
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useWizard } from "../nieuw/_state/wizard-state";
import { PaidReport } from "./_sections/paid-report";

export function ResultatView() {
  const router = useRouter();
  const { result, data } = useWizard();

  useEffect(() => {
    if (result === null) router.replace("/rapport/nieuw/pand");
  }, [result, router]);
  if (result === null) return null;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10 md:px-8">
      <header className="border-border border-b pb-6">
        <p className="text-text-faint text-xs tracking-widest uppercase">Rendementsrapport</p>
        <h1 className="mt-1 text-xl font-semibold">{data.pand.address}</h1>
      </header>

      <div className="mt-8">
        <PaidReport result={result} />
      </div>
    </div>
  );
}
