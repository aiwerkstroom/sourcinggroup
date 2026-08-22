"use client";

/**
 * The free indication's form: the three first-order fields that actually
 * feed a calculation (UI_SPEC.md §3), nothing else. No wizard, no
 * multi-step state - one form, one submit, which builds a query string
 * and navigates to the result page. The URL is the only state this flow
 * ever has (this task's own instruction): there is no server round-trip
 * to hold onto a result, so the result page must be able to rebuild
 * everything from the URL alone.
 *
 * Pandtype and aantal eenheden used to be asked here too, but neither
 * ever entered computeFreeTierBand() - they were shown next to a note
 * saying exactly that. Datakwaliteitsfix stap 6 removed both fields
 * instead of continuing to display that caveat.
 *
 * Validation reuses the calculation layer's own field rules
 * (lib/rules/es/field-validation.ts) and their Dutch translations
 * (lib/copy/es/validation.ts) - one definition of "valid", the same
 * split the paid wizard already uses, not a second schema here.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { translateFieldValidation } from "@/lib/copy/es/validation";
import { checkBuiltAreaM2, checkPurchasePrice } from "@/lib/rules/es/field-validation";
import { Card } from "./_components/card";
import { FieldGroup, NumberField, SelectField } from "./_components/fields";
import { buildFreeIndicationQuery } from "./_lib/query-params";
import { parseNumberInput } from "./_lib/parse-number";

interface FormState {
  neighborhood: string;
  purchasePrice: string;
  builtAreaM2: string;
}

const EMPTY: FormState = {
  neighborhood: "",
  purchasePrice: "",
  builtAreaM2: "",
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

export function IndicatieForm({ neighborhoods }: { neighborhoods: string[] }) {
  const router = useRouter();
  const [data, setData] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});

  const neighborhoodOptions = neighborhoods.map((name) => ({ value: name, label: name }));

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (data.neighborhood === "") next.neighborhood = translateFieldValidation("required");

    const price = parseNumberInput(data.purchasePrice);
    if (price.state === "empty") next.purchasePrice = translateFieldValidation("required");
    else if (price.state === "invalid")
      next.purchasePrice = translateFieldValidation("mustBeANumber");
    else {
      const key = checkPurchasePrice(price.value);
      if (key !== null) next.purchasePrice = translateFieldValidation(key);
    }

    const area = parseNumberInput(data.builtAreaM2);
    if (area.state === "empty") next.builtAreaM2 = translateFieldValidation("required");
    else if (area.state === "invalid")
      next.builtAreaM2 = translateFieldValidation("mustBeANumber");
    else {
      const key = checkBuiltAreaM2(area.value);
      if (key !== null) next.builtAreaM2 = translateFieldValidation(key);
    }

    return next;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const price = parseNumberInput(data.purchasePrice);
    const area = parseNumberInput(data.builtAreaM2);
    if (price.state !== "ok" || area.state !== "ok") return;

    const params = buildFreeIndicationQuery({
      neighborhood: data.neighborhood,
      purchasePrice: price.value,
      builtAreaM2: area.value,
    });
    router.push(`/gratis/resultaat?${params.toString()}`);
  }

  const field = (key: keyof FormState) => ({
    value: data[key],
    onChange: (value: string) => {
      setData((current) => ({ ...current, [key]: value }));
      if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    },
    error: errors[key],
  });

  return (
    <div className="max-w-xl">
      <Card>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-10">
          <FieldGroup title="Het pand">
            <SelectField
              label="Postcode of wijk"
              options={neighborhoodOptions}
              placeholder="Kies een wijk"
              {...field("neighborhood")}
            />
            <NumberField label="Vraagprijs" unit="€" placeholder="350.000" {...field("purchasePrice")} />
            <NumberField
              label="Woonoppervlak (gebouwd)"
              unit="m²"
              placeholder="90"
              {...field("builtAreaM2")}
            />
          </FieldGroup>

          <div className="border-border flex items-center justify-between border-t pt-6">
            <p className="text-text-faint text-xs">Geen account nodig</p>
            <button
              type="submit"
              className="bg-accent text-surface focus-visible:ring-accent-ring rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Bereken indicatie
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
