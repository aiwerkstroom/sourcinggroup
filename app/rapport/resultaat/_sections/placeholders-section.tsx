/**
 * §6.9 of UI_SPEC.md's report structure: "Wat niet geverifieerd is —
 * expliciete lijst. Dit is geen disclaimer maar een inhoudelijk hoofdstuk
 * dat de geloofwaardigheid van de score draagt."
 *
 * Plain function component, same reasoning as the sections before it: it
 * takes the base scenario's own ScenarioOutcome.placeholdersUsed - the
 * PLACEHOLDER parameters this specific combination of scenario, rental
 * strategy and renovation strategy actually rests on (outcome.ts's
 * collectPlaceholders(), MODEL_SPEC.md §14) - and renders one sentence per
 * item via lib/copy/es/placeholder-disclosures.ts. Nothing here re-derives
 * which parameters were used; that stays exactly one place.
 *
 * The customer reads what each figure means (occupancy estimate,
 * renovation cost estimate, ...), never a parameter's internal name -
 * that is the entire point of routing every item through
 * describePlaceholderParameter() rather than printing `param.name`.
 */

import { describePlaceholderParameter } from "@/lib/copy/es/placeholder-disclosures";
import type { Parameter } from "@/lib/rules/es/types";

export interface PlaceholdersSectionProps {
  /** ScenarioOutcome.placeholdersUsed for the base scenario. */
  placeholdersUsed: readonly Parameter<unknown>[];
}

export function PlaceholdersSection({ placeholdersUsed }: PlaceholdersSectionProps) {
  return (
    <section aria-labelledby="sectie-niet-geverifieerd" className="flex flex-col gap-4">
      <h2 id="sectie-niet-geverifieerd" className="text-text-faint text-xs tracking-widest uppercase">
        9. Wat niet geverifieerd is
      </h2>

      <p className="text-text-muted max-w-prose text-sm leading-relaxed">
        Dit rapport rekent op enkele aannames waarvoor geen externe bron of pandspecifiek gegeven
        beschikbaar was. Ze zijn ingevuld met een redelijke schatting, niet met een geverifieerd
        feit - onderstaande lijst is precies waarop de uitkomst voor dít pand rust, niet elke
        aanname die het model ooit zou kunnen gebruiken.
      </p>

      {placeholdersUsed.length === 0 ? (
        <p className="text-text-muted max-w-prose text-sm leading-relaxed">
          Voor het basisscenario van dit pand rust de uitkomst op geen enkele niet-geverifieerde
          aanname.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {placeholdersUsed.map((param) => (
            <li key={param.name} className="flex gap-3">
              <span aria-hidden="true" className="text-text-faint select-none">
                –
              </span>
              <p className="max-w-prose text-sm leading-relaxed">
                {describePlaceholderParameter(param)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
