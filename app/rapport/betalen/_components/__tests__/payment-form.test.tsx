// @vitest-environment jsdom

/**
 * Golden test for the mock Payment Element (fase 4 stap 2, stap 3 van 5):
 * the three outcomes a card can produce, each driven through the real
 * chain rather than a stubbed one.
 *
 * The server actions are deliberately not mocked. Under Vitest they are
 * ordinary async functions, so a click here reaches actions.ts, which
 * reaches stripe-mock.ts, which moves the intent in the same registry the
 * release step will later ask about - which means these tests check that
 * the form and the payment service agree, not merely that the form
 * renders what a stub was told to return. Each test opens its own real
 * PaymentIntent for the same reason.
 *
 * What is checked, per outcome:
 * - success: the form hands over to the release, and says so.
 * - declined: the message is shown AND the form stays usable, because
 *   the intent stays payable - a decline is not a dead end.
 * - 3-D Secure: the challenge panel appears, and only after confirming
 *   does the payment resolve. This is the path the whole pending-store
 *   design exists for.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createPaymentIntent,
  REPORT_CURRENCY,
  REPORT_PRICE_CENTS,
  retrievePaymentIntent,
} from "@/lib/payments/stripe-mock";
import { TEST_CARDS } from "@/lib/payments/test-cards";
import { PaymentForm } from "../payment-form";

async function renderWithIntent() {
  const intent = await createPaymentIntent({
    amount: REPORT_PRICE_CENTS,
    currency: REPORT_CURRENCY,
  });
  render(<PaymentForm clientSecret={intent.client_secret} />);
  return intent;
}

async function payWith(cardNumber: string) {
  fireEvent.change(screen.getByLabelText("Kaartnummer"), { target: { value: cardNumber } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Betaal € 49" }));
  });
}

describe("PaymentForm - what the customer sees before paying", () => {
  it("shows the price on the button and names the test environment", async () => {
    await renderWithIntent();

    expect(screen.getByRole("button", { name: "Betaal € 49" })).toBeEnabled();
    expect(screen.getByText(/Testomgeving/)).toBeInTheDocument();
    expect(screen.getByLabelText("Kaartnummer")).toBeInTheDocument();
    expect(screen.getByLabelText("Vervaldatum")).toBeInTheDocument();
    expect(screen.getByLabelText("CVC")).toBeInTheDocument();
  });
});

describe("PaymentForm - the successful card", () => {
  it("hands over to the release and tells the customer the calculation starts", async () => {
    const intent = await renderWithIntent();
    await payWith(TEST_CARDS.success);

    await waitFor(() =>
      expect(screen.getByText(/Betaling geslaagd/)).toBeInTheDocument(),
    );
    expect(screen.getByText(/doorrekening start nu/i)).toBeInTheDocument();

    // The form is gone: there is nothing left to pay.
    expect(screen.queryByLabelText("Kaartnummer")).not.toBeInTheDocument();

    // And the service agrees, which is what the release step will ask.
    const server = await retrievePaymentIntent(intent.id);
    expect(server!.status).toBe("succeeded");
  });
});

describe("PaymentForm - the declined card", () => {
  it("shows the reason and leaves the form usable for another attempt", async () => {
    const intent = await renderWithIntent();
    await payWith(TEST_CARDS.declined);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("Uw kaart is geweigerd");

    // Still payable - the customer can try another card without starting over.
    expect(screen.getByLabelText("Kaartnummer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Betaal € 49" })).toBeEnabled();

    const server = await retrievePaymentIntent(intent.id);
    expect(server!.status).toBe("requires_payment_method");
  });

  it("recovers: a second attempt with a good card succeeds", async () => {
    const intent = await renderWithIntent();
    await payWith(TEST_CARDS.declined);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    await payWith(TEST_CARDS.success);

    await waitFor(() => expect(screen.getByText(/Betaling geslaagd/)).toBeInTheDocument());
    const server = await retrievePaymentIntent(intent.id);
    expect(server!.status).toBe("succeeded");
  });
});

describe("PaymentForm - the 3-D Secure card, the path the pending-store exists for", () => {
  it("asks for confirmation at the bank instead of resolving straight away", async () => {
    const intent = await renderWithIntent();
    await payWith(TEST_CARDS.requiresAuthentication);

    await waitFor(() =>
      expect(screen.getByText("Bevestiging bij uw bank")).toBeInTheDocument(),
    );
    // Explicitly warns that the page may be left and returned to - the
    // reason the input is parked server-side rather than in React state.
    expect(screen.getByText(/kort deze pagina verlaten/)).toBeInTheDocument();
    expect(screen.queryByText(/Betaling geslaagd/)).not.toBeInTheDocument();

    // Not paid yet: the release step must refuse a report in this state.
    const midway = await retrievePaymentIntent(intent.id);
    expect(midway!.status).toBe("requires_action");
  });

  it("resolves once the confirmation is given", async () => {
    const intent = await renderWithIntent();
    await payWith(TEST_CARDS.requiresAuthentication);
    await waitFor(() => expect(screen.getByText("Bevestiging bij uw bank")).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Bevestigen" }));
    });

    await waitFor(() => expect(screen.getByText(/Betaling geslaagd/)).toBeInTheDocument());
    const server = await retrievePaymentIntent(intent.id);
    expect(server!.status).toBe("succeeded");
  });
});

describe("PaymentForm - a card number that is neither", () => {
  it("is refused without the intent leaving the payable state", async () => {
    const intent = await renderWithIntent();
    await payWith("1111222233334444");

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/kaartnummer klopt niet/i);

    const server = await retrievePaymentIntent(intent.id);
    expect(server!.status).toBe("requires_payment_method");
  });
});
