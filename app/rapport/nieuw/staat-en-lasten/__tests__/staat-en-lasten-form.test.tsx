// @vitest-environment jsdom

/**
 * Golden test for datakwaliteitsfix stap 5: the cadastral-value hint no
 * longer points at the IBI-aanslagbiljet (recibo del IBI) - not every
 * customer has that document to hand - but at the free Catastro lookup
 * (sedecatastro.gob.es), by address. Text/UX only: no calculation-layer
 * file changed for this fix, so there is nothing here that could move the
 * reference case's own numbers (engine.test.ts's anchor already covers
 * that - this file only pins the rendered copy).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WizardProvider } from "../../_state/wizard-state";
import { StaatEnLastenForm } from "../staat-en-lasten-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function renderForm() {
  return render(
    <WizardProvider>
      <StaatEnLastenForm />
    </WizardProvider>,
  );
}

describe("StaatEnLastenForm - cadastral value hint (datakwaliteitsfix stap 5)", () => {
  it("points at the free Catastro lookup tool, by address", () => {
    renderForm();
    expect(screen.getByText(/sedecatastro\.gob\.es/)).toBeInTheDocument();
    expect(screen.getByText(/op adres/)).toBeInTheDocument();
  });

  it("gives a short instruction: reference number, or the Consulta Descriptiva y Gráfica", () => {
    renderForm();
    expect(screen.getByText(/referentienummer/)).toBeInTheDocument();
    expect(screen.getByText(/Consulta Descriptiva y Gráfica/)).toBeInTheDocument();
  });

  it("no longer mentions the IBI-aanslagbiljet as the place to find it", () => {
    renderForm();
    expect(screen.queryByText(/IBI-aanslagbiljet/)).not.toBeInTheDocument();
    expect(screen.queryByText(/recibo del IBI/)).not.toBeInTheDocument();
  });

  it("keeps the existing explanation of what filling it in changes", () => {
    renderForm();
    expect(
      screen.getByText(/IBI-berekening en de afschrijvingsgrondslag nauwkeuriger/),
    ).toBeInTheDocument();
    expect(screen.getByText(/met een benadering werkt/)).toBeInTheDocument();
  });

  it("the two cadastral fields themselves are unchanged - still optional, still split grond/opstal", () => {
    renderForm();
    expect(screen.getByLabelText("Waarde grond (suelo)", { exact: false })).toHaveValue("");
    expect(screen.getByLabelText("Waarde opstal (construcción)", { exact: false })).toHaveValue("");
  });
});
