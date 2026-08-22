// @vitest-environment jsdom

/**
 * Golden test for datakwaliteitsfix stap 6: pandtype and aantal eenheden
 * are gone from the free indication's form. Both used to be asked here,
 * shown next to a note that neither counted in the calculation - the note
 * was true and stayed true, so both fields were removed rather than kept
 * on display with that caveat.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IndicatieForm } from "../indicatie-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const NEIGHBORHOODS = ["El Carmen (Ciutat Vella)", "Ruzafa", "Cullera"];

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
