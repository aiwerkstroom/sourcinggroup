// @vitest-environment jsdom

/**
 * Golden test for datakwaliteitsfix stap 6: pandtype and aantal eenheden
 * are gone from the free indication's form. Both used to be asked here,
 * shown next to a note that neither counted in the calculation - the note
 * was true and stayed true, so both fields were removed rather than kept
 * on display with that caveat.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IndicatieForm } from "../indicatie-form";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const NEIGHBORHOODS = ["El Carmen (Ciutat Vella)", "Ruzafa", "Cullera"];

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText("Postcode of wijk"), { target: { value: "Ruzafa" } });
  fireEvent.change(screen.getByLabelText("Vraagprijs", { exact: false }), {
    target: { value: "350000" },
  });
  fireEvent.change(screen.getByLabelText("Woonoppervlak (gebouwd)", { exact: false }), {
    target: { value: "90" },
  });
}

describe("IndicatieForm - no pandtype/aantal eenheden (datakwaliteitsfix stap 6)", () => {
  it("does not render a Pandtype field", () => {
    render(<IndicatieForm neighborhoods={NEIGHBORHOODS} />);
    expect(screen.queryByLabelText("Pandtype", { exact: false })).not.toBeInTheDocument();
  });

  it("does not render an Aantal eenheden field", () => {
    render(<IndicatieForm neighborhoods={NEIGHBORHOODS} />);
    expect(screen.queryByLabelText("Aantal eenheden", { exact: false })).not.toBeInTheDocument();
  });

  it("no longer shows the 'telt nog niet mee' caveat - there is nothing left it would apply to", () => {
    render(<IndicatieForm neighborhoods={NEIGHBORHOODS} />);
    expect(screen.queryByText(/telt nog niet mee/)).not.toBeInTheDocument();
  });

  it("keeps the three fields that do feed the calculation", () => {
    render(<IndicatieForm neighborhoods={NEIGHBORHOODS} />);
    expect(screen.getByLabelText("Postcode of wijk")).toBeInTheDocument();
    expect(screen.getByLabelText("Vraagprijs", { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText("Woonoppervlak (gebouwd)", { exact: false })).toBeInTheDocument();
  });
});

describe("IndicatieForm - drie versmallende velden (fase A stap 1)", () => {
  it("renders all three narrowing fields, all optional", () => {
    render(<IndicatieForm neighborhoods={NEIGHBORHOODS} />);
    expect(screen.getByLabelText("Servicekosten per jaar", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Staat van onderhoud/ })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Huurniveau/ })).toBeInTheDocument();
  });

  it("submits with none of the three query keys when all three are left blank", () => {
    push.mockClear();
    render(<IndicatieForm neighborhoods={NEIGHBORHOODS} />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Bereken indicatie" }));

    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0]![0] as string;
    expect(url).not.toContain("servicekosten");
    expect(url).not.toContain("onderhoud");
    expect(url).not.toContain("huurniveau");
  });

  it("submits with all three query keys when all three are filled in", () => {
    push.mockClear();
    render(<IndicatieForm neighborhoods={NEIGHBORHOODS} />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Servicekosten per jaar", { exact: false }), {
      target: { value: "1200" },
    });
    fireEvent.click(screen.getByLabelText(/Achterstallig onderhoud/));
    fireEvent.click(screen.getByLabelText(/Boven het wijkgemiddelde/));
    fireEvent.click(screen.getByRole("button", { name: "Bereken indicatie" }));

    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0]![0] as string;
    expect(url).toContain("servicekosten=1200");
    expect(url).toContain("onderhoud=poor");
    expect(url).toContain("huurniveau=above");
  });

  it("rejects a negative servicekosten, same rule as the paid wizard's mandatory field", () => {
    push.mockClear();
    render(<IndicatieForm neighborhoods={NEIGHBORHOODS} />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText("Servicekosten per jaar", { exact: false }), {
      target: { value: "-100" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Bereken indicatie" }));

    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText(/Servicekosten kunnen niet negatief zijn/)).toBeInTheDocument();
  });
});
