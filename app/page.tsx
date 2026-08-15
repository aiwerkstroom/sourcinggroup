import Link from "next/link";

/**
 * Landing page. UI_SPEC.md §2's twee niveaus krijgen hier hun eigen ingang:
 * de gratis indicatie en het betaalde rapport.
 *
 * Zelfde buitencontainer als elke andere pagina in de site (max-w-5xl,
 * px-4/md:px-8, py-10) - geen aparte, verticaal gecentreerde opmaak meer.
 * Geen kaart om de tekst en knoppen: dit is de paginakop zelf, niet een
 * sectie van een rapport, dezelfde reden waarom de andere pagina's hun
 * eigen header ook buiten een kaart laten staan.
 */
export default function HomePage() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10 md:px-8">
      <h1 className="text-2xl font-semibold">The Sourcing Group</h1>
      <p className="text-text-muted mt-3 max-w-prose">
        Onderbouwd rendementsrapport voor Spaans vastgoed. Elke uitkomst herleidbaar, elke aanname
        zichtbaar.
      </p>
      <div className="mt-6 flex gap-4">
        <Link
          href="/gratis"
          className="border-accent text-accent focus-visible:ring-accent-ring rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-subtle focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Gratis indicatie
        </Link>
        <Link
          href="/rapport/nieuw/pand"
          className="bg-accent text-surface focus-visible:ring-accent-ring rounded-md px-4 py-2 text-sm font-medium transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Betaald rapport — € 49
        </Link>
      </div>
    </div>
  );
}
