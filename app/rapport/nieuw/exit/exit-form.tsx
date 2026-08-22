"use client";

/**
 * Step 4 of the paid wizard: the exit, and the calculation.
 *
 * Two fields, both exit assumptions the engine deliberately gives no
 * default (MODEL_SPEC_FASE1B §5). Both are now pre-filled, and both stay
 * editable - whatever is in the field is what the engine receives.
 *
 * - The selling commission is pre-filled at 4%. A Spanish estate agent's
 *   commission has a conventional range, and confirming a figure is
 *   easier than producing one.
 * - The plusvalía municipal (datakwaliteitsfix stap 2) is pre-filled from
 *   the cadastral land value (step 2, when given) and the holding period
 *   (step 3), through the same architecture step 3's own rent fields
 *   use: a Server Action reads parameters.ts server-side
 *   (plusvalia-prefill.ts) and returns only the computed euro figure, an
 *   effect writes it once, and editing it afterwards is never
 *   overwritten. The coefficient table and rate behind this estimate no
 *   longer share one status (Samuel, 22 August 2026). The rate is now an
 *   ESTIMATE, cited to the Ayuntamiento de Valencia's own fiscal
 *   ordinance, Article 16 ("el tipo de gravamen del 29,70 por 100"). The
 *   coefficient table remains PLACEHOLDER-provenance, explicitly NOT
 *   confirmed against Valencia's current fiscal ordinance - see
 *   parameters.ts's own PLUSVALIA_VALENCIA_COEFFICIENTS and
 *   PLUSVALIA_VALENCIA_RATE docstrings for exactly what could and could
 *   not be verified for each. That is why this stays a starting point
 *   rather than a locked figure: the risk of an imprecise coefficient is
 *   contained to what the field opens with, never to what the engine
 *   computes.
 *
 * Submitting no longer runs the engine (fase 4 stap 2). The report is
 * paid for now, so this step opens a payment instead: the input goes to
 * /rapport/betalen/voorbereiden, which validates it without calculating
 * and parks it server-side, and runEngine() runs only after the payment
 * succeeds. The scoring weights still never reach the browser - that
 * part is unchanged, and the engine simply runs one route later.
 *
 * The validation that used to surface here surfaces here still: the
 * prepare route runs the engine's own cross-field rules and answers 400
 * with the same issue list this form already knew how to show. Nobody
 * reaches the payment page with input that cannot produce a report.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { translateFieldValidation } from "@/lib/copy/es/validation";
import { FieldGroup, NumberField } from "../_components/fields";
import { Spinner } from "../_components/spinner";
import { parseNumberInput } from "../_lib/parse-number";
import { useWizard } from "../_state/wizard-state";
import type { ExitStepData } from "../_state/wizard-state";
import { fetchPlusvaliaPrefill } from "./actions";

type FieldErrors = Partial<Record<keyof ExitStepData, string>>;

export function ExitForm() {
  const router = useRouter();
  const { data, setExit, completedSteps, markCompleted } = useWizard();
  const step = data.exit;
  const [errors, setErrors] = useState<FieldErrors>({});
  const [engineIssues, setEngineIssues] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [plusvaliaWasEstimated, setPlusvaliaWasEstimated] = useState(false);

  const coldEntry =
    !completedSteps.has("pand") ||
    !completedSteps.has("staat-en-lasten") ||
    !completedSteps.has("belegger");
  useEffect(() => {
    if (coldEntry) router.replace("/rapport/nieuw/pand");
  }, [coldEntry, router]);

  // Runs once, same guard as step 3's rentPrefilled: re-running on every
  // render would overwrite an edit the customer just made, which is the
  // opposite of "overschrijven mag". No estimate is possible without a
  // cadastral land value (step 2 leaves it optional) - the field then
  // stays exactly as empty as it always has, for manual entry.
  const cadastralSuelo = data.staatEnLasten.cadastralSuelo;
  const holdingYears = data.belegger.holdingYears;
  useEffect(() => {
    if (coldEntry || step.plusvaliaPrefilled) return;

    const suelo = parseNumberInput(cadastralSuelo);
    const years = parseNumberInput(holdingYears);

    let cancelled = false;
    void (async () => {
      const prefill = await fetchPlusvaliaPrefill({
        cadastralSuelo: suelo.state === "ok" ? suelo.value : undefined,
        holdingYears: years.state === "ok" ? years.value : undefined,
      });
      if (cancelled) return;

      setPlusvaliaWasEstimated(prefill.source === "cadastralEstimate");
      setExit({
        municipalCapitalGainsTax:
          prefill.estimatedTax === null ? "" : String(prefill.estimatedTax),
        plusvaliaPrefilled: true,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [coldEntry, step.plusvaliaPrefilled, cadastralSuelo, holdingYears, setExit]);

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
      const response = await fetch("/rapport/betalen/voorbereiden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const body = await response.json();
        setEngineIssues(body.issues ?? ["De aanvraag kon niet worden verwerkt."]);
        return;
      }

      markCompleted("exit");
      router.push("/rapport/betalen");
    } finally {
      setRunning(false);
    }
  }

  const field = (key: "sellingCommissionPercent" | "municipalCapitalGainsTax") => ({
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
          hint={
            plusvaliaWasEstimated
              ? "Voorgevuld als grove schatting op basis van de kadastrale grondwaarde (stap 2) en uw houdperiode (stap 3), met een niet-geverifieerde gemeentelijke coëfficiënt. Controleer dit bedrag bij uw gestor of het gemeentehuis en pas het zo nodig aan."
              : "De gemeentelijke belasting op de waardestijging van de grond. Vul in stap 2 de kadastrale grondwaarde in voor een eerste schatting hier, of laat uw gestor of het gemeentehuis het exacte bedrag berekenen."
          }
          {...field("municipalCapitalGainsTax")}
        />
      </FieldGroup>

      {engineIssues.length > 0 ? (
        <div
          role="alert"
          className="border-signal-negative/40 bg-signal-negative/5 rounded-md border px-4 py-3"
        >
          <p className="text-sm font-medium">Het rapport kan zo niet worden doorgerekend</p>
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
          className="border-accent text-accent focus-visible:ring-accent-ring rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-subtle focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Terug
        </button>
        <div className="flex items-center gap-4">
          <p className="text-text-faint text-xs">Stap 4 van 4</p>
          <button
            type="submit"
            disabled={running}
            className="bg-accent text-surface focus-visible:ring-accent-ring flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
          >
            {running ? <Spinner /> : null}
            {running ? "Betaling wordt voorbereid…" : "Doorgaan naar betaling"}
          </button>
        </div>
      </div>
    </form>
  );
}
