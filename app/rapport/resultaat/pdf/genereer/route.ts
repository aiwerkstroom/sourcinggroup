import { buildEngineInput, WizardAssemblyError } from "@/app/rapport/nieuw/_lib/build-engine-input";
import type { WizardData } from "@/app/rapport/nieuw/_state/wizard-state";
import { runEngine } from "@/lib/rules/es/engine";
import { ValidationError } from "@/lib/rules/es/validation";
import { renderUrlToPdf } from "../../_lib/render-pdf";
import { storePendingReport } from "../../print/_lib/pending-results";

/**
 * The real download route (fase 3 stap 3): the wizard's own in-memory
 * WizardData - the same shape the release route turns into an
 * EngineResult after payment - arrives as the POST body, not a URL
 * (this task's own instruction: a full address and financial figures do
 * not belong in a querystring), and nothing here is written to a
 * database (CLAUDE.md §4 - accounts and storage are fase 4).
 *
 * buildEngineInput() + runEngine() run again here rather than trusting a
 * client-supplied EngineResult, for the same reason the paid path runs
 * them server-side at all: TSG_SCORE_DIMENSION_WEIGHTS must never
 * cross to the browser, so nothing downstream of it can either - a
 * customer's browser only ever holds the WizardData that goes in, never
 * the weighted score that comes out.
 *
 * Reuses the reference-case route's exact render chain
 * (renderUrlToPdf) - only the URL it prints changes, from the fixed
 * /print page to a one-time /print/[token] page carrying this request's
 * own result (print/_lib/pending-results.ts).
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let data: WizardData;
  try {
    data = await request.json();
  } catch {
    return Response.json({ issues: ["Ongeldige aanvraag."] }, { status: 400 });
  }

  let result;
  try {
    result = runEngine(buildEngineInput(data));
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ issues: error.issues }, { status: 400 });
    }
    if (error instanceof WizardAssemblyError) {
      return Response.json({ issues: [`Onvolledige invoer: ${error.field}`] }, { status: 400 });
    }
    throw error;
  }

  const origin = new URL(request.url).origin;
  const token = storePendingReport({ result, propertyAddress: data.pand.address });
  const pdf = await renderUrlToPdf(`${origin}/rapport/resultaat/print/${token}`);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="rendementsrapport.pdf"',
    },
  });
}
