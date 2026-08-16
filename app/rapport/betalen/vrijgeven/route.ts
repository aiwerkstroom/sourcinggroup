import { cookies } from "next/headers";
import { buildEngineInput, WizardAssemblyError } from "@/app/rapport/nieuw/_lib/build-engine-input";
import type { WizardData } from "@/app/rapport/nieuw/_state/wizard-state";
import { REPORT_PRICE_CENTS, retrievePaymentIntent } from "@/lib/payments/stripe-mock";
import { runEngine } from "@/lib/rules/es/engine";
import type { EngineResult } from "@/lib/rules/es/types";
import { ValidationError } from "@/lib/rules/es/validation";
import {
  PENDING_INPUT_COOKIE,
  readPendingInput,
  takePendingInput,
} from "../_lib/pending-input";

/**
 * Releases the report after payment (fase 4 stap 2, stap 4 van 5). This
 * is where runEngine() finally runs - after the payment, never before.
 *
 * WHO DECIDES THAT SOMETHING WAS PAID FOR. Not the browser. The token
 * comes from an httpOnly cookie the browser cannot read or forge, and
 * the payment itself is checked by asking the payment service directly.
 * A request saying "I paid" is not evidence of anything, and in the mock
 * it would be trivially forgeable - which is exactly why the check has
 * to be here rather than in the form that calls it.
 *
 * Status alone is not the check, either. An intent can succeed for one
 * cent: stripe-mock.ts's own golden test pins that. So the amount is
 * compared against REPORT_PRICE_CENTS as well, and an underpayment is
 * refused as firmly as no payment at all.
 *
 * THE ORDER IS THE DESIGN, and it is chosen so that no failure can leave
 * a half-released state:
 *
 *   1. read the input WITHOUT consuming it
 *   2. runEngine()
 *   3. only on success: consume the input, clear the cookie, hand over
 *      the report
 *
 * If runEngine() throws after the customer has paid - rare, because the
 * validation gate in voorbereiden/route.ts already refuses input that
 * cannot be computed, but not impossible - nothing is consumed and
 * nothing is cleared. The payment stands, so it can be settled or
 * refunded by hand; the input stays put, so the failure is reproducible
 * rather than gone. The customer gets a plain explanation and a contact
 * address instead of a report. Losing someone's EUR 49 and their input
 * at the same moment is the one outcome this route must never produce.
 *
 * Consuming on success is what keeps one payment to one report: the
 * token is single-use, so a replayed request finds nothing.
 */

export const dynamic = "force-dynamic";

/**
 * PLACEHOLDER - no support address exists anywhere in this project yet.
 * It is one constant on purpose: when the real address is known it is a
 * one-line change, and until then the failure path still tells the
 * customer that a human can be reached rather than leaving them with a
 * dead end.
 */
const SUPPORT_EMAIL = "support@thesourcinggroup.example";

export interface ReleaseSuccess {
  result: EngineResult;
  /**
   * Handed back so the result page can render even when the browser
   * arrives with nothing: a customer returning from a redirect-based
   * payment method has lost the wizard's React state entirely, and the
   * report's header and its PDF button both need this.
   */
  data: WizardData;
}

export interface ReleaseFailure {
  error: string;
  contact?: string;
}

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_INPUT_COOKIE)?.value;

  if (token === undefined) {
    return Response.json(
      { error: "Er staat geen betaling klaar. Begin opnieuw bij stap 1." } satisfies ReleaseFailure,
      { status: 404 },
    );
  }

  const pending = await readPendingInput(token);
  if (pending === null) {
    return Response.json(
      {
        error:
          "Deze betaling is niet meer beschikbaar. Is uw rapport al vrijgegeven, " +
          "of duurde de betaling te lang? Neem contact op als er wel is afgerekend.",
        contact: SUPPORT_EMAIL,
      } satisfies ReleaseFailure,
      { status: 404 },
    );
  }

  const intent = await retrievePaymentIntent(pending.paymentIntentId);

  if (intent === null || intent.status !== "succeeded") {
    return Response.json(
      { error: "De betaling is nog niet voltooid." } satisfies ReleaseFailure,
      { status: 402 },
    );
  }

  // Not a formality: a succeeded intent for the wrong amount is still a
  // succeeded intent, and releasing on status alone would hand out the
  // report for whatever was actually paid.
  if (intent.amount !== REPORT_PRICE_CENTS) {
    return Response.json(
      {
        error: "Het betaalde bedrag komt niet overeen met de prijs van het rapport.",
        contact: SUPPORT_EMAIL,
      } satisfies ReleaseFailure,
      { status: 402 },
    );
  }

  let result: EngineResult;
  try {
    result = runEngine(buildEngineInput(pending.data));
  } catch (error) {
    if (error instanceof ValidationError || error instanceof WizardAssemblyError) {
      // Paid, but not computable. Deliberately leaves the input in place
      // and the cookie untouched - see the module docstring.
      return Response.json(
        {
          error:
            "Uw betaling is gelukt, maar het rapport kon niet worden doorgerekend. " +
            "Er is niets kwijt: uw gegevens staan klaar en uw betaling is geregistreerd. " +
            "Neem contact op, dan lossen we het handmatig op of storten we terug.",
          contact: SUPPORT_EMAIL,
        } satisfies ReleaseFailure,
        { status: 500 },
      );
    }
    throw error;
  }

  // Past this point the report exists, so consuming is safe.
  await takePendingInput(token);
  cookieStore.set(PENDING_INPUT_COOKIE, "", { path: "/", maxAge: 0 });

  return Response.json({ result, data: pending.data } satisfies ReleaseSuccess);
}
