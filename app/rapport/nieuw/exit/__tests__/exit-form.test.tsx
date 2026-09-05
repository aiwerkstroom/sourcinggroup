// @vitest-environment jsdom

/**
 * Step 4's two silent failures, both found while repairing the paid
 * chain's golden test and both reproducible by a customer.
 *
 * 1. THE PRE-FILL RACE. The plusvalía estimate arrives from a Server
 *    Action - a network round trip. Until it landed, the effect wrote its
 *    result over the field unconditionally, so anyone who typed the
 *    figure before the answer came back had it erased a beat later. With
 *    no cadastral land value in step 2 there is no estimate at all, so
 *    what got written was the empty string, and the customer only learned
 *    of it at "Doorgaan naar betaling" - as a required-field error on a
 *    field they had visibly filled in. That is exactly what stranded
 *    chain.test.ts, which fills this field and never fills a cadastral
 *    value.
 *
 * 2. THE UNREADABLE ERROR RESPONSE. The prepare route answers 400 with
 *    { issues } for input the engine refuses. Anything else - a 500, an
 *    HTML error document - is not JSON, and response.json() threw
 *    straight out of the submit handler: the spinner stopped, the button
 *    came back, and nothing was said. The same class of silence as the
 *    payment-store bug that stranded people on this very step.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlusvaliaPrefill } from "@/lib/rules/es/plusvalia-prefill";
import { useWizard, WizardProvider } from "../../_state/wizard-state";
import { ExitForm } from "../exit-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const { fetchPlusvaliaPrefill } = vi.hoisted(() => ({ fetchPlusvaliaPrefill: vi.fn() }));
vi.mock("../actions", () => ({ fetchPlusvaliaPrefill }));

const NO_ESTIMATE: PlusvaliaPrefill = {
  estimatedTax: null,
  source: "none",
  coefficientUsed: null,
  taxRate: 0.297,
};

const AN_ESTIMATE: PlusvaliaPrefill = {
  estimatedTax: 4200,
  source: "cadastralEstimate",
  coefficientUsed: 0.12,
  taxRate: 0.297,
};

/**
 * Step 4 redirects to step 1 when the earlier steps were never completed
 * (wizard state is not persisted, so a cold entry has nothing to build
 * on). Marking them completed is what a customer arriving normally would
 * have done, and is the only way this form renders at all.
 */
function Primer({ children }: { children: React.ReactNode }) {
  const { markCompleted, completedSteps } = useWizard();
  useEffect(() => {
    markCompleted("pand");
    markCompleted("staat-en-lasten");
    markCompleted("belegger");
  }, [markCompleted]);
  return completedSteps.has("belegger") ? <>{children}</> : null;
}

function renderForm() {
  return render(
    <WizardProvider>
      <Primer>
        <ExitForm />
      </Primer>
    </WizardProvider>,
  );
}

const plusvaliaField = () => screen.getByLabelText(/Plusvalía municipal/);

