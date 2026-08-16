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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WizardProvider } from "@/app/rapport/nieuw/_state/wizard-state";
import {
  createPaymentIntent,
  REPORT_CURRENCY,
  REPORT_PRICE_CENTS,
  retrievePaymentIntent,
} from "@/lib/payments/stripe-mock";
import { TEST_CARDS } from "@/lib/payments/test-cards";
import { PaymentForm } from "../payment-form";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

/**
 * The release itself is a route, not reachable from jsdom - it has its
 * own golden tests (vrijgeven/__tests__). What matters here is the
 * form's half of the contract: that a successful payment triggers the
 * release, and that its answer decides what the customer sees next.
 */
let releaseResponse: { ok: boolean; body: unknown };

beforeEach(() => {
  pushMock.mockClear();
  releaseResponse = {
    ok: true,
    body: { result: { scenarioOutcomes: [] }, data: { pand: { address: "Teststraat 1" } } },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: releaseResponse.ok,
      json: async () => releaseResponse.body,
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderWithIntent() {
  const intent = await createPaymentIntent({
    amount: REPORT_PRICE_CENTS,
    currency: REPORT_CURRENCY,
  });
  render(
    <WizardProvider>
      <PaymentForm clientSecret={intent.client_secret} />
    </WizardProvider>,
  );
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

    await waitFor(() => expect(screen.getByText(/Betaling geslaagd/)).toBeInTheDocument());
    expect(screen.getByText(/doorrekening start nu/i)).toBeInTheDocument();

    // The form is gone: there is nothing left to pay.
    expect(screen.queryByLabelText("Kaartnummer")).not.toBeInTheDocument();

    // The release was asked for, and its answer carried the customer on.
    expect(fetch).toHaveBeenCalledWith("/rapport/betalen/vrijgeven", { method: "POST" });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/rapport/resultaat"));

    // And the service agrees, which is what the release route asks too.
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

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/rapport/resultaat"));
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

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/rapport/resultaat"));
    const server = await retrievePaymentIntent(intent.id);
    expect(server!.status).toBe("succeeded");
  });
});

describe("PaymentForm - paid, but the release refused", () => {
  it("explains that nothing is lost and offers a way to reach a person", async () => {
    releaseResponse = {
      ok: false,
      body: {
        error:
          "Uw betaling is gelukt, maar het rapport kon niet worden doorgerekend. " +
          "Er is niets kwijt: uw gegevens staan klaar en uw betaling is geregistreerd.",
        contact: "support@thesourcinggroup.example",
      },
    };

    await renderWithIntent();
    await payWith(TEST_CARDS.success);

    await waitFor(() =>
      expect(screen.getByText("Het rapport kon niet worden vrijgegeven")).toBeInTheDocument(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/niets kwijt/);
    expect(screen.getByRole("link", { name: "support@thesourcinggroup.example" })).toHaveAttribute(
      "href",
      "mailto:support@thesourcinggroup.example",
    );

    // Not carried on to a report that does not exist.
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("does not offer a retry, because a second attempt would fail identically", async () => {
    releaseResponse = { ok: false, body: { error: "Mislukt.", contact: null } };

    await renderWithIntent();
    await payWith(TEST_CARDS.success);

    await waitFor(() =>
      expect(screen.getByText("Het rapport kon niet worden vrijgegeven")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Kaartnummer")).not.toBeInTheDocument();
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
