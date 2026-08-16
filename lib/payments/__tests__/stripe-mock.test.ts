/**
 * Golden test for stripe-mock.ts (fase 4 stap 2, stap 1 van 5).
 *
 * The check that matters most here is the last describe block: after a
 * declined or unconfirmed payment, retrievePaymentIntent() must still
 * report the intent as unpaid. That is the trust boundary the release
 * route will rest on - if the registry could be talked into reporting
 * `succeeded` by anything other than a real confirmation, the whole
 * payment gate is decorative. Testing it now, against the mock, is what
 * makes the later swap to the real SDK a swap rather than a rewrite.
 */

import { describe, expect, it } from "vitest";
import {
  completeAuthentication,
  confirmPayment,
  createPaymentIntent,
  REPORT_CURRENCY,
  REPORT_PRICE_CENTS,
  retrievePaymentIntent,
  TEST_CARDS,
} from "../stripe-mock";

async function newIntent() {
  return createPaymentIntent({ amount: REPORT_PRICE_CENTS, currency: REPORT_CURRENCY });
}

describe("createPaymentIntent", () => {
  it("creates an unpaid intent for the report price, shaped like Stripe's own", async () => {
    const intent = await newIntent();

    expect(intent.id).toMatch(/^pi_[0-9a-f]{24}$/);
    expect(intent.client_secret).toMatch(/^pi_[0-9a-f]{24}_secret_[0-9a-f]{24}$/);
    expect(intent.client_secret.startsWith(intent.id)).toBe(true);
    expect(intent.status).toBe("requires_payment_method");
    expect(intent.amount).toBe(4900);
    expect(intent.currency).toBe("eur");
  });

  it("gives every intent its own id and secret", async () => {
    const [first, second] = await Promise.all([newIntent(), newIntent()]);
    expect(first.id).not.toBe(second.id);
    expect(first.client_secret).not.toBe(second.client_secret);
  });
});

describe("retrievePaymentIntent", () => {
  it("finds an intent that was created", async () => {
    const created = await newIntent();
    const found = await retrievePaymentIntent(created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.status).toBe("requires_payment_method");
  });

  it("returns null for an unknown id rather than throwing", async () => {
    expect(await retrievePaymentIntent("pi_doesnotexist")).toBeNull();
  });

  it("hands back a copy, so a caller cannot mutate the registry into a paid state", async () => {
    const created = await newIntent();
    const found = await retrievePaymentIntent(created.id);
    found!.status = "succeeded";

    const reread = await retrievePaymentIntent(created.id);
    expect(reread!.status).toBe("requires_payment_method");
  });
});

describe("confirmPayment", () => {
  it("succeeds on the success test card and the registry agrees", async () => {
    const intent = await newIntent();
    const outcome = await confirmPayment({
      clientSecret: intent.client_secret,
      cardNumber: TEST_CARDS.success,
    });

    expect(outcome.error).toBeNull();
    expect(outcome.paymentIntent!.status).toBe("succeeded");

    const server = await retrievePaymentIntent(intent.id);
    expect(server!.status).toBe("succeeded");
  });

  it("accepts the card number with spaces, the way people type it", async () => {
    const intent = await newIntent();
    const outcome = await confirmPayment({
      clientSecret: intent.client_secret,
      cardNumber: "4242 4242 4242 4242",
    });

    expect(outcome.error).toBeNull();
    expect(outcome.paymentIntent!.status).toBe("succeeded");
  });

  it("declines the declined test card and leaves the intent payable", async () => {
    const intent = await newIntent();
    const outcome = await confirmPayment({
      clientSecret: intent.client_secret,
      cardNumber: TEST_CARDS.declined,
    });

    expect(outcome.paymentIntent).toBeNull();
    expect(outcome.error).toEqual({
      type: "card_error",
      code: "card_declined",
      message: "Uw kaart is geweigerd. Probeer een andere kaart.",
    });

    // Payable again, not dead - the customer can try another card.
    const server = await retrievePaymentIntent(intent.id);
    expect(server!.status).toBe("requires_payment_method");
  });

  it("rejects a card number that is neither of the known test cards", async () => {
    const intent = await newIntent();
    const outcome = await confirmPayment({
      clientSecret: intent.client_secret,
      cardNumber: "1234567812345678",
    });

    expect(outcome.paymentIntent).toBeNull();
    expect(outcome.error!.code).toBe("incorrect_number");
  });

  it("rejects an unknown client secret", async () => {
    const outcome = await confirmPayment({
      clientSecret: "pi_nothing_secret_nothing",
      cardNumber: TEST_CARDS.success,
    });

    expect(outcome.paymentIntent).toBeNull();
    expect(outcome.error!.type).toBe("invalid_request_error");
    expect(outcome.error!.code).toBe("resource_missing");
  });

  it("rejects a malformed client secret that carries no intent id", async () => {
    const outcome = await confirmPayment({
      clientSecret: "not-a-secret",
      cardNumber: TEST_CARDS.success,
    });

    expect(outcome.error!.code).toBe("resource_missing");
  });

  it("refuses to confirm an intent that already succeeded", async () => {
    const intent = await newIntent();
    await confirmPayment({ clientSecret: intent.client_secret, cardNumber: TEST_CARDS.success });

    const second = await confirmPayment({
      clientSecret: intent.client_secret,
      cardNumber: TEST_CARDS.success,
    });

    expect(second.paymentIntent).toBeNull();
    expect(second.error!.code).toBe("payment_intent_unexpected_state");
  });
});

