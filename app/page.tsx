import Link from "next/link";
import { Card } from "./_components/card";
import { ExampleCalculator } from "./_components/example-calculator";
import { FadeIn } from "./_components/fade-in";
import { FaqAccordion } from "./_components/faq-accordion";
import { HeroCards } from "./_components/hero-cards";

/**
 * The wervende landing page (LANDING_SPEC.md), replacing the previous
 * purely functional homepage.
 *
 * Still a Server Component. HOMEPAGE_UPGRADE_SPEC.md §7 step 1 adds
 * motion to sections 1, 2 and 5, but only through FadeIn - a thin client
 * wrapper that takes its children as a prop, so everything inside stays
 * server-rendered and shipped as HTML. The page itself gained no "use
 * client" and no interactivity of its own.
 *
 * The example section is now the interactive calculator
 * (HOMEPAGE_UPGRADE_SPEC.md §4, §7 step 3-4), which replaced the static
 * fictional property LANDING_SPEC.md §5 introduced. Its arithmetic lives
 * in ./_components/example-calculator-formula.ts and its ruler in
 * ./_components/example-score-ruler.tsx; both import nothing at all,
 * because §4.2 forbids this section from touching runEngine(),
 * TSG_SCORE_DIMENSION_WEIGHTS or any real anchor point.
 * app/__tests__/page.test.tsx enforces that emptiness, this file's own
 * import list, and that the fictional curve collides with no real one.
 *
 * The fictional-example label is stronger than it was, because the
 * section is now interactive: someone typing their own figures into a
 * moving score needs to be told not just that the property is invented
 * but that the calculation is. It sits as a fixed header on the tool,
 * per §4.3.
 *
 * Zelfde buitencontainer als elke andere pagina in de site (max-w-5xl,
 * px-4/md:px-8, py-10). The hero stays outside a card, same reasoning as
 * every other page's own header; the explainer's three steps, the example
 * and the closing CTA reuse the existing Card component (DESIGN_SPEC.md
 * §3) - no new visual language, per LANDING_SPEC.md's own instruction.
 *
 * §2's "autoriteit zonder overdrijven": no testimonials, no invented
 * numbers, no claim of a track record this product does not yet have.
 * The page's case for trust is the method itself - visible assumptions,
 * traceable outcomes - which is what §2's/§4's copy leans on instead. The
 * fictional example does not undermine that: it is clearly labelled as
 * fiction, not offered as evidence of a real outcome.
 */

const HOW_IT_WORKS_STEPS = [
  {
    title: "1. Pand en cijfers",
    body: "U vult de kenmerken van een pand in: prijs, oppervlak, kosten, en - als u die al kent - de verwachte huur.",
  },
  {
    title: "2. Yield & Stone rekent door",
    body: "Cashflow, DSCR en rendement over tien jaar, in drie scenario's - conservatief, basis en optimistisch. Dezelfde methode voor ieder pand.",
  },
  {
    title: "3. U ziet de aannames",
    body: "Elke waarde in de berekening staat met bron en datum in het rapport. Wat een schatting is, heet ook zo.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Wat kost het, en hoe werkt het betalen?",
    answer:
      "De gratis indicatie kost niets en vraagt geen account. Het volledige rendementsrapport is eenmalig € 49 per pand, af te rekenen zodra u de invoer heeft afgerond.",
  },
  {
    question: "Is dit beleggingsadvies?",
    answer:
      "Nee. Yield & Stone rekent een pand voor u door en toont de uitkomst - het geeft geen persoonlijk beleggingsadvies en bemiddelt niet in de aankoop. De beslissing, en het inwinnen van professioneel advies waar nodig, blijft aan u.",
  },
  {
    question: "Hoe wordt de score berekend, en is dat transparant?",
    answer:
      "De score volgt een vaste methode op basis van cashflow, rendement en risico, met vooraf vastgelegde wegingen. Elke aanname die in de berekening zit, staat met bron en datum in het rapport zelf.",
  },
  {
    question: "Werkt dit alleen voor Spanje?",
    answer:
      "Yield & Stone is gebouwd om internationaal te werken, en Spanje - met de regio Valencia als eerste - is de markt waar de rekenmethode nu live staat. Elk land heeft zijn eigen fiscale en juridische regels, die eerst grondig worden uitgezocht voordat een volgende regio wordt toegevoegd.",
  },
  {
    question: "Wat gebeurt er met mijn gegevens?",
    answer:
      "Uw invoer wordt gebruikt om het rapport te berekenen en, met een account, bewaard zodat u het later kunt terugvinden. We geven uw gegevens niet door aan derden voor marketingdoeleinden.",
  },
];

function HeroLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-accent focus-visible:ring-accent-ring rounded-sm text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10 md:px-8">
      {/* Hero: fades on load, not on scroll - it is already on screen, so
          there is nothing to scroll into (HOMEPAGE_UPGRADE_SPEC.md §2). */}
      <FadeIn trigger="load" className="flex flex-col gap-6">
        {/*
         * Two columns from md up: the copy carries the argument, the card
         * stack shows what the argument produces. One column below that,
         * where HeroCards hides itself entirely - a rotated, overlapping
         * stack has no room to be legible on a phone, and the interactive
         * example further down does the same job better there.
         */}
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:gap-10">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4">
                {/*
                 * The one place the brand's gold appears. Purely
                 * decorative - a short rule, carrying no information and
                 * labelling nothing, which is the only role it can
                 * safely take: #C49A4A reaches 2,4:1 on the page ground,
                 * below both the 4,5:1 text bar and the 3:1 bar for
                 * meaningful graphics (DESIGN_SPEC.md §6, and the
                 * measurements in globals.css's own header). aria-hidden
                 * so it is not announced as content.
                 */}
                <span aria-hidden="true" className="bg-highlight h-0.5 w-10 rounded-full" />
                <h1 className="max-w-2xl text-2xl leading-snug font-semibold">
                  Een pand kopen in Spanje voelt vaak als een gok.
                </h1>
              </div>
              <p className="text-text-muted max-w-prose text-lg leading-relaxed">
                Andere taal, ander systeem, cijfers die u niet zelf kunt narekenen. Yield &amp;
                Stone rekent het voor u door - met elke aanname zichtbaar en elke uitkomst
                herleidbaar.
              </p>
              <p className="text-text-faint max-w-prose text-sm leading-relaxed">
                Geen advies over wat u moet kopen, geen belofte van het hoogste rendement - een
                rekenmethode die u zelf kunt controleren, op elk pand dat u overweegt. Hieronder
                ziet u hoe dat werkt.
              </p>
            </div>
            <div className="flex flex-wrap gap-6">
              <HeroLink href="/gratis">Gratis indicatie</HeroLink>
              <HeroLink href="/rapport/nieuw/pand">Betaald rapport — € 49</HeroLink>
            </div>
          </div>

          {/*
           * data-section marks the two places on this page that draw
           * fictional score rulers. app/__tests__/page.test.tsx slices on
           * these to check each one separately - that its own
           * fiction-label comes before its own rulers, and that the
           * interactive tool still draws exactly five. Without the
           * markers those two checks would silently merge into one
           * page-wide count and stop meaning anything.
           */}
          <div data-section="hero-visual">
            <HeroCards />
          </div>
        </div>
      </FadeIn>

      <section className="mt-16 flex flex-col gap-6">
        <FadeIn className="flex flex-col gap-6">
          <h2 className="text-xl font-semibold">Hoe het werkt</h2>
          <p className="text-text-muted max-w-prose leading-relaxed">
            Drie stappen, dezelfde methode voor elk pand dat u invoert.
          </p>
        </FadeIn>
        {/* Each card is its own FadeIn so the stagger is per card, 90ms
            apart (HOMEPAGE_UPGRADE_SPEC.md §3's 80-100ms). The wrapper
            carries the grid cell, which is why FadeIn takes a className -
            an extra plain div here would break the three-column grid. */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <FadeIn key={step.title} delayMs={index * 90} className="h-full">
              <Card hoverAccent fill>
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="text-text-muted mt-2 text-sm leading-relaxed">{step.body}</p>
              </Card>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="mt-16 flex flex-col gap-6">
        <h2 className="text-xl font-semibold">Een voorbeeld</h2>
        <p className="text-text-muted max-w-prose leading-relaxed">
          Pas de cijfers hieronder aan en zie hoe de uitkomst meebeweegt - een fictief pand, om te
          laten zien hoe het rapport rekent en rapporteert.
        </p>

        <div data-section="example">
          <Card size="large">
            <ExampleCalculator />
          </Card>
        </div>
      </section>

      <section className="mt-16 flex flex-col gap-6">
        <h2 className="text-xl font-semibold">Veelgestelde vragen</h2>
        <FaqAccordion items={FAQ_ITEMS} />
      </section>

      <FadeIn className="mt-16 block">
        <Card size="large">
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Begin met een gratis indicatie</h2>
            <p className="text-text-muted max-w-prose leading-relaxed">
              Vijf velden, geen account nodig. U krijgt een eerste inschatting en ziet meteen hoe
              de rekenmethode werkt - het volledige rapport is een aparte, bewuste vervolgstap.
            </p>
            <div>
              <Link
                href="/gratis"
                className="bg-accent text-surface focus-visible:ring-accent-ring inline-flex rounded-md px-6 py-2.5 text-sm font-medium transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Gratis indicatie starten
              </Link>
            </div>
          </div>
        </Card>
      </FadeIn>
    </div>
  );
}
