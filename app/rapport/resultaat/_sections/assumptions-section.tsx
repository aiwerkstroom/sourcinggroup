/**
 * §6.8 of UI_SPEC.md's report structure: "Aannames en bronnen — elke
 * parameter met herkomst (SOURCED/ESTIMATE/PLACEHOLDER) en datum."
 *
 * Plain function component, same reasoning as the sections before it: it
 * takes the base scenario's own ScenarioOutcome.assumptionsUsed (every
 * named parameter this outcome's numbers actually rest on, all three
 * provenance levels - lib/rules/es/assumptions.ts's
 * collectUsedParameters()) and renders it via
 * lib/copy/es/assumption-disclosures.ts, grouped by category. Nothing
 * here re-derives which parameters were used or what they are worth.
 *
 * Provenance is shown as text weight, not colour - unlike section 7,
 * which is the one section UI_SPEC.md §1 reserves colour for (a real
 * pass/fail threshold). A parameter's certainty is not a threshold, so
 * SOURCED/ESTIMATE/PLACEHOLDER read as progressively fainter text instead.
 *
 * Residency and EU-residency are a fixed product decision
 * (build-engine-input.ts's FIXED_RESIDENCY/FIXED_EU_RESIDENT), not a
 * parameter with its own provenance record - so they get their own
 * paragraph here rather than a manufactured row in the categorised list.
 *
 * EngineResult.listingFieldProvenance's neighborhood/builtAreaM2/
 * usableAreaM2 (SOURCING_SPEC.md §4/§7 step 4) get one quiet line here,
 * not a manufactured row either - unlike purchasePrice, which gets §6.1's
 * boxed treatment, these three don't drive the headline figures, so the
 * approved design keeps them calm: no box, no colour, the same register
 * as this section's own faint per-parameter notes.
 *
 * EngineResult.renovationTierProvenance (fase C stap 1) gets a line in
 * that same quiet register, and for the same reason: it says where a
 * choice came from, not what it was worth. It sits above the listing line
 * rather than below because it is present on every wizard-built report,
 * where the listing line only appears for a report entered via a chosen
 * listing - the unconditional note reads first.
 */

import type { AssumptionCategory } from "@/lib/copy/es/assumption-disclosures";
import { ASSUMPTION_CATEGORY_ORDER, describeAssumption } from "@/lib/copy/es/assumption-disclosures";
import {
  translateAllInRateNote,
  translateFinancingTermsProvenanceNote,
} from "@/lib/copy/es/financing-terms-provenance-disclosures";
import { translateListingFieldsFromListingNote } from "@/lib/copy/es/listing-field-provenance-disclosures";
import {
  translateRenovationDurationProvenanceNote,
  translateRenovationTierProvenanceNote,
  translateRenovationVacancyOverflowNote,
} from "@/lib/copy/es/renovation-tier-provenance-disclosures";
import type {
  FinancingTermsProvenance,
  ListingFieldProvenanceReport,
  Parameter,
  ParameterProvenance,
  RenovationDurationProvenance,
  RenovationStrategyId,
  RenovationTierProvenance,
} from "@/lib/rules/es/types";

export interface AssumptionsSectionProps {
  /** ScenarioOutcome.assumptionsUsed for the base scenario. */
  assumptionsUsed: readonly Parameter<unknown>[];
  listingFieldProvenance: ListingFieldProvenanceReport;
  /** Fase C stap 1. Null when no "staat van onderhoud" drove the tier - see EngineResult. */
  renovationTierProvenance: RenovationTierProvenance | null;
  /** The tier actually used, needed to contrast against the derived one. */
  renovationStrategy: RenovationStrategyId;
  /** Fase C stap 2. Null when nobody was asked for a duration - see EngineResult. */
  renovationDurationProvenance: RenovationDurationProvenance | null;
  /** The renovation's two vacancy periods actually used, in months. */
  renovationDurationMonths: number;
  renovationLeaseUpMonths: number;
  /** Fase C stap 3. Null when nobody was asked for financing terms - see EngineResult. */
  financingTermsProvenance: FinancingTermsProvenance | null;
  /** The terms actually used. The rate is all-in (base + any non-resident spread), matching what step 3 showed. */
  financingTermsInForce: { allInRate: number; loanTermYears: number };
}

const PROVENANCE_LABEL_NL: Readonly<Record<ParameterProvenance, string>> = {
  SOURCED: "Bron",
  ESTIMATE: "Modelkeuze",
  PLACEHOLDER: "Schatting",
};

