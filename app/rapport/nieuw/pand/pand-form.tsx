"use client";

/**
 * Step 1 of the paid wizard: the property itself (UI_SPEC.md §3).
 *
 * Validation calls the calculation layer's own field rules
 * (lib/rules/es/field-validation.ts) and renders their keys through
 * lib/copy/es/validation.ts - one definition of "valid", per interview
 * round 3, rather than a second schema here that could drift from what
 * validateEngineInput() will demand at step 4.
 *
 * The neighbourhood asked for here is what step 3's rent field pre-fills
 * from, and what EngineResult.rentInputProvenance later compares an
 * overridden rate against. "Anders" is a legitimate answer, not an error:
 * the paid path takes any address, and a property outside the covered
 * wijken simply has no reference to deviate from ("noReference").
 *
 * `prefillListing` (SOURCING_SPEC.md §4/§7 step 4) prefills four fields
 * from a chosen listing - neighborhood, purchasePrice, builtAreaM2, and
 * usableAreaM2 only when the listing itself supplied one - and records
 * the listing's own values via setListingOrigin() so
 * buildEngineInput()'s comparison (stap 1 of this feature) has something
 * to compare against. Address is never prefilled: a Listing carries no
 * street address, only a wijk and a title, and writing the title into
 * the address field would present a marketing label as a postal address.
 * The listing's own propertyType is not prefilled into anything - the
 * wizard no longer asks for it (datakwaliteitsfix stap 6).
 *
 * The prefill applies once per wizard session, not once per mount: the
 * guard is `data.listingOrigin === null`, not a mount ref, so a second
 * visit to this page with a different `?listing=` (browser back, or
 * choosing another listing mid-wizard) never overwrites a choice already
 * on record - including one the customer has since edited away from.
 * Setting listingOrigin flips the guard itself on the very next render,
 * which is what makes the effect self-terminating without an extra ref.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { translateFieldValidation } from "@/lib/copy/es/validation";
import {
  checkBuiltAreaM2,
  checkPurchasePrice,
  checkUsableAreaM2,
} from "@/lib/rules/es/field-validation";
import type { FieldValidationKey } from "@/lib/rules/es/field-validation";
import type { Listing } from "@/lib/sourcing/source/types";
import { FieldGroup, NumberField, SelectField, TextField } from "../_components/fields";
import { parseNumberInput } from "../_lib/parse-number";
import { OTHER_NEIGHBORHOOD, useWizard } from "../_state/wizard-state";
import type { PandStepData } from "../_state/wizard-state";

const ENERGY_LABELS = ["A", "B", "C", "D", "E", "F", "G"].map((letter) => ({
  value: letter,
  label: letter,
}));

type FieldErrors = Partial<Record<keyof PandStepData, string>>;

/**
 * Parses a required numeric field and runs the calculation layer's rule
 * over the result. Empty and unparseable are separated deliberately: an
 * untouched field should say it is required, not that it is not a number.
 */
function validateRequiredNumber(
  raw: string,
  rule: (value: number) => FieldValidationKey | null,
): string | undefined {
  const parsed = parseNumberInput(raw);
  if (parsed.state === "empty") return translateFieldValidation("required");
  if (parsed.state === "invalid") return translateFieldValidation("mustBeANumber");
  const key = rule(parsed.value);
  return key === null ? undefined : translateFieldValidation(key);
}

