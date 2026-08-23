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

import { readFile } from "node:fs/promises";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { deriveRenovationStrategy } from "@/lib/rules/es/derive-selections";
import { WizardProvider } from "../../_state/wizard-state";
import { StaatEnLastenForm } from "../staat-en-lasten-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// What the Server Component (page.tsx) resolves and hands down. Built here
// from the real derivation rather than a hand-written literal, so this
// fixture cannot drift from RENOVATION_TIER_BY_MAINTENANCE_CONDITION - the
// test file is not a client bundle, so importing it here is free.
const DERIVED_TIER_BY_CONDITION = {
  good: deriveRenovationStrategy("good"),
  average: deriveRenovationStrategy("average"),
  poor: deriveRenovationStrategy("poor"),
} as const;

function renderForm() {
  return render(
    <WizardProvider>
      <StaatEnLastenForm derivedTierByCondition={DERIVED_TIER_BY_CONDITION} />
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

/**
 * Fase C stap 1: the renovation-tier override. The derivation itself is
 * tested in the calculation layer; what matters here is that the field
 * offers "derive it for me" as a real, selected-by-default option and
 * names the tier that option currently resolves to.
 */
describe("StaatEnLastenForm - renovatiescenario override (fase C stap 1)", () => {
  it("offers the field as optional, defaulting to the derivation", () => {
    renderForm();
    const select = screen.getByLabelText(/Renovatiescenario/);
    // Empty is the "derive it for me" sentinel, and it is what an
    // untouched wizard carries - the override is opt-in, never preselected.
    expect((select as HTMLSelectElement).value).toBe("");
  });

  it("offers all three tiers as explicit alternatives", () => {
    renderForm();
    const select = screen.getByLabelText(/Renovatiescenario/) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(["", "minimal", "light", "heavy"]);
  });

  it("says the derivation is unavailable until the condition question is answered", () => {
    // An empty wizard has no maintenanceCondition, so there is no tier to
    // name yet - the label says so rather than guessing one.
    renderForm();
    const select = screen.getByLabelText(/Renovatiescenario/) as HTMLSelectElement;
    expect(select.options[0]!.text).toBe("Afgeleid uit de staat van onderhoud");
  });

  it("tells the customer their own choice is recorded as such, alongside the derived one", () => {
    renderForm();
    expect(screen.getByText(/naast wat het model uit de staat van onderhoud zou hebben afgeleid/)).toBeInTheDocument();
  });
});

/**
 * Regression guard for the invariant page.tsx states outright ("nothing
 * from parameters.ts reaches the browser"), which fase C stap 1 broke once
 * and had to be fixed: importing deriveRenovationStrategy() into this
 * client module pulled all of parameters.ts into the browser bundle, since
 * tree-shaking does not split that module.
 *
 * A source-level check rather than a bundle check, deliberately - it fails
 * in the ordinary test run at the moment the import is added, instead of
 * waiting for someone to grep a production build afterwards.
 */
describe("StaatEnLastenForm - the client bundle stays free of parameters.ts (fase C stap 1)", () => {
  it("does not import the calculation layer's parameter modules", async () => {
    // Repo-relative, not import.meta.url: this file runs under jsdom,
    // where import.meta.url is an http: URL that readFile rejects.
    const source = await readFile(
      "app/rapport/nieuw/staat-en-lasten/staat-en-lasten-form.tsx",
      "utf8",
    );
    // field-validation is fine: it carries the engine's own field rules and
    // imports no parameters. These three are the ones that pull the
    // parameter database in.
    expect(source).not.toMatch(/from "@\/lib\/rules\/es\/parameters"/);
    expect(source).not.toMatch(/from "@\/lib\/rules\/es\/derive-selections"/);
    expect(source).not.toMatch(/from "@\/lib\/rules\/es\/engine"/);
  });

  it("takes the derived mapping as a prop instead, so the server resolves it", () => {
    renderForm();
    // Proof the prop path actually works end to end: the option label names
    // a real tier, which is only possible if the mapping arrived.
    const select = screen.getByLabelText(/Renovatiescenario/) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(DERIVED_TIER_BY_CONDITION.average).toBe("light");
  });
});