const PROVENANCE_CLASS: Readonly<Record<ParameterProvenance, string>> = {
  SOURCED: "text-text",
  ESTIMATE: "text-text-muted",
  PLACEHOLDER: "text-text-faint italic",
};

function ProvenanceBadge({ provenance }: { provenance: ParameterProvenance }) {
  return (
    <span
      className={`${PROVENANCE_CLASS[provenance]} border-border rounded-full border px-2 py-0.5 text-xs whitespace-nowrap`}
    >
      {PROVENANCE_LABEL_NL[provenance]}
    </span>
  );
}

function CategoryGroup({
  category,
  params,
}: {
  category: AssumptionCategory;
  params: readonly Parameter<unknown>[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-text-muted text-xs font-medium tracking-wide uppercase">{category}</h3>
      <ul className="flex flex-col gap-2.5">
        {params.map((param) => {
          const { label, note } = describeAssumption(param);
          return (
            <li key={param.name} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm">{label}</span>
                <ProvenanceBadge provenance={param.provenance} />
              </div>
              <span className="text-text-faint text-xs">{note}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AssumptionsSection({
  assumptionsUsed,
  listingFieldProvenance,
  renovationTierProvenance,
  renovationStrategy,
  renovationDurationProvenance,
  renovationDurationMonths,
  renovationLeaseUpMonths,
  financingTermsProvenance,
  financingTermsInForce,
}: AssumptionsSectionProps) {
  const byCategory = new Map<AssumptionCategory, Parameter<unknown>[]>();
  for (const param of assumptionsUsed) {
    const { category } = describeAssumption(param);
    const group = byCategory.get(category) ?? [];
    group.push(param);
    byCategory.set(category, group);
  }

  const listingFieldsNote = translateListingFieldsFromListingNote(listingFieldProvenance);
  const renovationTierNote = translateRenovationTierProvenanceNote(
    renovationTierProvenance,
    renovationStrategy,
  );
  const renovationDurationNote = translateRenovationDurationProvenanceNote(
    renovationDurationProvenance,
    renovationDurationMonths,
  );
  const financingTermsNote = translateFinancingTermsProvenanceNote(
    financingTermsProvenance,
    financingTermsInForce,
  );
  const allInRateNote = translateAllInRateNote(financingTermsProvenance);
  const vacancyOverflowNote = translateRenovationVacancyOverflowNote(
    renovationDurationMonths,
    renovationLeaseUpMonths,
  );

  return (
    <section aria-labelledby="sectie-aannames" className="flex flex-col gap-6">
      <h2 id="sectie-aannames" className="text-text-faint text-xs tracking-widest uppercase">
        8. Aannames en bronnen
      </h2>

      <p className="border-border text-text-muted max-w-prose rounded-md border border-dashed px-4 py-3 text-sm leading-relaxed">
        Twee aannames liggen vast voor elke klant van dit rapport en zijn niet per pand uitgevraagd:
        u wordt behandeld als fiscaal niet-ingezetene in Spanje (non-resident) en als EU-ingezetene
        voor de belasting op huurinkomsten. Dat is een productkeuze voor de doelgroep van dit
        rapport - de Nederlandse particuliere belegger - niet een aanname over uw specifieke
        situatie.
      </p>

      <div className="flex flex-col gap-8">
        {ASSUMPTION_CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => (
          <CategoryGroup key={category} category={category} params={byCategory.get(category)!} />
        ))}
      </div>

      {renovationTierNote !== null ? (
        <p className="text-text-faint max-w-prose text-xs leading-relaxed">{renovationTierNote}</p>
      ) : null}

      {renovationDurationNote !== null ? (
        <p className="text-text-faint max-w-prose text-xs leading-relaxed">
          {renovationDurationNote}
        </p>
      ) : null}

      {financingTermsNote !== null ? (
        <p className="text-text-faint max-w-prose text-xs leading-relaxed">{financingTermsNote}</p>
      ) : null}

      {allInRateNote !== null ? (
        <p className="text-text-faint max-w-prose text-xs leading-relaxed">{allInRateNote}</p>
      ) : null}

      {vacancyOverflowNote !== null ? (
        <p className="border-border text-text-muted max-w-prose rounded-md border border-dashed px-4 py-3 text-sm leading-relaxed">
          {vacancyOverflowNote}
        </p>
      ) : null}

      {listingFieldsNote !== null ? (
        <p className="text-text-faint text-xs leading-relaxed">{listingFieldsNote}</p>
      ) : null}
    </section>
  );
}