describe("3-D Secure path - the full page load this phase's dataflow was designed around", () => {
  it("parks the intent in requires_action, then completes it", async () => {
    const intent = await newIntent();

    const confirmed = await confirmPayment({
      clientSecret: intent.client_secret,
      cardNumber: TEST_CARDS.requiresAuthentication,
    });
    expect(confirmed.error).toBeNull();
    expect(confirmed.paymentIntent!.status).toBe("requires_action");

    // Not paid yet - this is the state the customer is in while away at
    // their bank, and the release route must refuse a report here.
    const midway = await retrievePaymentIntent(intent.id);
    expect(midway!.status).toBe("requires_action");

    const completed = await completeAuthentication(intent.client_secret);
    expect(completed.error).toBeNull();
    expect(completed.paymentIntent!.status).toBe("succeeded");

    const server = await retrievePaymentIntent(intent.id);
    expect(server!.status).toBe("succeeded");
  });

  it("refuses to complete an intent that is not awaiting authentication", async () => {
    const intent = await newIntent();
    const outcome = await completeAuthentication(intent.client_secret);

    expect(outcome.paymentIntent).toBeNull();
    expect(outcome.error!.code).toBe("payment_intent_unexpected_state");
  });
});

describe("trust boundary - the registry is the only authority on payment", () => {
  it("reports a fresh intent as unpaid", async () => {
    const intent = await newIntent();
    const server = await retrievePaymentIntent(intent.id);
    expect(server!.status).not.toBe("succeeded");
  });

  it("reports a declined intent as unpaid, whatever the caller was told", async () => {
    const intent = await newIntent();
    await confirmPayment({ clientSecret: intent.client_secret, cardNumber: TEST_CARDS.declined });

    const server = await retrievePaymentIntent(intent.id);
    expect(server!.status).not.toBe("succeeded");
  });

  it("reports an intent awaiting 3-D Secure as unpaid", async () => {
    const intent = await newIntent();
    await confirmPayment({
      clientSecret: intent.client_secret,
      cardNumber: TEST_CARDS.requiresAuthentication,
    });

    const server = await retrievePaymentIntent(intent.id);
    expect(server!.status).not.toBe("succeeded");
  });

  it("carries the amount through, so the release route can check it was the report price", async () => {
    const underpaid = await createPaymentIntent({ amount: 1, currency: REPORT_CURRENCY });
    await confirmPayment({ clientSecret: underpaid.client_secret, cardNumber: TEST_CARDS.success });

    const server = await retrievePaymentIntent(underpaid.id);
    expect(server!.status).toBe("succeeded");
    // Succeeded, but for one cent. Status alone is not enough; stap 4's
    // release route has to compare the amount against REPORT_PRICE_CENTS.
    expect(server!.amount).not.toBe(REPORT_PRICE_CENTS);
  });
});