beforeEach(() => {
  push.mockReset();
  fetchPlusvaliaPrefill.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the plusvalía pre-fill must not erase what the customer typed", () => {
  it("keeps a value typed while the Server Action is still in flight", async () => {
    // The exact shape of the live failure: the answer is deliberately
    // held until after the customer has typed.
    let answer: (prefill: PlusvaliaPrefill) => void = () => {};
    fetchPlusvaliaPrefill.mockReturnValue(
      new Promise<PlusvaliaPrefill>((resolve) => {
        answer = resolve;
      }),
    );

    renderForm();
    await waitFor(() => expect(fetchPlusvaliaPrefill).toHaveBeenCalled());

    fireEvent.change(plusvaliaField(), { target: { value: "3.500" } });
    expect(plusvaliaField()).toHaveValue("3.500");

    // Now the round trip completes - with no estimate, which is what a
    // customer who left the cadastral land value blank in step 2 gets.
    //
    // act() with an async callback rather than waitFor(): the write this
    // guards against lands a microtask LATER, so waitFor would pass on
    // its first attempt, before the thing under test had happened at all.
    // (Verified by mutation - with waitFor here, removing the guard from
    // the form still left this test green.) act flushes the pending
    // promise and the re-render it causes, so the assertion below runs
    // strictly after the effect has had its say.
    await act(async () => {
      answer(NO_ESTIMATE);
    });

    // The value survives. Before the fix this became "" right here.
    expect(plusvaliaField()).toHaveValue("3.500");
  });

  it("keeps a typed value even when an estimate WAS available", async () => {
    // Not the same case: here the effect has a real figure to write, and
    // must still not overrule a customer who has already answered.
    let answer: (prefill: PlusvaliaPrefill) => void = () => {};
    fetchPlusvaliaPrefill.mockReturnValue(
      new Promise<PlusvaliaPrefill>((resolve) => {
        answer = resolve;
      }),
    );

    renderForm();
    await waitFor(() => expect(fetchPlusvaliaPrefill).toHaveBeenCalled());
    fireEvent.change(plusvaliaField(), { target: { value: "1.234" } });

    await act(async () => {
      answer(AN_ESTIMATE);
    });

    // Without the guard this reads "4200" - the estimate overruling an
    // answer the customer had already given.
    expect(plusvaliaField()).toHaveValue("1.234");
  });

  it("still writes the estimate into a field the customer has not touched", async () => {
    // The guard must not have cost the feature it guards.
    fetchPlusvaliaPrefill.mockResolvedValue(AN_ESTIMATE);
    renderForm();
    await waitFor(() => expect(plusvaliaField()).toHaveValue("4200"));
  });

  it("leaves the field empty for manual entry when no estimate is possible", async () => {
    fetchPlusvaliaPrefill.mockResolvedValue(NO_ESTIMATE);
    renderForm();
    await waitFor(() => expect(fetchPlusvaliaPrefill).toHaveBeenCalled());
    await waitFor(() => expect(plusvaliaField()).toHaveValue(""));
  });
});

describe("a failed prepare call must say so, not fail silently", () => {
  /** Fills what step 4 needs so submitting reaches the fetch. */
  async function readyToSubmit() {
    fetchPlusvaliaPrefill.mockResolvedValue(NO_ESTIMATE);
    renderForm();
    await waitFor(() => expect(fetchPlusvaliaPrefill).toHaveBeenCalled());
    fireEvent.change(plusvaliaField(), { target: { value: "3.500" } });
  }

  const submit = () =>
    fireEvent.click(screen.getByRole("button", { name: "Doorgaan naar betaling" }));

  it("shows a visible message when the response is not JSON at all", async () => {
    // A 500 serving an HTML error document - what a missing payment_intents
    // table, or any unhandled throw in the route, actually produces.
    // Deliberately no heading element in this fixture, despite that being
    // what a real error page carries: app/__tests__/typography.test.ts
    // greps every h1-h3 in app/ - test files included - to prove none is a
    // bare figure, and a status code inside one here trips it. (Naming the
    // markup in this comment tripped it too.) The fixture only has to be
    // un-parseable as JSON, which this is.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<!doctype html><p>Internal Server Error</p>", { status: 500 })),
    );

    await readyToSubmit();
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Er ging iets mis bij het voorbereiden van de betaling/);
    // And it says what it means for the customer, not just that it broke.
    expect(alert).toHaveTextContent(/Uw gegevens zijn bewaard/);
    // Specifically NOT the connectivity message: the request reached the
    // server and the server answered - it just answered with something
    // unreadable. Telling this customer to check their connection would
    // send them chasing a problem they do not have. (This is the half the
    // outer catch alone gets wrong: without the inner guard the parse
    // error falls through to it and is reported as a network failure.)
    expect(alert).not.toHaveTextContent(/verbinding/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a visible message when the request never reaches the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await readyToSubmit();
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Er ging iets mis bij het voorbereiden van de betaling/);
    expect(alert).toHaveTextContent(/verbinding/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("re-enables the button, so a failure is recoverable rather than a dead end", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nonsense", { status: 502 })),
    );

    await readyToSubmit();
    submit();

    await screen.findByRole("alert");
    const button = screen.getByRole("button", { name: "Doorgaan naar betaling" });
    expect(button).not.toBeDisabled();
  });

  it("still shows the engine's own issue list, with its own heading, for a 400", async () => {
    // The case this form was always built for must survive the guard.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ issues: ["De LTV is hoger dan wat de bank verstrekt."] }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    await readyToSubmit();
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Het rapport kan zo niet worden doorgerekend/);
    expect(alert).toHaveTextContent(/De LTV is hoger dan wat de bank verstrekt./);
  });

  it("navigates to the payment page when the route accepts the input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ clientSecret: "pi_x_secret_y", amount: 4900, currency: "eur" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    await readyToSubmit();
    submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/rapport/betalen"));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
