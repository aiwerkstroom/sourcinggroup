import { referenceCase } from "@/lib/rules/es/__tests__/referencecase";
import { runEngine } from "@/lib/rules/es/engine";
import { DemoDocument } from "./_components/demo-document";

/**
 * A demo route for review meetings and sales conversations: the full nine-
 * section paid report on the fixed Valencia reference case, reachable
 * without signing up and without paying.
 *
 * Deliberately lives outside /rapport entirely (at /demo/rapport, not
 * e.g. /rapport/demo) rather than joining the print route's existing
 * carve-out in middleware.ts's matcher. That keeps this addition exactly
 * what it was asked to be - an extra route next to the paid path, not an
 * edit to the paid route, the paywall, the pending-input store or the
 * auth gate: middleware.ts's matcher (["/rapport/:path*", "/zoeken/:path*",
 * "/auth/signin", "/auth/signup"]) never sees this path at all, so nothing
 * about how those are protected had to change for this to be public.
 *
 * Not linked from the site nav - the URL is meant to be shared directly
 * for a specific conversation, not discovered by browsing. Deliberately
 * fixed to the reference case, the same choice
 * app/rapport/resultaat/print/page.tsx made for the same reason: a
 * stable, always-available render, never fed a real customer's data.
 */
export default function DemoReportPage() {
  const result = runEngine(referenceCase);
  return <DemoDocument propertyAddress={referenceCase.property.address!} result={result} />;
}
