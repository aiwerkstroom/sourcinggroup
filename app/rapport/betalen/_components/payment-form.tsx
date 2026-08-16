"use client";

/**
 * The mock Payment Element (fase 4 stap 2, stap 3 van 5).
 *
 * A stand-in, and deliberately labelled as one on screen. The real
 * Payment Element is an iframe served by js.stripe.com, which this
 * sandbox blocks outright (403 on CONNECT, verified) - so the card
 * fields below are ours, and the card number reaches our own server
 * rather than Stripe's. At swap time this component's fields are
 * replaced by <PaymentElement/> and its submit calls Stripe.js's
 * confirmPayment(); the states around it do not change, because they are
 * driven by the intent's status, which is Stripe's own vocabulary
 * already.
 *
 * The three states after submitting are the three a real card produces,
 * which is why the mock bothers to have them at all:
 *
 * - succeeded: on to the release.
 * - card_error: the intent stays payable, so the form stays usable and
 *   the customer can try another card. Not a dead end.
 * - requires_action: the 3-D Secure challenge. With real Stripe this is
 *   where the browser can leave the page entirely and come back through
 *   return_url - the exact case the pending-store exists for. Here it is
 *   a panel with a confirm button, standing in for that round trip.
 *
 * Layout and language follow DESIGN_SPEC.md: primary button filled blue,
 * secondary white with a blue border, errors in signal red above the
 * action, and the loading text sits in the disabled button beside the
 * spinner (§8) - the same pattern the wizard's own submit uses.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
// test-cards.ts, not stripe-mock.ts: this is a client component, and the
// mock's intent registry - the authority on whether something was paid
// for - must not be bundled for a browser.
import { TEST_CARDS } from "@/lib/payments/test-cards";
import { useWizard } from "@/app/rapport/nieuw/_state/wizard-state";
import { completeMockAuthentication, confirmMockPayment } from "../actions";
import { Spinner } from "./spinner";

type FormState =
  | "idle"
  | "confirming"
  | "requiresAction"
  | "authenticating"
  | "releasing"
  | "releaseFailed";

const primaryButton =
  "bg-accent text-surface focus-visible:ring-accent-ring flex items-center justify-center gap-2 rounded-md px-6 py-2.5 text-sm font-medium transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50";

const inputClass =
  "bg-surface border-border focus-visible:border-border-strong focus-visible:ring-accent-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

export function PaymentForm({ clientSecret }: { clientSecret: string }) {
  const router = useRouter();
  const { restoreData, setResult } = useWizard();
  const [state, setState] = useState<FormState>("idle");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<ReleaseFailureView | null>(null);

  const busy = state === "confirming" || state === "authenticating";

  /**
   * Asks the server to release the report. Nothing about the payment's
   * outcome is asserted here - the route checks the payment itself, and
   * a browser claiming success proves nothing (vrijgeven/route.ts).
   */
  async function release() {
    setState("releasing");

    const response = await fetch("/rapport/betalen/vrijgeven", { method: "POST" });
    const body = await response.json();

    if (!response.ok) {
      setReleaseError({ message: body.error, contact: body.contact ?? null });
      setState("releaseFailed");
      return;
    }

    // Restore the wizard's own input alongside the result: on a return
    // through a full page load this context is empty, and the report's
    // header and PDF button both read from it.
    restoreData(body.data);
    setResult(body.result);
    router.push("/rapport/resultaat");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setState("confirming");

    const outcome = await confirmMockPayment(clientSecret, cardNumber);

    if (outcome.error !== null) {
      setError(outcome.error.message);
      setState("idle");
      return;
    }
    if (outcome.status === "requires_action") {
      setState("requiresAction");
      return;
    }
    await release();
  }

  async function handleAuthenticate() {
    setError(null);
    setState("authenticating");

    const outcome = await completeMockAuthentication(clientSecret);

    if (outcome.error !== null) {
      setError(outcome.error.message);
      setState("requiresAction");
      return;
    }
    await release();
  }

  if (state === "releasing") {
    return <PaymentSucceeded />;
  }

  if (state === "releaseFailed" && releaseError !== null) {
    return <ReleaseFailed {...releaseError} />;
  }

  if (state === "requiresAction" || state === "authenticating") {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">Bevestiging bij uw bank</h2>
          <p className="text-text-muted mt-1 max-w-prose text-sm">
            Uw bank vraagt om een extra bevestiging voordat de betaling doorgaat. Bij een echte
            betaling opent uw bank hier haar eigen scherm; u kunt daarbij kort deze pagina verlaten
            en er daarna weer op terugkomen. Uw ingevulde gegevens blijven bewaard.
          </p>
        </div>

        {error !== null ? <PaymentError message={error} /> : null}

        <div>
          <button
            type="button"
            onClick={() => void handleAuthenticate()}
            disabled={busy}
            className={primaryButton}
          >
            {state === "authenticating" ? <Spinner /> : null}
            {state === "authenticating" ? "Betaling wordt bevestigd…" : "Bevestigen"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <h2 className="text-base font-semibold">Betaalgegevens</h2>
        <p className="text-text-muted mt-1 text-sm">Betaling per rapport. Geen abonnement.</p>
      </div>

      <MockNotice />

      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Kaartnummer</span>
          <input
            value={cardNumber}
            onChange={(event) => setCardNumber(event.target.value)}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
            className={`${inputClass} tabular-nums`}
            aria-invalid={error !== null ? true : undefined}
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Vervaldatum</span>
            <input
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="12 / 30"
              className={`${inputClass} tabular-nums`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">CVC</span>
            <input
              value={cvc}
              onChange={(event) => setCvc(event.target.value)}
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
              className={`${inputClass} tabular-nums`}
            />
          </label>
        </div>
      </div>

      {error !== null ? <PaymentError message={error} /> : null}

      <div className="border-border border-t pt-5">
        <button type="submit" disabled={busy} className={primaryButton}>
          {state === "confirming" ? <Spinner /> : null}
          {state === "confirming" ? "Betaling wordt verwerkt…" : "Betaal € 49"}
        </button>
      </div>
    </form>
  );
}

interface ReleaseFailureView {
  message: string;
  contact: string | null;
}

/**
 * Paid, and the report is being computed. runEngine() runs behind
 * /rapport/betalen/vrijgeven while this is on screen; the navigation to
 * the result happens when it returns.
 */
function PaymentSucceeded() {
  return (
    <div className="flex flex-col gap-3" role="status">
      <div className="flex items-center gap-2">
        <Spinner className="text-accent h-4 w-4" />
        <p className="text-sm font-medium">Betaling geslaagd — uw rapport wordt vrijgegeven…</p>
      </div>
      <p className="text-text-muted max-w-prose text-sm">
        De doorrekening start nu. Dat duurt een paar seconden; u hoeft deze pagina niet te
        verversen.
      </p>
    </div>
  );
}

/**
 * Paid, but the report could not be produced. The wording matters more
 * than usual here: the customer's money has moved and they have nothing
 * to show for it, so the two facts that make that bearable - the input
 * is not lost, the payment is on record - are stated plainly, with a
 * way to reach a person. No retry button: the release route refuses to
 * consume anything in this state on purpose, and a second attempt would
 * fail identically.
 */
function ReleaseFailed({ message, contact }: ReleaseFailureView) {
  return (
    <div
      role="alert"
      className="border-signal-negative/40 bg-signal-negative/5 flex flex-col gap-3 rounded-md border px-4 py-4"
    >
      <p className="text-sm font-medium">Het rapport kon niet worden vrijgegeven</p>
      <p className="text-text-muted max-w-prose text-sm leading-relaxed">{message}</p>
      {contact !== null ? (
        <p className="text-sm">
          <a href={`mailto:${contact}`} className="text-accent hover:underline">
            {contact}
          </a>
        </p>
      ) : null}
    </div>
  );
}

function PaymentError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="border-signal-negative/40 bg-signal-negative/5 rounded-md border px-4 py-3"
    >
      <p className="text-sm">{message}</p>
    </div>
  );
}

/**
 * Visible on purpose: this is not a real payment screen, and a payment
 * screen that pretends otherwise is the one kind of mock worth being
 * loud about. It doubles as the test-card reference for manual runs.
 */
function MockNotice() {
  return (
    <div className="border-border bg-canvas rounded-md border px-4 py-3">
      <p className="text-sm font-medium">Testomgeving — er wordt niets afgeschreven</p>
      <p className="text-text-muted mt-1 text-xs leading-relaxed">
        Gebruik een van deze testnummers om de drie uitkomsten te zien:
      </p>
      <ul className="text-text-muted mt-2 flex flex-col gap-1 text-xs">
        <li>
          <span className="tabular-nums">{TEST_CARDS.success}</span> — betaling slaagt
        </li>
        <li>
          <span className="tabular-nums">{TEST_CARDS.declined}</span> — kaart geweigerd
        </li>
        <li>
          <span className="tabular-nums">{TEST_CARDS.requiresAuthentication}</span> — bevestiging
          bij de bank
        </li>
      </ul>
    </div>
  );
}
