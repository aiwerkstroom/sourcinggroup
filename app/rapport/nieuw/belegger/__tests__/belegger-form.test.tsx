// @vitest-environment jsdom

/**
 * Fase C stap 3: the financing terms made visible and overridable in step
 * 3, plus the LTV copy that came with it.
 *
 * The bundle guard at the bottom is the one this file exists for above
 * all. Fase C stap 1 shipped the whole parameter database to the browser
 * by importing a calculation-layer helper into a client form, and this
 * step needed a *live* derivation - the exact shape of that mistake. The
 * bands come in as a prop instead; this pins that they keep doing so.
 */

import { readFile } from "node:fs/promises";
import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { derivedAllInInterestRate } from "@/lib/rules/es/financing";
import {
  FINANCING_STRATEGIES,
  NON_RESIDENT_TYPICAL_LTV_RANGE,
} from "@/lib/rules/es/parameters";
import type { FinancingStrategyId } from "@/lib/rules/es/types";
import type { FinancingBand } from "../../_lib/financing-bands";
import { useWizard, WizardProvider } from "../../_state/wizard-state";
import { BeleggerForm } from "../belegger-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("../actions", () => ({
  fetchRentPrefill: vi.fn(async () => ({ longTerm: null, shortTerm: null, source: "none" })),
}));

const TIER_ORDER: readonly FinancingStrategyId[] = ["low", "medium", "high"];

/** Exactly what belegger/page.tsx builds and hands down. */
const BANDS: readonly FinancingBand[] = TIER_ORDER.map((id) => ({
  maxLtv: FINANCING_STRATEGIES[id].ltv.value,
  loanTermYears: FINANCING_STRATEGIES[id].loanTermYears.value,
  allInRate: derivedAllInInterestRate({
    preferredLtv: FINANCING_STRATEGIES[id].ltv.value,
    strategy: id,
    residency: "nonResident",
  }),
}));

/**
 * Step 3 redirects to step 1 when the earlier steps were never completed
 * (wizard state is not persisted, so a cold entry has nothing to build
 * on). Marking them completed is what a customer arriving normally would
 * have done, and is the only way this form renders at all.
 */
function Primer({ children }: { children: React.ReactNode }) {
  const { markCompleted, completedSteps } = useWizard();
  useEffect(() => {
    markCompleted("pand");
    markCompleted("staat-en-lasten");
  }, [markCompleted]);
  return completedSteps.has("staat-en-lasten") ? <>{children}</> : null;
}

function renderForm() {
  return render(
    <WizardProvider>
      <Primer>
        <BeleggerForm
          financingBands={BANDS}
          typicalLtvRange={NON_RESIDENT_TYPICAL_LTV_RANGE.value}
        />
      </Primer>
    </WizardProvider>,
  );
}

describe("BeleggerForm - the derived financing terms (fase C stap 3)", () => {
  it("says nothing about a rate until there is an LTV to derive one from", () => {
    renderForm();
    expect(screen.getByText(/dan tonen we hier met welke rente en looptijd/)).toBeInTheDocument();
  });

  it("shows the rate and term the typed LTV implies", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Gewenste LTV/), { target: { value: "75" } });
    // The high tier, all-in: 3,2% + 1,0% niet-ingezetenenopslag = 4,2%, 15 jaar.
    expect(screen.getByText(/rekenen we met 4,2% rente over 15 jaar/)).toBeInTheDocument();
  });

  it("follows the LTV to a different tier as it is retyped", () => {
    renderForm();
    const ltv = screen.getByLabelText(/Gewenste LTV/);
    fireEvent.change(ltv, { target: { value: "60" } });
    expect(screen.getByText(/3,5% rente over 25 jaar/)).toBeInTheDocument();
    fireEvent.change(ltv, { target: { value: "70" } });
    expect(screen.getByText(/3,85% rente over 20 jaar/)).toBeInTheDocument();
  });

  it("pairs term and rate from one tier at 62%, the LTV that used to split them", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Gewenste LTV/), { target: { value: "62" } });
    // Medium's own pair - not low's 25 years at medium's rate.
    expect(screen.getByText(/3,85% rente over 20 jaar/)).toBeInTheDocument();
  });
});

