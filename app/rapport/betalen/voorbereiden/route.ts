import { cookies } from "next/headers";
import { buildEngineInput, WizardAssemblyError } from "@/app/rapport/nieuw/_lib/build-engine-input";
import type { WizardData } from "@/app/rapport/nieuw/_state/wizard-state";
import {
  createPaymentIntent,
  REPORT_CURRENCY,
  REPORT_PRICE_CENTS,
} from "@/lib/payments/stripe-mock";
import { assertValidEngineInput, ValidationError } from "@/lib/rules/es/validation";
import { PENDING_INPUT_COOKIE, storePendingInput } from "../_lib/pending-input";

/**
 * Opens a payment (fase 4 stap 2). Called when the customer leaves the
 * wizard's last step, before the payment page renders.
 *
 * The wizard's WizardData arrives in the POST body, never a querystring -
 * the same rule fase 3's pdf/genereer route follows, for the same reason:
 * this payload carries a full address and a household's financial
 * position. What goes back to the browser is a client secret and an
 * amount. The input itself stays here, behind an opaque token in an
 * httpOnly cookie (pending-input.ts explains why it has to survive a full
 * page load at all).
 *
 * THE VALIDATION GATE, and the reason this route validates without
 * calculating.
 *
 * Reordering the flow moved runEngine() to after the payment, which
 * quietly moved its validation there too - and that is the one thing that
 * must not happen. runEngine()'s first line is
 * assertValidEngineInput(input) (lib/rules/es/engine.ts), so before this
 * phase every cross-field problem surfaced at the exit step, for free.
 * Left alone, a customer could pay EUR 49 and only then be told their
 * input cannot be computed.
 *
 * The two are separable: buildEngineInput() throws WizardAssemblyError on
 * anything unparseable, and assertValidEngineInput() is exported on its
 * own and carries every cross-field rule. Running both here reproduces
 * exactly the checks runEngine() would have made, and none of the
 * calculation - which stays where this phase's brief puts it, after a
 * successful payment. It is therefore not possible to reach the payment
 * page with input that cannot produce a report.
 */

export const dynamic = "force-dynamic";

export interface PreparePaymentResponse {
  clientSecret: string;
  amount: number;
  currency: string;
}

export async function POST(request: Request) {
  let data: WizardData;
  try {
    data = await request.json();
  } catch {
    return Response.json({ issues: ["Ongeldige aanvraag."] }, { status: 400 });
  }

  try {
    assertValidEngineInput(buildEngineInput(data));
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ issues: error.issues }, { status: 400 });
    }
    if (error instanceof WizardAssemblyError) {
      return Response.json({ issues: [`Onvolledige invoer: ${error.field}`] }, { status: 400 });
    }
    throw error;
  }

  const intent = await createPaymentIntent({
    amount: REPORT_PRICE_CENTS,
    currency: REPORT_CURRENCY,
  });
  const token = await storePendingInput({ data, paymentIntentId: intent.id });

  // httpOnly: the browser carries this token but must never be able to
  // read or forge it in JS - it is the only thing standing between a
  // request and someone else's pending report. sameSite "lax" rather than
  // "strict" on purpose: a redirect-based payment method returns the
  // customer from another origin, and "strict" would withhold the cookie
  // on exactly that navigation, stranding them on a page that cannot find
  // their input.
  const cookieStore = await cookies();
  cookieStore.set(PENDING_INPUT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 60,
  });

  const body: PreparePaymentResponse = {
    clientSecret: intent.client_secret,
    amount: intent.amount,
    currency: intent.currency,
  };
  return Response.json(body);
}
