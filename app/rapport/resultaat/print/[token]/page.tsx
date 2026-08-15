import { notFound } from "next/navigation";
import { takePendingReport } from "../_lib/pending-results";
import { PrintDocument } from "../_components/print-document";

/**
 * Print rendering for a real customer's EngineResult (fase 3 stap 3).
 * Never visited by a customer's browser and never linked anywhere -
 * pdf/genereer/route.ts stores the result under `token` just before
 * calling Playwright, and this page reads it back once. A missing or
 * already-consumed token means a bug (an expired/reused link, a request
 * this page was never meant to serve), not a customer-facing state - the
 * same reasoning paid-report.tsx's NoExitPlanningNotice already applies
 * to another "should never actually happen" path.
 */
export default async function PrintByTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pending = takePendingReport(token);
  if (pending === null) notFound();

  return <PrintDocument propertyAddress={pending.propertyAddress} result={pending.result} />;
}