describe("BeleggerForm - the bank-offer override (fase C stap 3)", () => {
  it("hides the override fields until the customer says they have an offer", () => {
    renderForm();
    expect(screen.queryByLabelText(/^Rente/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Looptijd/)).not.toBeInTheDocument();
  });

  it("reveals both fields, each optional, once ticked", () => {
    renderForm();
    fireEvent.click(screen.getByLabelText(/Ik heb een concreet aanbod van mijn bank/));
    expect(screen.getByLabelText(/^Rente/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Looptijd/)).toBeInTheDocument();
  });

  it("prefills nothing, but shows the derived figures as placeholders", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText(/Gewenste LTV/), { target: { value: "75" } });
    fireEvent.click(screen.getByLabelText(/Ik heb een concreet aanbod van mijn bank/));
    const rate = screen.getByLabelText(/^Rente/) as HTMLInputElement;
    const term = screen.getByLabelText(/^Looptijd/) as HTMLInputElement;
    expect(rate.value).toBe("");
    expect(term.value).toBe("");
    expect(rate.placeholder).toBe("4,2");
    expect(term.placeholder).toBe("15");
  });

  it("tells the customer their rate is taken as all-in, so no surcharge is added", () => {
    renderForm();
    fireEvent.click(screen.getByLabelText(/Ik heb een concreet aanbod van mijn bank/));
    expect(screen.getByText(/inclusief eventuele opslagen voor niet-ingezetenen/)).toBeInTheDocument();
    expect(screen.getByText(/We tellen er niets bovenop/)).toBeInTheDocument();
  });
});

describe("BeleggerForm - the three LTV fields each explain themselves (fase C stap 3)", () => {
  it("says the wanted LTV also drives the rate and term, and that those are overridable", () => {
    renderForm();
    expect(screen.getByText(/Hieruit leiden we ook de rente en looptijd af/)).toBeInTheDocument();
    expect(screen.getByText(/u kunt ze overschrijven met een concreet aanbod van uw bank/)).toBeInTheDocument();
  });

  it("explains what the minimum and maximum bounds actually do", () => {
    renderForm();
    expect(screen.getByText(/Ligt uw gewenste LTV lager, dan rekenen we alsnog met deze ondergrens/)).toBeInTheDocument();
    expect(screen.getByText(/Ligt uw gewenste LTV hoger, dan rekenen we met deze bovengrens/)).toBeInTheDocument();
  });

  it("tells the customer what lenders typically offer a non-resident, from the sourced range", () => {
    renderForm();
    expect(
      screen.getByText(
        /Spaanse banken financieren aan niet-ingezetenen doorgaans tussen 60% en 70%/,
      ),
    ).toBeInTheDocument();
  });

  it("renders that range from the parameter, not from a second hardcoded pair", () => {
    // The figures in the sentence have to move if the sourced range ever
    // does - otherwise the copy silently outlives its own source.
    renderForm();
    const { min, max } = NON_RESIDENT_TYPICAL_LTV_RANGE.value;
    const expected = new RegExp(
      `doorgaans tussen ${Math.round(min * 100)}% en ${Math.round(max * 100)}%`,
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});

describe("BeleggerForm - the client bundle stays free of parameters.ts (fase C stap 3)", () => {
  it("does not import the calculation layer's parameter modules", async () => {
    const source = await readFile("app/rapport/nieuw/belegger/belegger-form.tsx", "utf8");
    // The derivation this step needed is live, so it cannot be resolved
    // once on the server - the bands arrive as a prop instead. These four
    // are the imports that would pull the parameter database in.
    expect(source).not.toMatch(/from "@\/lib\/rules\/es\/parameters"/);
    expect(source).not.toMatch(/from "@\/lib\/rules\/es\/derive-selections"/);
    expect(source).not.toMatch(/from "@\/lib\/rules\/es\/financing"/);
    expect(source).not.toMatch(/from "@\/lib\/rules\/es\/engine"/);
  });

  it("financing-bands.ts, which it does import, is itself parameter-free", async () => {
    const source = await readFile("app/rapport/nieuw/_lib/financing-bands.ts", "utf8");
    expect(source).not.toMatch(/^import /m);
  });
});
