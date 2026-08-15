import { renderUrlToPdf } from "../_lib/render-pdf";

/**
 * Renders the paid report to a PDF for the reference case - a stable,
 * always-available render for manual checks and the golden test. The real
 * download route (pdf/genereer/route.ts, fase 3 stap 3) shares this same
 * render-pdf.ts helper; only the source page differs.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const pdf = await renderUrlToPdf(`${origin}/rapport/resultaat/print`);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="rendementsrapport-referentiecasus.pdf"',
    },
  });
}
