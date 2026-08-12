import Link from "next/link";

/**
 * Placeholder landing page. UI_SPEC.md §2's twee niveaus krijgen hier hun
 * eigen ingang; de daadwerkelijke landingspagina-opmaak is geen onderdeel
 * van deze stap (de wizard voor het betaalde pad).
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">The Sourcing Group</h1>
      <p className="text-text-muted max-w-prose">
        Onderbouwd rendementsrapport voor Spaans vastgoed. Elke uitkomst herleidbaar, elke aanname
        zichtbaar.
      </p>
      <div className="flex gap-4">
        <Link
          href="/gratis"
          className="border-border-strong rounded-md border px-4 py-2 text-sm hover:bg-white/5"
        >
          Gratis indicatie
        </Link>
        <Link
          href="/rapport/nieuw/pand"
          className="bg-surface-raised border-border-strong rounded-md border px-4 py-2 text-sm hover:bg-white/5"
        >
          Betaald rapport — € 49
        </Link>
      </div>
    </main>
  );
}
