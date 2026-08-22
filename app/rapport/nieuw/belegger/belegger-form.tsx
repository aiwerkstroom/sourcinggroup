"use client";

/**
 * Step 3 of the paid wizard: the investor (UI_SPEC.md §3).
 *
 * Three things happen here that the earlier steps set up.
 *
 * 1. The permit gate closes. rentalStrategyAvailability() decides which
 *    strategies are offered, from step 2's licence answer. Without a
 *    licence short-term and hybrid are not rendered as disabled options -
 *    they are not rendered (UI_SPEC.md §4: "ze verschijnen niet als nul,
 *    ze verschijnen niet"). A note explains the absence, which is the
 *    form's equivalent of §4's "het rapport legt uit waarom".
 *
 * 2. The rent rate is pre-filled and overridable. The source is decided
 *    server-side (rent-prefill.ts, via actions.ts) because it reads
 *    parameters.ts: the property's observed current rent wins where it
 *    exists, otherwise the wijk reference, otherwise nothing. Typing over
 *    the pre-fill is expected, and what the customer ends up with decides
 *    which of the four rentInputProvenance statuses the report carries.
 *
 * 3. The four constraints UI_SPEC.md §3 does not list are asked outright
 *    (interview round 1, "alle vier uitvragen"), since the feasibility
 *    dimension (SCORE_SPEC.md §2.4) measures against them.
 *
 * Percentages are typed as percentages and divided by 100 before the
 * engine's own field rules see them - one definition of a valid LTV,
 * expressed in the engine's units.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RENTAL_STRATEGY_COPY_NL } from "@/lib/copy/es/selections";
import { translateFieldValidation } from "@/lib/copy/es/validation";
import {
  checkHoldingYears,
  checkLtvRange,
  checkMaxLtv,
  checkMaxMonthlyDebt,
  checkMaxRenovationBudget,
  checkMinLtv,
  checkMinMonthlyCashflow,
  checkOccupancyLongTerm,
  checkOccupancyShortTerm,
  checkOwnMoney,
  checkPreferredLtv,
  checkRentPerM2LongTerm,
  checkRentPerM2ShortTerm,
  checkTotalBudget,
} from "@/lib/rules/es/field-validation";
import type { FieldValidationKey } from "@/lib/rules/es/field-validation";
import { rentalStrategyAvailability } from "@/lib/rules/es/licensing";
import type { RentPrefillSource } from "@/lib/rules/es/rent-prefill";
import type { RentalStrategy } from "@/lib/rules/es/types";
import { FieldGroup, NumberField, RadioGroup, SelectField } from "../_components/fields";
import { parseNumberInput } from "../_lib/parse-number";
import { OTHER_NEIGHBORHOOD, useWizard } from "../_state/wizard-state";
import type { BeleggerStepData } from "../_state/wizard-state";
import { fetchRentPrefill } from "./actions";

type FieldErrors = Partial<Record<keyof BeleggerStepData, string>>;

const RENTED_TO_RATE: Readonly<Record<string, "longTerm" | "shortTerm">> = {
  rentedLongTerm: "longTerm",
  rentedShortTerm: "shortTerm",
};

/** Formats a rate for a pre-filled field: two decimals, comma, as the customer would type it. */
function formatRate(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

function validateRequired(
  raw: string,
  rule: (value: number) => FieldValidationKey | null,
  transform: (value: number) => number = (v) => v,
): string | undefined {
  const parsed = parseNumberInput(raw);
  if (parsed.state === "empty") return translateFieldValidation("required");
  if (parsed.state === "invalid") return translateFieldValidation("mustBeANumber");
  const key = rule(transform(parsed.value));
  return key === null ? undefined : translateFieldValidation(key);
}

const PREFILL_SOURCE_NOTE: Readonly<Record<RentPrefillSource, string | null>> = {
  actualCurrentRent:
    "Voorgevuld met de werkelijke huidige huur van dit pand, omgerekend naar €/m². Dat is een waarneming aan dit gebouw, geen schatting — het rapport vermeldt dat zo.",
  neighborhoodReference:
    "Voorgevuld met de referentiehuur van uw wijk (Idealista/Fotocasa, 2025). Weet u een betere waarde uit een vergelijkbare advertentie, pas hem dan aan — het rapport vermeldt dat u de waarde zelf heeft ingevuld.",
  none: "Voor deze wijk hebben we geen referentiehuur. Vul zelf een waarde in; het rapport vermeldt dat er geen marktreferentie beschikbaar was.",
};

/**
 * Three options for two Spanish tax treatments: "Nederland" and "ander
 * EU-land" are identical under IRNR today. They are asked separately
 * because the customer is answering a question about themselves, not
 * about Spanish tax law - and "ander EU-land" is a different fact about
 * them, one that matters for their own domestic treatment.
 */
const TAX_RESIDENCY_OPTIONS = [
  { value: "netherlands", label: "Nederland" },
  { value: "otherEu", label: "Een ander EU-/EER-land" },
  { value: "nonEu", label: "Buiten de EU (bijv. VK, Zwitserland, VS, VAE)" },
];

export function BeleggerForm() {
  const router = useRouter();
  const { data, setBelegger, completedSteps, markCompleted } = useWizard();
  const step = data.belegger;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [prefillSource, setPrefillSource] = useState<{
    longTerm: RentPrefillSource;
    shortTerm: RentPrefillSource;
    usableAreaWasDerived: boolean;
  } | null>(null);

  const hasLicence = data.staatEnLasten.hasTouristRentalLicense === "yes";
  const availability = rentalStrategyAvailability(hasLicence);
  const offered = availability.available;

  // A cold entry - a refresh, or a pasted URL - has no step 1 or 2 answers,
  // and this step cannot be rendered honestly without them: the permit
  // answer decides which strategies exist, and the wijk decides the
  // pre-fill. Nothing is persisted (see wizard-state.tsx), so the only
  // truthful move is to start over rather than show a form built on blanks.
  const coldEntry = !completedSteps.has("pand") || !completedSteps.has("staat-en-lasten");
  useEffect(() => {
    if (coldEntry) router.replace("/rapport/nieuw/pand");
  }, [coldEntry, router]);

  // Runs once: re-running would overwrite an edit the customer just made,
  // which is the opposite of "overschrijven mag". The cancellation flag
  // covers a navigation away mid-request - the answer is then stale and
  // must not land in a form nobody is looking at any more.
  const pandStep = data.pand;
  const staatStep = data.staatEnLasten;
  useEffect(() => {
    if (coldEntry || step.rentPrefilled) return;

    const built = parseNumberInput(pandStep.builtAreaM2);
    if (built.state !== "ok") return;
    const usable = parseNumberInput(pandStep.usableAreaM2);
    const currentRent = parseNumberInput(staatStep.currentRentMonthly);

    let cancelled = false;
    void (async () => {
      const prefill = await fetchRentPrefill({
        neighborhood:
          pandStep.neighborhood === "" || pandStep.neighborhood === OTHER_NEIGHBORHOOD
            ? undefined
            : pandStep.neighborhood,
        builtAreaM2: built.value,
        usableAreaM2: usable.state === "ok" ? usable.value : undefined,
        actualCurrentRentMonthly: currentRent.state === "ok" ? currentRent.value : undefined,
        actualCurrentRentAppliesTo: RENTED_TO_RATE[staatStep.currentRentStatus],
      });
      if (cancelled) return;

      setPrefillSource({
        longTerm: prefill.longTerm.source,
        shortTerm: prefill.shortTerm.source,
        usableAreaWasDerived: prefill.usableAreaWasDerived,
      });
      setBelegger({
        rentPerM2LongTerm:
          prefill.longTerm.rentPerM2 === null ? "" : formatRate(prefill.longTerm.rentPerM2),
        rentPerM2ShortTerm:
          prefill.shortTerm.rentPerM2 === null ? "" : formatRate(prefill.shortTerm.rentPerM2),
        rentFromActualCurrentRent:
          prefill.longTerm.source === "actualCurrentRent"
            ? "longTerm"
            : prefill.shortTerm.source === "actualCurrentRent"
              ? "shortTerm"
              : "",
        rentPrefilled: true,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [coldEntry, step.rentPrefilled, pandStep, staatStep, setBelegger]);

  if (coldEntry) return null;

  const usesLongTerm = step.rentalStrategy === "longTerm" || step.rentalStrategy === "hybrid";
  const usesShortTerm = step.rentalStrategy === "shortTerm" || step.rentalStrategy === "hybrid";

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    const percent = (value: number) => value / 100;

    next.ownMoney = validateRequired(step.ownMoney, checkOwnMoney);
    next.totalBudget = validateRequired(step.totalBudget, checkTotalBudget);
    next.maxRenovationBudget = validateRequired(
      step.maxRenovationBudget,
      checkMaxRenovationBudget,
    );
    next.preferredLtvPercent = validateRequired(
      step.preferredLtvPercent,
      (v) => checkPreferredLtv(v),
      percent,
    );
    next.minLtvPercent = validateRequired(step.minLtvPercent, checkMinLtv, percent);
    next.maxLtvPercent = validateRequired(step.maxLtvPercent, checkMaxLtv, percent);
    next.maxMonthlyDebt = validateRequired(step.maxMonthlyDebt, checkMaxMonthlyDebt);
    next.minMonthlyCashflow = validateRequired(step.minMonthlyCashflow, checkMinMonthlyCashflow);
    next.minRoiTargetPercent = validateRequired(step.minRoiTargetPercent, () => null);
    next.holdingYears = validateRequired(step.holdingYears, checkHoldingYears);

    // Only compare the bounds once both are individually sound, so a
    // single broken field does not produce two complaints.
    if (next.minLtvPercent === undefined && next.maxLtvPercent === undefined) {
      const min = parseNumberInput(step.minLtvPercent);
      const max = parseNumberInput(step.maxLtvPercent);
      if (min.state === "ok" && max.state === "ok") {
        const key = checkLtvRange(percent(min.value), percent(max.value));
        if (key !== null) next.minLtvPercent = translateFieldValidation(key);
      }
    }

    if (step.taxResidency === "") {
      next.taxResidency = translateFieldValidation("required");
    }
    if (step.rentalStrategy === "") {
      next.rentalStrategy = translateFieldValidation("required");
    }
    if (usesLongTerm) {
      next.rentPerM2LongTerm = validateRequired(step.rentPerM2LongTerm, checkRentPerM2LongTerm);
    }
    if (usesShortTerm) {
      next.rentPerM2ShortTerm = validateRequired(
        step.rentPerM2ShortTerm,
        checkRentPerM2ShortTerm,
      );
    }

    // Bezettingsgraad: optional (datakwaliteitsfix stap 3) - blank is valid
    // and falls back to the engine's own PLACEHOLDER, so only a non-empty,
    // out-of-range value is rejected here.
    const occupancyLongTerm = parseNumberInput(step.occupancyLongTermPercent);
    if (occupancyLongTerm.state === "invalid") {
      next.occupancyLongTermPercent = translateFieldValidation("mustBeANumber");
    } else if (occupancyLongTerm.state === "ok") {
      const key = checkOccupancyLongTerm(percent(occupancyLongTerm.value));
      if (key !== null) next.occupancyLongTermPercent = translateFieldValidation(key);
    }
    const occupancyShortTerm = parseNumberInput(step.occupancyShortTermPercent);
    if (occupancyShortTerm.state === "invalid") {
      next.occupancyShortTermPercent = translateFieldValidation("mustBeANumber");
    } else if (occupancyShortTerm.state === "ok") {
      const key = checkOccupancyShortTerm(percent(occupancyShortTerm.value));
      if (key !== null) next.occupancyShortTermPercent = translateFieldValidation(key);
    }

    for (const key of Object.keys(next) as (keyof BeleggerStepData)[]) {
      if (next[key] === undefined) delete next[key];
    }
    return next;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    markCompleted("belegger");
    router.push("/rapport/nieuw/exit");
  }

  const field = (key: keyof BeleggerStepData) => ({
    value: String(step[key]),
    onChange: (value: string) => {
      setBelegger({ [key]: value });
      if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    },
    error: errors[key],
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-10">
      <div>
        <h2 className="text-lg font-semibold">De belegger</h2>
        <p className="text-text-muted mt-1 max-w-prose text-sm">
          Uw vermogen, uw randvoorwaarden en de strategie waarmee we rekenen.
        </p>
      </div>

      <FieldGroup title="Vermogen en budget">
        <NumberField
          label="Beschikbaar eigen vermogen"
          unit="€"
          placeholder="115.000"
          {...field("ownMoney")}
        />
        <NumberField
          label="Totaalbudget"
          unit="€"
          placeholder="450.000"
          hint="Het maximum dat u in totaal aan deze aankoop wilt besteden, inclusief kosten koper."
          {...field("totalBudget")}
        />
        <NumberField
          label="Renovatiebudget"
          unit="€"
          placeholder="60.000"
          hint="Het maximum dat u aan renovatie wilt uitgeven. Het model kiest het renovatiescenario op basis van de staat van onderhoud uit stap 2 en toetst de kosten hieraan."
          {...field("maxRenovationBudget")}
        />
      </FieldGroup>

      <FieldGroup title="Financiering">
        <NumberField
          label="Gewenste LTV"
          unit="%"
          placeholder="70"
          hint="Welk deel van de aankoopprijs u wilt financieren. Dit bepaalt ook met welke rente en looptijd het model rekent."
          {...field("preferredLtvPercent")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField label="Minimale LTV" unit="%" placeholder="60" {...field("minLtvPercent")} />
          <NumberField label="Maximale LTV" unit="%" placeholder="75" {...field("maxLtvPercent")} />
        </div>
        <NumberField
          label="Maximale maandlast"
          unit="€"
          placeholder="1.000"
          hint="De hoogste maandelijkse hypotheeklast die u acceptabel vindt."
          {...field("maxMonthlyDebt")}
        />
      </FieldGroup>

      <FieldGroup title="Uw randvoorwaarden">
        <NumberField
          label="Minimale maandcashflow"
          unit="€"
          placeholder="500"
          hint="Wat het pand u maandelijks minimaal moet opleveren. Een negatief bedrag mag: dat betekent dat u bereid bent bij te leggen."
          {...field("minMonthlyCashflow")}
        />
        <NumberField
          label="Minimale ROI"
          unit="%"
          placeholder="4"
          hint="Uw rendementseis. De score meet niet de absolute IRR maar hoeveel het rendement hierboven uitkomt."
          {...field("minRoiTargetPercent")}
        />
        <NumberField
          label="Houdperiode"
          unit="jaar"
          placeholder="10"
          hint="Hoe lang u het pand wilt aanhouden voordat u verkoopt."
          {...field("holdingYears")}
        />
      </FieldGroup>

      <FieldGroup title="Uw fiscale woonplaats">
        <SelectField
          label="Waar bent u fiscaal inwoner?"
          options={TAX_RESIDENCY_OPTIONS}
          placeholder="Kies uw fiscale woonplaats"
          hint="Spanje belast huurinkomsten van EU/EER-inwoners tegen 19% over de nettohuur - dus na aftrek van rente, comunidad, IBI en afschrijving. Inwoners van buiten de EU betalen 24% over de brutohuur, zonder enige aftrek. Dat verschil is in de praktijk een factor twee tot drie, dus het rapport kan hier niet van uitgaan."
          {...field("taxResidency")}
        />
      </FieldGroup>

      <FieldGroup title="Verhuurstrategie">
        {!hasLicence ? (
          <p className="border-border text-text-muted -mt-2 max-w-prose rounded-md border border-dashed px-3 py-2.5 text-xs leading-relaxed">
            U gaf in stap 2 aan dat dit pand geen título habilitante heeft. Kortetermijn- en
            hybride verhuur worden daarom niet aangeboden en komen niet in het rapport voor — ook
            niet als nul. Het rapport legt uit waarom ze ontbreken.
          </p>
        ) : null}
        <RadioGroup
          label="Waarmee wilt u rekenen?"
          options={offered.map((strategy: RentalStrategy) => ({
            value: strategy,
            label: RENTAL_STRATEGY_COPY_NL[strategy],
          }))}
          {...field("rentalStrategy")}
        />
      </FieldGroup>

      <FieldGroup title="Huurwaarde">
        {step.rentalStrategy === "" ? (
          <p className="text-text-faint -mt-2 max-w-prose text-xs">
            Kies eerst een verhuurstrategie; daarna vraagt dit onderdeel alleen de huurwaarden die
            u daadwerkelijk nodig heeft.
          </p>
        ) : null}
        {usesLongTerm ? (
          <NumberField
            label="Langetermijnhuur"
            unit="€/m²"
            hint={PREFILL_SOURCE_NOTE[prefillSource?.longTerm ?? "none"] ?? undefined}
            {...field("rentPerM2LongTerm")}
          />
        ) : null}
        {usesShortTerm ? (
          <NumberField
            label="Kortetermijnhuur"
            unit="€/m²"
            hint={PREFILL_SOURCE_NOTE[prefillSource?.shortTerm ?? "none"] ?? undefined}
            {...field("rentPerM2ShortTerm")}
          />
        ) : null}
        {usesLongTerm ? (
          <NumberField
            label="Bezettingsgraad langetermijn"
            unit="%"
            placeholder="90"
            hint="Hoeveel van het jaar het pand naar verwachting daadwerkelijk verhuurd is. Leeg laten mag: het rapport rekent dan met een geschatte marktaanname en vermeldt dat bij de aannames."
            {...field("occupancyLongTermPercent")}
          />
        ) : null}
        {usesShortTerm ? (
          <NumberField
            label="Bezettingsgraad kortetermijn"
            unit="%"
            placeholder="60"
            hint="Hoeveel van het jaar het pand naar verwachting daadwerkelijk verhuurd is. Leeg laten mag: het rapport rekent dan met een geschatte marktaanname en vermeldt dat bij de aannames."
            {...field("occupancyShortTermPercent")}
          />
        ) : null}
        {prefillSource?.usableAreaWasDerived && usesLongTerm ? (
          <p className="text-text-faint -mt-2 max-w-prose text-xs">
            Omgerekend over een geschat bruikbaar oppervlak, omdat u dat in stap 1 niet heeft
            ingevuld. Het rapport vermeldt die schatting bij de aannames.
          </p>
        ) : null}
      </FieldGroup>

      <div className="border-border flex items-center justify-between gap-4 border-t pt-6">
        <button
          type="button"
          onClick={() => router.push("/rapport/nieuw/staat-en-lasten")}
          className="border-accent text-accent focus-visible:ring-accent-ring rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-subtle focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Terug
        </button>
        <div className="flex items-center gap-4">
          <p className="text-text-faint text-xs">Stap 3 van 4</p>
          <button
            type="submit"
            className="bg-accent text-surface focus-visible:ring-accent-ring rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Volgende: exit
          </button>
        </div>
      </div>
    </form>
  );
}
