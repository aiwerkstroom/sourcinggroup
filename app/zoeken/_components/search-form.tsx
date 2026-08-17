"use client";

/**
 * The search criteria form (SOURCING_SPEC.md §2, §7 step 3). Four
 * filters, all optional and independent: a customer may search on only
 * a wijk, or only a yield threshold.
 *
 * No client-side validation beyond "is this a number" - unlike the
 * wizard's own fields, nothing here blocks the report from being
 * computed later, so there is no cross-field rule to enforce. An
 * unparseable price or yield simply does not become part of the URL
 * (query-params.ts's own tolerant parsing already treats an absent key
 * as "no filter"), so the worst a bad value can do is get ignored.
 *
 * Receives `neighborhoods` as a plain string[] prop rather than
 * importing VALENCIA_NEIGHBORHOODS itself - the same reason
 * PandForm receives `neighborhoods` from pand/page.tsx instead of
 * importing NEIGHBORHOOD_RENT_LONG_TERM directly: that import chain
 * reaches lib/rules/es/parameters.ts, and nothing this file imports may
 * pull that file's contents (source-mock.ts's registry, scoring
 * parameters, any of it) into the client bundle. This route's own bundle
 * sweep verifies exactly that (page.tsx's docstring).
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SOURCE_PROPERTY_TYPES } from "@/lib/sourcing/source/types";
import { PROPERTY_TYPE_LABEL_NL } from "../_lib/format";
import { buildSearchQuery } from "../_lib/query-params";
import type { SearchFormValues } from "../_lib/query-params";
import { Card } from "./card";
import { FieldGroup, NumberField, SelectField } from "./fields";

const PROPERTY_TYPE_OPTIONS = SOURCE_PROPERTY_TYPES.map((value) => ({
  value,
  label: PROPERTY_TYPE_LABEL_NL[value] ?? value,
}));

export function SearchForm({
  neighborhoods,
  initialValues,
}: {
  neighborhoods: string[];
  initialValues: SearchFormValues;
}) {
  const router = useRouter();
  const [data, setData] = useState<SearchFormValues>(initialValues);

  const neighborhoodOptions = neighborhoods.map((name) => ({ value: name, label: name }));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const params = buildSearchQuery(data);
    router.push(`/zoeken?${params.toString()}`);
  }

  const field = (key: keyof SearchFormValues) => ({
    value: data[key],
    onChange: (value: string) => setData((current) => ({ ...current, [key]: value })),
  });

  return (
    <Card>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
        <FieldGroup title="Locatie">
          <SelectField
            label="Wijk"
            options={neighborhoodOptions}
            placeholder="Alle wijken"
            optional
            {...field("neighborhood")}
          />
        </FieldGroup>

        <FieldGroup title="Prijs">
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Minimaal" unit="€" placeholder="0" optional {...field("minPriceEUR")} />
            <NumberField label="Maximaal" unit="€" placeholder="500.000" optional {...field("maxPriceEUR")} />
          </div>
        </FieldGroup>

        <FieldGroup title="Pandtype">
          <SelectField
            label="Type"
            options={PROPERTY_TYPE_OPTIONS}
            placeholder="Alle types"
            optional
            {...field("propertyType")}
          />
        </FieldGroup>

        <FieldGroup title="Rendement">
          <NumberField
            label="Minimale bruto yield (zeef)"
            unit="%"
            placeholder="5"
            optional
            hint="Toont alleen panden waarvan de indicatieve bruto yield deze grens haalt. Geen rangschikking - een grens die u zelf stelt."
            {...field("minYieldPercent")}
          />
        </FieldGroup>

        <div className="border-border flex items-center justify-end border-t pt-6">
          <button
            type="submit"
            className="bg-accent text-surface focus-visible:ring-accent-ring rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Zoeken
          </button>
        </div>
      </form>
    </Card>
  );
}