export function PandForm({
  neighborhoods,
  prefillListing,
}: {
  neighborhoods: string[];
  prefillListing: Listing | null;
}) {
  const router = useRouter();
  const { data, setPand, setListingOrigin, markCompleted } = useWizard();
  const pand = data.pand;
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (prefillListing === null || data.listingOrigin !== null) return;

    setPand({
      neighborhood: prefillListing.neighborhood,
      purchasePrice: String(prefillListing.priceEUR),
      builtAreaM2: String(prefillListing.builtAreaM2),
      usableAreaM2:
        prefillListing.usableAreaM2 !== undefined ? String(prefillListing.usableAreaM2) : "",
    });
    setListingOrigin({
      neighborhood: prefillListing.neighborhood,
      purchasePriceEUR: prefillListing.priceEUR,
      builtAreaM2: prefillListing.builtAreaM2,
      usableAreaM2: prefillListing.usableAreaM2,
    });
  }, [prefillListing, data.listingOrigin, setPand, setListingOrigin]);

  const neighborhoodOptions = [
    ...neighborhoods.map((name) => ({ value: name, label: name })),
    { value: OTHER_NEIGHBORHOOD, label: "Anders / niet in deze lijst" },
  ];

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (pand.address.trim() === "") next.address = translateFieldValidation("required");
    if (pand.neighborhood === "") next.neighborhood = translateFieldValidation("required");

    next.purchasePrice = validateRequiredNumber(pand.purchasePrice, checkPurchasePrice);
    next.builtAreaM2 = validateRequiredNumber(pand.builtAreaM2, checkBuiltAreaM2);

    // Optional (MODEL_SPEC.md §17): left empty, the engine derives it from
    // the built area via a PLACEHOLDER ratio and the report says so.
    if (pand.usableAreaM2.trim() !== "") {
      const usable = parseNumberInput(pand.usableAreaM2);
      const built = parseNumberInput(pand.builtAreaM2);
      if (usable.state === "invalid") {
        next.usableAreaM2 = translateFieldValidation("mustBeANumber");
      } else if (usable.state === "ok") {
        const key = checkUsableAreaM2(
          usable.value,
          built.state === "ok" ? built.value : undefined,
        );
        if (key !== null) next.usableAreaM2 = translateFieldValidation(key);
      }
    }

    for (const key of Object.keys(next) as (keyof PandStepData)[]) {
      if (next[key] === undefined) delete next[key];
    }
    return next;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    markCompleted("pand");
    router.push("/rapport/nieuw/staat-en-lasten");
  }

  const field = (key: keyof PandStepData) => ({
    value: pand[key],
    onChange: (value: string) => {
      setPand({ [key]: value });
      // Clear this field's error as soon as it is edited: keeping a stale
      // complaint next to a field the customer is actively fixing reads as
      // the form arguing with them.
      if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    },
    error: errors[key],
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-10">
      <div>
        <h2 className="text-lg font-semibold">Het pand</h2>
        <p className="text-text-muted mt-1 max-w-prose text-sm">
          Waar het pand staat, wat het kost en hoe groot het is.
        </p>
      </div>

      <FieldGroup title="Locatie">
        <TextField
          label="Volledig adres"
          placeholder="Calle Ejemplo 12, 3º B, Valencia"
          {...field("address")}
        />
        <SelectField
          label="Wijk"
          options={neighborhoodOptions}
          placeholder="Kies een wijk"
          hint="De wijk bepaalt de huurreferentie waarmee we rekenen. Staat uw wijk er niet bij, kies dan 'Anders' — u vult de huurwaarde dan later zelf in."
          {...field("neighborhood")}
        />
      </FieldGroup>

      <FieldGroup title="Prijs">
        <NumberField label="Vraagprijs" unit="€" placeholder="350.000" {...field("purchasePrice")} />
      </FieldGroup>

      <FieldGroup title="Oppervlak">
        <NumberField
          label="Gebouwd oppervlak"
          unit="m²"
          placeholder="90"
          {...field("builtAreaM2")}
        />
        <NumberField
          label="Bruikbaar oppervlak"
          unit="m²"
          placeholder="76,5"
          optional
          hint="Spaanse advertenties vermelden doorgaans m² construidos. Uw huurschatting wordt nauwkeuriger als u ook het bruikbaar oppervlak invult."
          {...field("usableAreaM2")}
        />
      </FieldGroup>

      <FieldGroup title="Indeling en staat">
        <div className="grid grid-cols-3 gap-4">
          <NumberField label="Kamers" optional {...field("rooms")} />
          <NumberField label="Slaapkamers" optional {...field("bedrooms")} />
          <NumberField label="Badkamers" optional {...field("bathrooms")} />
        </div>
        <NumberField
          label="Bouwjaar"
          placeholder="1972"
          optional
          {...field("constructionYear")}
        />
        <SelectField
          label="Energielabel"
          options={ENERGY_LABELS}
          placeholder="Kies een label"
          optional
          {...field("energyLabel")}
        />
      </FieldGroup>

      <div className="border-border flex items-center justify-between border-t pt-6">
        <p className="text-text-faint text-xs">Stap 1 van 4</p>
        <button
          type="submit"
          className="bg-accent text-surface focus-visible:ring-accent-ring rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Volgende: staat en lasten
        </button>
      </div>
    </form>
  );
}
