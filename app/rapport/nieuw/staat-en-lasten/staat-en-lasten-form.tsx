"use client";

/**
 * Step 2 of the paid wizard: condition, running costs, and the permit
 * gate (UI_SPEC.md §3 and §4).
 *
 * The título habilitante question is asked here, one step before the
 * rentalStrategy choice, so the gate closes before short-term and hybrid
 * are ever offered (interview round 1). UI_SPEC.md §4 is emphatic that
 * without a licence those scenarios do not appear as zero - they do not
 * appear - so this step tells the customer up front what their answer
 * will do, rather than letting them pick a strategy in step 3 that
 * validateEngineInput() would then reject.
 *
 * Two of UI_SPEC.md §3's three specially-flagged fields live here (gastos
 * de comunidad, kadastrale waarde) and carry the explanations §3 writes
 * for them verbatim.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MAINTENANCE_CONDITION_COPY_NL,
  MAINTENANCE_CONDITION_ORDER,
} from "@/lib/copy/es/selections";
import { translateFieldValidation } from "@/lib/copy/es/validation";
import {
  checkCadastralConstruccion,
  checkCadastralSuelo,
  checkCommunityFeesAnnual,
} from "@/lib/rules/es/field-validation";
import { FieldGroup, NumberField, RadioGroup, SelectField } from "../_components/fields";
import { parseNumberInput } from "../_lib/parse-number";
import { useWizard } from "../_state/wizard-state";
import type { StaatEnLastenStepData } from "../_state/wizard-state";

const RENT_STATUS_OPTIONS = [
  { value: "vacant", label: "Leegstaand" },
  { value: "rentedLongTerm", label: "Verhuurd — langetermijncontract" },
  { value: "rentedShortTerm", label: "Verhuurd — kortetermijn/toeristisch" },
  { value: "ownUse", label: "In eigen gebruik" },
];

const RENTED_STATUSES = new Set(["rentedLongTerm", "rentedShortTerm"]);

const LICENCE_OPTIONS = [
  {
    value: "yes",
    label: "Ja, het pand heeft een geldig título habilitante",
    description:
      "Kortetermijn- en hybride verhuur blijven beschikbaar als strategie in de volgende stap.",
  },
  {
    value: "no",
    label: "Nee, of ik weet het niet zeker",
    description:
      "Het rapport rekent dan uitsluitend met langetermijnverhuur. Kortetermijn en hybride verschijnen niet — ook niet als nul — en het rapport legt uit waarom.",
  },
];

type FieldErrors = Partial<Record<keyof StaatEnLastenStepData, string>>;

export function StaatEnLastenForm() {
  const router = useRouter();
  const { data, setStaatEnLasten, markCompleted } = useWizard();
  const step = data.staatEnLasten;
  const [errors, setErrors] = useState<FieldErrors>({});

  const isRented = RENTED_STATUSES.has(step.currentRentStatus);

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (step.maintenanceCondition === "") {
      next.maintenanceCondition = translateFieldValidation("required");
    }

    // MODEL_SPEC.md §15: mandatory, no default anywhere in the engine.
    const fees = parseNumberInput(step.communityFeesAnnual);
    if (fees.state === "empty") {
      next.communityFeesAnnual = translateFieldValidation("required");
    } else if (fees.state === "invalid") {
      next.communityFeesAnnual = translateFieldValidation("mustBeANumber");
    } else {
      const key = checkCommunityFeesAnnual(fees.value);
      if (key !== null) next.communityFeesAnnual = translateFieldValidation(key);
    }

    // MODEL_SPEC.md §16: the cadastral value is optional as a whole, but
    // half of it is not usable - IBI needs suelo + construcción together.
    const suelo = parseNumberInput(step.cadastralSuelo);
    const construccion = parseNumberInput(step.cadastralConstruccion);
    const sueloGiven = suelo.state !== "empty";
    const construccionGiven = construccion.state !== "empty";

    if (sueloGiven || construccionGiven) {
      if (suelo.state === "empty") {
        next.cadastralSuelo = translateFieldValidation("required");
      } else if (suelo.state === "invalid") {
        next.cadastralSuelo = translateFieldValidation("mustBeANumber");
      } else {
        const key = checkCadastralSuelo(suelo.value);
        if (key !== null) next.cadastralSuelo = translateFieldValidation(key);
      }

      if (construccion.state === "empty") {
        next.cadastralConstruccion = translateFieldValidation("required");
      } else if (construccion.state === "invalid") {
        next.cadastralConstruccion = translateFieldValidation("mustBeANumber");
      } else {
        const key = checkCadastralConstruccion(construccion.value);
        if (key !== null) next.cadastralConstruccion = translateFieldValidation(key);
      }
    }

    if (step.currentRentStatus === "") {
      next.currentRentStatus = translateFieldValidation("required");
    }
    if (isRented) {
      const rent = parseNumberInput(step.currentRentMonthly);
      if (rent.state === "invalid") {
        next.currentRentMonthly = translateFieldValidation("mustBeANumber");
      }
    }

    // MODEL_SPEC.md §18: a mandatory boolean with no default. An
    // unanswered question must not slide through as "no licence".
    if (step.hasTouristRentalLicense === "") {
      next.hasTouristRentalLicense = translateFieldValidation("required");
    }

    for (const key of Object.keys(next) as (keyof StaatEnLastenStepData)[]) {
      if (next[key] === undefined) delete next[key];
    }
    return next;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    markCompleted("staat-en-lasten");
    router.push("/rapport/nieuw/belegger");
  }

  const field = (key: keyof StaatEnLastenStepData) => ({
    value: step[key],
    onChange: (value: string) => {
      setStaatEnLasten({ [key]: value });
      if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    },
    error: errors[key],
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-10">
      <div>
        <h2 className="text-lg font-semibold">Staat en lasten</h2>
        <p className="text-text-muted mt-1 max-w-prose text-sm">
          De staat van het pand, de vaste lasten, en de vergunning die bepaalt welke
          verhuurstrategieën we kunnen doorrekenen.
        </p>
      </div>

      <FieldGroup title="Staat van het pand">
        <RadioGroup
          label="Staat van onderhoud"
          hint="Uw eigen inschatting van het pand zoals het er nu bij staat. Op basis hiervan kiest het model een renovatiescenario; die aanname staat in het rapport vermeld."
          options={MAINTENANCE_CONDITION_ORDER.map((condition) => ({
            value: condition,
            label: MAINTENANCE_CONDITION_COPY_NL[condition].label,
            description: MAINTENANCE_CONDITION_COPY_NL[condition].description,
          }))}
          {...field("maintenanceCondition")}
        />
      </FieldGroup>

      <FieldGroup title="Vaste lasten">
        <NumberField
          label="Gastos de comunidad per jaar"
          unit="€"
          placeholder="900"
          hint="Dit bedrag staat in de advertentie of is bij de verkoper op te vragen. Er is geen standaardwaarde: dit verschilt te sterk per gebouw (lift, zwembad, conciërge) om te schatten."
          {...field("communityFeesAnnual")}
        />
      </FieldGroup>

      <FieldGroup title="Kadastrale waarde">
        <p className="text-text-muted -mt-2 max-w-prose text-xs leading-relaxed">
          Te vinden op het IBI-aanslagbiljet (recibo del IBI), uitgesplitst naar grond en opstal.
          Vult u dit in, dan wordt de IBI-berekening en de afschrijvingsgrondslag nauwkeuriger. Laat
          u het leeg, dan meldt het rapport dat het met een benadering werkt.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumberField
            label="Waarde grond (suelo)"
            unit="€"
            optional
            {...field("cadastralSuelo")}
          />
          <NumberField
            label="Waarde opstal (construcción)"
            unit="€"
            optional
            {...field("cadastralConstruccion")}
          />
        </div>
      </FieldGroup>

      <FieldGroup title="Huidige situatie">
        <SelectField
          label="Huurstatus"
          options={RENT_STATUS_OPTIONS}
          placeholder="Kies een status"
          {...field("currentRentStatus")}
        />
        {isRented ? (
          <>
            <NumberField
              label="Werkelijke huidige huur per maand"
              unit="€"
              placeholder="1.100"
              optional
              {...field("currentRentMonthly")}
            />
            <p className="text-text-faint -mt-2 max-w-prose text-xs">
              Wordt vastgelegd in het rapport, maar telt nog niet mee in de berekening — die rekent
              met de huurwaarde die u in de volgende stap bevestigt.
            </p>
          </>
        ) : null}
      </FieldGroup>

      <FieldGroup title="Vergunning voor kortetermijnverhuur">
        <RadioGroup
          label="Heeft het pand een título habilitante?"
          hint="Kortetermijnverhuur is in Valencia sinds 31 maart 2026 vergunningsplichtig, met verzadigingslimieten per wijk. Uw antwoord bepaalt welke verhuurstrategieën in de volgende stap beschikbaar zijn."
          options={LICENCE_OPTIONS}
          {...field("hasTouristRentalLicense")}
        />
      </FieldGroup>

      <div className="border-border flex items-center justify-between gap-4 border-t pt-6">
        <button
          type="button"
          onClick={() => router.push("/rapport/nieuw/pand")}
          className="border-accent text-accent focus-visible:ring-accent-ring rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-subtle focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Terug
        </button>
        <div className="flex items-center gap-4">
          <p className="text-text-faint text-xs">Stap 2 van 4</p>
          <button
            type="submit"
            className="bg-accent text-surface focus-visible:ring-accent-ring rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Volgende: belegger
          </button>
        </div>
      </div>
    </form>
  );
}
