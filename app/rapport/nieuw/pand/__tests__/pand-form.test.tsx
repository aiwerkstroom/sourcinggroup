// @vitest-environment jsdom

/**
 * Golden test for PandForm's listing prefill (SOURCING_SPEC.md §4/§7 step
 * 4, stap 2 van 3). Needs a real DOM for the same reason
 * lib/auth/__tests__/useAuth.test.tsx does: this exists to prove the
 * wizard's own React context actually receives listingOrigin, which a
 * renderToStaticMarkup pass cannot exercise (there is no client-side
 * effect in a static render).
 *
 * A small Probe component reads useWizard() directly and exposes
 * data.listingOrigin as text - the same technique useAuth.test.tsx
 * already uses to make context state assertable, applied to a different
 * context.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WizardProvider, useWizard } from "../../_state/wizard-state";
import { PandForm } from "../pand-form";
import type { Listing } from "@/lib/sourcing/source/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const NEIGHBORHOODS = ["El Carmen (Ciutat Vella)", "Ruzafa", "Cullera"];

const listingWithUsableArea: Listing = {
  sourceId: "mock-030",
  title: "Groot herenhuis in El Carmen",
  neighborhood: "El Carmen (Ciutat Vella)",
  priceEUR: 620000,
  builtAreaM2: 180,
  usableAreaM2: 165,
  propertyType: "villa",
  sourceUrl: "https://mock-source.internal/listings/mock-030",
};

const listingWithoutUsableArea: Listing = {
  sourceId: "mock-009",
  title: "Studio vlak bij het strand van Cullera",
  neighborhood: "Cullera",
  priceEUR: 72000,
  builtAreaM2: 38,
  propertyType: "studio",
  sourceUrl: "https://mock-source.internal/listings/mock-009",
};

function Probe() {
  const { data } = useWizard();
  return (
    <dl>
      <dt>address</dt>
      <dd data-testid="address">{data.pand.address === "" ? "(leeg)" : data.pand.address}</dd>
      <dt>listingOrigin</dt>
      <dd data-testid="listing-origin">
        {data.listingOrigin === null ? "null" : JSON.stringify(data.listingOrigin)}
      </dd>
    </dl>
  );
}

function renderForm(prefillListing: Listing | null) {
  return render(
    <WizardProvider>
      <PandForm neighborhoods={NEIGHBORHOODS} prefillListing={prefillListing} />
      <Probe />
    </WizardProvider>,
  );
}

describe("PandForm - a chosen listing prefills the four tracked fields", () => {
  it("fills wijk, prijs, gebouwd and bruikbaar oppervlak from the listing", async () => {
    renderForm(listingWithUsableArea);

    await waitFor(() =>
      expect(screen.getByLabelText("Wijk")).toHaveValue("El Carmen (Ciutat Vella)"),
    );
    expect(screen.getByLabelText("Vraagprijs")).toHaveValue("620000");
    expect(screen.getByLabelText("Gebouwd oppervlak")).toHaveValue("180");
    expect(screen.getByLabelText("Bruikbaar oppervlak", { exact: false })).toHaveValue("165");
  });

  it("prefills pandtype without tracking it in listingOrigin", async () => {
    renderForm(listingWithUsableArea);

    await waitFor(() => expect(screen.getByLabelText("Pandtype", { exact: false })).toHaveValue("villa"));
    const origin = JSON.parse(screen.getByTestId("listing-origin").textContent!);
    expect(origin).not.toHaveProperty("propertyType");
  });

  it("never prefills the address - a listing carries no street address", async () => {
    renderForm(listingWithUsableArea);

    await waitFor(() =>
      expect(screen.getByLabelText("Wijk")).toHaveValue("El Carmen (Ciutat Vella)"),
    );
    expect(screen.getByTestId("address")).toHaveTextContent("(leeg)");
    expect(screen.getByLabelText("Volledig adres")).toHaveValue("");
  });

  it("records the listing's own values in listingOrigin, for stap 1's comparison to run against", async () => {
    renderForm(listingWithUsableArea);

    await waitFor(() => {
      const origin = JSON.parse(screen.getByTestId("listing-origin").textContent!);
      expect(origin).toEqual({
        neighborhood: "El Carmen (Ciutat Vella)",
        purchasePriceEUR: 620000,
        builtAreaM2: 180,
        usableAreaM2: 165,
      });
    });
  });

  it("leaves usableAreaM2 blank and out of listingOrigin when the listing has none", async () => {
    renderForm(listingWithoutUsableArea);

    await waitFor(() => expect(screen.getByLabelText("Wijk")).toHaveValue("Cullera"));
    expect(screen.getByLabelText("Bruikbaar oppervlak", { exact: false })).toHaveValue("");

    const origin = JSON.parse(screen.getByTestId("listing-origin").textContent!);
    expect(origin.usableAreaM2).toBeUndefined();
    expect(origin.neighborhood).toBe("Cullera");
    expect(origin.purchasePriceEUR).toBe(72000);
    expect(origin.builtAreaM2).toBe(38);
  });
});

describe("PandForm - no listing chosen (prefillListing null)", () => {
  it("renders the ordinary empty wizard - the null case falls out of the existing guard, no special-casing", () => {
    renderForm(null);

    expect(screen.getByLabelText("Volledig adres")).toHaveValue("");
    expect(screen.getByLabelText("Wijk")).toHaveValue("");
    expect(screen.getByLabelText("Vraagprijs")).toHaveValue("");
    expect(screen.getByTestId("listing-origin")).toHaveTextContent("null");
  });
});

describe("PandForm - the prefill is self-terminating, not per-mount", () => {
  it("does not reapply once listingOrigin is already set, even if the prop keeps referencing a listing", async () => {
    const { rerender } = renderForm(listingWithUsableArea);

    await waitFor(() =>
      expect(screen.getByLabelText("Vraagprijs")).toHaveValue("620000"),
    );

    // The customer edits the price by hand.
    fireEvent.change(screen.getByLabelText("Vraagprijs"), { target: { value: "615000" } });

    // A re-render with the same prefillListing prop (e.g. a parent
    // re-render for an unrelated reason) must not stomp the edit back to
    // the listing's own 620000 - listingOrigin is already set, so the
    // guard keeps the effect from reapplying.
    rerender(
      <WizardProvider>
        <PandForm neighborhoods={NEIGHBORHOODS} prefillListing={listingWithUsableArea} />
        <Probe />
      </WizardProvider>,
    );

    // The actual claim: the edit survives. listingOrigin staying set is
    // what makes it survive, not merely a side detail.
    await waitFor(() => expect(screen.getByLabelText("Vraagprijs")).toHaveValue("615000"));
    expect(screen.getByTestId("listing-origin")).not.toHaveTextContent("null");
  });
});
