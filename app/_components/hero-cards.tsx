/**
 * The homepage hero's layered-card visual: two cards that partly overlap,
 * each slightly offset and slightly rotated, showing what the paid report
 * actually looks like - the score with its dimension rulers in front, a
 * fragment of the ten-year series behind it.
 *
 * === What this is not ===
 *
 * Not a new component with new logic. The front card reuses
 * ExampleScoreRuler (the existing homepage-safe ruler from LANDING_SPEC
 * step 2, unchanged) and the back card reuses the report's own table
 * language from DESIGN_SPEC.md §4 - ruled rows, an accent header
 * underline, right-aligned tabular figures. It is a rearrangement of two
 * things that already exist, in the current palette.
 *
 * Not 3D. DESIGN_SPEC.md §9 rules out spectacle, and
 * HOMEPAGE_UPGRADE_SPEC.md's own preamble rejects the 3D-hero direction
 * by name. There is no perspective and no transform beyond a 1-3 degree
 * rotate: these are flat cards, and every bit of depth comes from the
 * two-layer shadow (--shadow-layered in globals.css).
 *
 * === The fictional-data discipline, which applies here too ===
 *
 * Same hard rule as example-calculator-formula.ts and
 * example-score-ruler.tsx (HOMEPAGE_UPGRADE_SPEC.md §4.2): this file
 * imports nothing from lib/rules/es, carries no real anchor point, no
 * real parameter and no real mock listing. Its only import is the
 * example ruler, which itself imports nothing at all.
 *
 * The figures below are invented for the illustration and are labelled as
 * such on the card itself, in the reader's line of sight rather than in a
 * footnote - the same standard §4.3 sets for the interactive example
 * lower down the page. They are deliberately not the reference case's own
 * numbers: someone comparing this picture against a real report should
 * find nothing that matches.
 *
 * The whole stack is aria-hidden. It says nothing the surrounding hero
 * copy does not already say in words, and reading five invented scores
 * aloud to a screen-reader user would present fiction as fact. The
 * interactive example further down is the accessible, labelled version of
 * the same idea.
 */

import { ExampleScoreRuler } from "./example-score-ruler";

/**
 * Fictional, and a plain even five-step scale rather than anything
 * resembling a real anchor table. Exported only so
 * app/__tests__/page.test.tsx can check it against the five real tick
 * sets directly - the same both-sides technique that already keeps
 * EXAMPLE_TICKS honest.
 */
export const HERO_TICKS = [0, 2.5, 5, 7.5, 10] as const;

/**
 * Five invented dimension scores. The labels are the report's real
 * dimension names (they are public - the report shows them to anyone who
 * buys it); the numbers are not, and neither is the weighting that would
 * turn them into a total, which UI_SPEC.md §5 never publishes. Exported
 * for the same test-side reason as HERO_TICKS.
 */
export const HERO_DIMENSIONS: ReadonlyArray<{
  label: string;
  description: string;
  score: number;
}> = [
  { label: "Cashflow", description: "Maandelijks over, na alle lasten", score: 6.2 },
  { label: "DSCR", description: "Dekking van de financieringslast", score: 5.4 },
  { label: "Rendement", description: "Tegenover uw eigen rendementseis", score: 7.1 },
  { label: "Haalbaarheid", description: "Past binnen budget en vergunning", score: 8.3 },
  { label: "Datazekerheid", description: "Hoeveel hiervan is gemeten", score: 4.6 },
];

/** Fictional ten-year fragment. Deliberately only four rows - it is a glimpse, not a table. */
const HERO_YEARS: ReadonlyArray<{ year: string; cashflow: string; balance: string }> = [
  { year: "Jaar 1", cashflow: "€ 1.840", balance: "€ 236.500" },
  { year: "Jaar 2", cashflow: "€ 2.310", balance: "€ 229.900" },
  { year: "Jaar 3", cashflow: "€ 2.780", balance: "€ 223.100" },
  { year: "Jaar 4", cashflow: "€ 3.260", balance: "€ 216.200" },
];

export function HeroCards() {
  return (
    <div aria-hidden="true" className="relative mt-2 hidden min-h-[22rem] select-none md:block">
      {/*
       * Back card: rotated the other way from the front one and pushed up
       * and right, so it reads as a separate sheet rather than a shadow of
       * the first. Partly covered on purpose - a fragment, per the brief.
       */}
      <div className="bg-surface border-border shadow-layered absolute top-0 right-0 w-[19rem] rotate-[2.2deg] rounded-lg border p-5">
        <p className="text-text-faint text-xs font-medium tracking-widest uppercase">
          Tienjarige reeks
        </p>
        <table className="mt-3 w-full border-collapse text-xs">
          <thead>
            <tr className="border-accent text-text border-b-2 text-left">
              <th scope="col" className="py-2 pr-3 font-medium">
                Jaar
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Cashflow
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Restschuld
              </th>
            </tr>
          </thead>
          <tbody>
            {HERO_YEARS.map((row) => (
              <tr key={row.year} className="border-border border-b last:border-b-0">
                <td className="text-text-muted py-2 pr-3">{row.year}</td>
                <td className="py-2 pr-3 text-right">{row.cashflow}</td>
                <td className="text-text-muted py-2 text-right">{row.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
       * Front card: the score, with all five dimension rulers visible.
       * Offset down and left, rotated slightly the other way.
       */}
      <div className="bg-surface border-border shadow-layered relative top-14 w-[21rem] -rotate-[1.4deg] rounded-lg border p-6">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-text-faint text-xs font-medium tracking-widest uppercase">
              Yield &amp; Stone-score
            </p>
            <p className="tabular mt-1 text-4xl font-semibold">6,3</p>
          </div>
          {/*
           * The label, on the card itself and at the reader's eye level -
           * not shrunk into a footnote. Same standard the interactive
           * example below the fold is held to.
           */}
          <p className="text-text-muted max-w-[8rem] text-right text-xs leading-snug">
            Illustratie — fictieve cijfers
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          {HERO_DIMENSIONS.map((dimension) => (
            <ExampleScoreRuler
              key={dimension.label}
              label={dimension.label}
              description={dimension.description}
              score={dimension.score}
              ticks={HERO_TICKS}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
