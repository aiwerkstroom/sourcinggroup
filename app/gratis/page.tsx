import { NEIGHBORHOOD_RENT_LONG_TERM } from "@/lib/rules/es/parameters";
import { IndicatieForm } from "./indicatie-form";

/**
 * The free indication's input page (UI_SPEC.md §2/§3): the five
 * first-order fields, no account, no server state.
 *
 * Server Component, same reasoning as app/rapport/nieuw/pand/page.tsx:
 * reads the covered wijken from parameters.ts here, on the server, and
 * hands the client form a plain list of names - so parameters.ts (and
 * everything else in that file, including TSG_SCORE_DIMENSION_WEIGHTS)
 * never reaches the browser bundle.
 */
export default function GratisIndicatiePage() {
  const neighborhoods = Object.keys(NEIGHBORHOOD_RENT_LONG_TERM.value);
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10 md:px-8">
      <header className="border-border border-b pb-6">
        <p className="text-text-faint text-xs tracking-widest uppercase">Gratis indicatie</p>
        <h1 className="mt-1 text-xl font-semibold">Een eerste inschatting</h1>
        <p className="text-text-muted mt-2 max-w-prose text-sm leading-relaxed">
          Vijf velden, geen account. U krijgt een bandbreedte en een indicatieve score - geen
          oordeel, en zelf benoemd waar de grenzen van deze inschatting liggen.
        </p>
      </header>

      <div className="mt-8">
        <IndicatieForm neighborhoods={neighborhoods} />
      </div>
    </div>
  );
}
