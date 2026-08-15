"use client";

/**
 * Step 4 of the paid wizard: the exit, and the calculation.
 *
 * Two fields, both exit assumptions the engine deliberately gives no
 * default (MODEL_SPEC_FASE1B §5). They differ in how they are presented,
 * and the difference is the point:
 *
 * - The selling commission is pre-filled at 4%. A Spanish estate agent's
 *   commission has a conventional range, and confirming a figure is
 *   easier than producing one. It stays editable, and whatever is in the
 *   field is what the engine receives.
 * - The plusvalía municipal is not pre-filled. It varies per town and per
 *   holding period, so any generic figure would be a guess dressed as a
 *   starting point - exactly what MODEL_SPEC_FASE1B §5 refuses to do.
 *
 * Submitting runs the engine through a Server Action, so the scoring
 * weights never reach the browser (interview round 1).
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { translateFieldValidation } from "@/lib/copy/es/validation";
import { FieldGroup, NumberField } from "../_components/fields";
import { parseNumberInput } from "../_lib/parse-number";
import { useWizard } from "../_state/wizard-state";
import type { ExitStepData } from "../_state/wizard-state";
import { runReport } from "./actions";

type FieldErrors = Partial<Record<keyof ExitStepData, string>>;

export function ExitForm() {
  const router = useRouter();
  const { data, setExit, setResult, completedSteps, markCompleted } = useWizard();
  const step = data.exit;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [engineIssues, setEngineIssues] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const coldEntry =
    !completedSteps.has("pand") ||
    !completedSteps.has("staat-en-lasten") ||
    !completedSteps.has("belegger");
  useEffect(() => {
    if (coldEntry) router.replace("/rapport/nieuw/pand");
  }, [coldEntry, router]);
  if (coldEntry) return null;

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    const commission = parseNumberInput(step.sellingCommissionPercent);
    if (commission.state === "empty") {
      next.sellingCommissionPercent = translateFieldValidation("required");
    } else if (commission.state === "invalid") {
      next.sellingCommissionPercent = translateFieldValidation("mustBeANumber");
    } else if (commission.value < 0 || commission.value > 100) {
      next.sellingCommissionPercent = "De verkoopcommissie moet tussen 0% en 100% liggen.";
    }

    const plusvalia = parseNumberInput(step.municipalCapitalGainsTax);
    if (plusvalia.state === "empty") {
      next.municipalCapitalGainsTax = translateFieldValidation("required");
    } else if (plusvalia.state === "invalid") {
      next.municipalCapitalGainsTax = translateFieldValidation("mustBeANumber");
    } else if (plusvalia.value < 0) {
      next.municipalCapitalGainsTax = "De plusvalía kan niet negatief zijn — € 0 mag wel.";
    }

    for (const key of Object.keys(next) as (keyof ExitStepData)[]) {
      if (next[key] === undefined) delete next[key];
    }
    return next;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setEngineIssues([]);
    if (Object.keys(found).length > 0) return;

    setRunning(true);
    try {
      const outcome = await runReport(data);
      if (!outcome.ok) {
        setEngineIssues(outcome.issues);
        return;
      }
      setResult(outcome.result);
      markCompleted("exit");
      router.push("/rapport/resultaat");
    } finally {
      setRunning(false);
    }
  }

  const field = (key: keyof ExitStepData) => ({
    value: step[key],
    onChange: (value: string) => {
      setExit({ [key]: value });
      if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    },
    error: errors[key],
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-10">
      <div>
        <h2 className="text-lg font-semibold">De verkoop</h2>
        <p className="text-text-muted mt-1 max-w-prose text-sm">
          Twee kosten bij verkoop. Het model kent hiervoor geen standaardwaarden — ze verschillen
          per makelaar en per gemeente, dus we vragen ze aan u.
        </p>
      </div>

      <FieldGroup title="Verkoopkosten">
        <NumberField
          label="Verkoopcommissie makelaar"
          unit="%"
          hint="Voorgevuld met 4%, gebruikelijk in Spanje. Weet u het percentage van uw makelaar, pas het dan aan."
          {...field("sellingCommissionPercent")}
        />
        <NumberField
          label="Plusvalía municipal"
          unit="€"
          placeholder="3.500"
          hint="De gemeentelijke belasting op de waardestijging van de grond. Deze verschilt per gemeente en loopt op met de houdperiode; uw gestor of het gemeentehuis kan het bedrag berekenen. We vullen hier bewust niets voor in."
          {...field("municipalCapitalGainsTax")}
        />
      </FieldGroup>

      {engineIssues.length > 0 ? (
        <div
          role="alert"
          className="border-signal-negative/40 bg-signal-negative/5 rounded-md border px-4 py-3"
        >
          <p className="text-sm font-medium">De berekening kon niet worden uitgevoerd</p>
          <ul className="text-text-muted mt-2 list-inside list-disc text-xs">
            {engineIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-border flex items-center justify-between gap-4 border-t pt-6">
        <button
          type="button"
          onClick={() => router.push("/rapport/nieuw/belegger")}
          className="border-accent text-accent rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-subtle"
        >
          Terug
        </button>
        <div className="flex items-center gap-4">
          <p className="text-text-faint text-xs">Stap 4 van 4</p>
          <button
            type="submit"
            disabled={running}
            className="bg-accent text-surface rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {running ? "Bezig met doorrekenen…" : "Rapport doorrekenen"}
          </button>
        </div>
      </div>
    </form>
  );
}
