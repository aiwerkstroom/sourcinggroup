import Link from "next/link";
import { Card } from "./_components/card";
import { EXAMPLE_DIMENSIONS, EXAMPLE_PROPERTY, EXAMPLE_TICKS } from "./_components/example-property";
import { ExampleScoreRuler } from "./_components/example-score-ruler";
import { FadeIn } from "./_components/fade-in";

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
 * Step 2 of LANDING_SPEC.md §9 adds the example section (§5): a fictional
 * property, illustrating the ScoreRuler's visual form and a one-line
 * "outcome"-style sentence in §6.1's tone - never a real listing, never a
 * live calculation. Its values live in ./_components/example-property.ts
 * and its ruler in ./_components/example-score-ruler.tsx; both have zero
 * imports, because §5 is explicit that this section may not import or
 * touch TSG_SCORE_DIMENSION_WEIGHTS, real anchor points, or real
 * Parameter objects. app/__tests__/page.test.tsx enforces that emptiness,
 * and this file's own import list, as a structural check. The mandatory
 * "Ter illustratie" label sits directly on the example card, not in small
 * print - §5 calls this out as required, not optional, so a visitor can
 * never mistake the illustration for a real report or for social proof.
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
    title: "2. TSG rekent door",
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
      "Nee. TSG rekent een pand voor u door en toont de uitkomst - het geeft geen persoonlijk beleggingsadvies en bemiddelt niet in de aankoop. De beslissing, en het inwinnen van professioneel advies waar nodig, blijft aan u.",
  },
  {
    question: "Hoe wordt de score berekend, en is dat transparant?",
    answer:
      "De score volgt een vaste methode op basis van cashflow, rendement en risico, met vooraf vastgelegde wegingen. Elke aanname die in de berekening zit, staat met bron en datum in het rapport zelf.",
  },
  {
    question: "Werkt dit alleen voor Spanje?",
    answer:
      "Op dit moment wel. De rekenmethode is gebouwd op de Spaanse fiscale en juridische situatie - belasting, financiering, vergunningen voor verhuur. Andere landen zijn geen onderdeel van deze versie.",
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
        <div className="flex flex-col gap-4">
          <h1 className="max-w-2xl text-2xl leading-snug font-semibold">
            Een pand kopen in Spanje voelt vaak als een gok.
          </h1>
          <p className="text-text-muted max-w-prose text-lg leading-relaxed">
            Andere taal, ander systeem, cijfers die u niet zelf kunt narekenen. The Sourcing
            Group (TSG) rekent het voor u door - met elke aanname zichtbaar en elke uitkomst
            herleidbaar.
          </p>
          <p className="text-text-faint max-w-prose text-sm leading-relaxed">
            Geen advies over wat u moet kopen, geen belofte van het hoogste rendement - een
            rekenmethode die u zelf kunt controleren, op elk pand dat u overweegt. Hieronder ziet
            u hoe dat werkt.
          </p>
        </div>
        <div className="flex flex-wrap gap-6">
          <HeroLink href="/gratis">Gratis indicatie</HeroLink>
          <HeroLink href="/rapport/nieuw/pand">Betaald rapport — € 49</HeroLink>
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
          Zo ziet een uitkomst eruit voor een fictief pand - geen live berekening, puur ter
          illustratie van hoe het rapport rekent en rapporteert.
        </p>

        <Card size="large">
          <div className="flex flex-col gap-6">
            <span className="bg-accent-subtle text-accent inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium">
              Ter illustratie — dit is geen echt pand
            </span>

            <p className="text-text-muted text-sm">{EXAMPLE_PROPERTY.description}</p>

            <div className="flex items-baseline gap-4">
              <span className="tabular text-5xl font-semibold">
                {EXAMPLE_PROPERTY.totalScore.toFixed(1).replace(".", ",")}
              </span>
              <span className="text-text-muted text-sm">
                percentiel {EXAMPLE_PROPERTY.percentile} van ons modelbereik
              </span>
            </div>

            <div className="flex flex-col gap-6">
              {EXAMPLE_DIMENSIONS.map((dimension) => (
                <ExampleScoreRuler
                  key={dimension.label}
                  label={dimension.label}
                  description={dimension.description}
                  score={dimension.score}
                  ticks={EXAMPLE_TICKS}
                />
              ))}
            </div>

            <p className="max-w-prose text-base leading-relaxed">{EXAMPLE_PROPERTY.outcome}</p>
          </div>
        </Card>
      </section>

      <section className="mt-16 flex flex-col gap-6">
        <h2 className="text-xl font-semibold">Veelgestelde vragen</h2>
        <dl className="flex flex-col">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question} className="border-border border-b py-5 first:pt-0 last:border-b-0">
              <dt className="text-base font-medium">{item.question}</dt>
              <dd className="text-text-muted mt-2 max-w-prose text-sm leading-relaxed">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
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
