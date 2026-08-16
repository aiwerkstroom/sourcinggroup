import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { retrievePaymentIntent } from "@/lib/payments/stripe-mock";
import { Card } from "./_components/card";
import { PaymentForm } from "./_components/payment-form";
import { PENDING_INPUT_COOKIE, readPendingInput } from "./_lib/pending-input";

/**
 * The payment page (fase 4 stap 2, stap 3 van 5). Sits between the
 * wizard's last step and the report: the input is validated and parked,
 * the payment is opened, and runEngine() has not run yet.
 *
 * A Server Component, because everything it needs lives server-side. The
 * pending entry is read through readPendingInput() rather than
 * takePendingInput() - taking it here would consume the only handle on
 * the customer's input the moment they arrive, and they have not paid
 * yet. The release step (stap 4) is what consumes it, once.
 *
 * That this page can see what voorbereiden/route.ts wrote is not an
 * assumption: Next.js gives a Route Handler and a Page separate module
 * instances even inside one process, which is exactly how fase 3's PDF
 * token went missing. The store lives on globalThis for that reason, and
 * this boundary is now covered by a golden test rather than by hope.
 *
 * The client secret comes from the server, not from whatever the browser
 * happened to keep from the prepare call. That is both what real Stripe
 * does and what makes a redirect return work: a customer coming back
 * from their bank through a full page load has no client-side state
 * left, and this page still knows which payment they are on.
 */

export const dynamic = "force-dynamic";

/** Cents to "€ 49" - a local formatter rather than a reach into the report's private _lib. */
const EURO = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export default async function BetalenPage() {
  const token = (await cookies()).get(PENDING_INPUT_COOKIE)?.value;
  const pending = token === undefined ? null : await readPendingInput(token);

  // Cold entry: no pending payment to show. Same answer the result page
  // already gives when it has no result - start at step 1, rather than a
  // half-empty page explaining itself.
  if (pending === null) redirect("/rapport/nieuw/pand");

  const intent = await retrievePaymentIntent(pending.paymentIntentId);
  if (intent === null) redirect("/rapport/nieuw/pand");

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10 md:px-8">
      <header className="border-border border-b pb-6">
        <p className="text-text-faint text-xs tracking-widest uppercase">Betaling</p>
        <h1 className="mt-1 text-xl font-semibold">Rendementsrapport</h1>
      </header>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.2fr] md:items-start">
        <Card>
          <h2 className="text-base font-semibold">Wat u afrekent</h2>

          <dl className="mt-4 flex flex-col gap-4 text-sm">
            <div>
              <dt className="text-text-faint text-xs tracking-widest uppercase">Pand</dt>
              <dd className="mt-1">{pending.data.pand.address}</dd>
            </div>
            <div>
              <dt className="text-text-faint text-xs tracking-widest uppercase">Product</dt>
              <dd className="mt-1">
                Volledig rendementsrapport — negen secties, met PDF-download
              </dd>
            </div>
          </dl>

          <div className="border-border mt-5 flex items-baseline justify-between border-t pt-4">
            <span className="text-sm font-medium">Totaal</span>
            <span className="text-lg font-semibold tabular-nums">
              {EURO.format(intent.amount / 100)}
            </span>
          </div>

          <p className="text-text-muted mt-4 text-xs leading-relaxed">
            De doorrekening start pas na een geslaagde betaling. Uw ingevulde gegevens staan tot
            dat moment klaar en worden niet bewaard als u de betaling afbreekt.
          </p>
        </Card>

        <Card>
          <PaymentForm clientSecret={intent.client_secret} />
        </Card>
      </div>
    </div>
  );
}
