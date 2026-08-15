import Link from "next/link";
import { computeFreeTierBand } from "@/lib/rules/es/free-tier/band";
import { computeIndicativeScore } from "@/lib/rules/es/free-tier/indicative-score";
import { parseFreeIndicationQuery } from "../_lib/query-params";
import { IndicatieResult } from "./_components/indicatie-result";

/**
 * The free indication's result page. Server Component, deliberately -
 * unlike the paid wizard's result page (client-side, reading state out of
 * a React context because nothing is persisted across its four steps),
 * this flow has exactly one input point and the URL itself is the state
 * (this task's own instruction). That makes a server round-trip possible
 * for every load, which is also what keeps computeFreeTierBand() and
 * computeIndicativeScore() - and everything they import from
 * parameters.ts - out of the browser bundle entirely: this file has no
 * "use client" anywhere in its ancestry, so it and its imports render
 * only on the server.
 *
 * No account, no server state: a reload, a shared link, a bookmark all
 * reach this same page and recompute the same result from the query
 * string alone - nothing to go stale, nothing to expire.
 */
export default async function GratisIndicatieResultaatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const parsed = parseFreeIndicationQuery(resolved);

  if (!parsed.ok) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-6 py-10">
        <p className="text-text-faint text-xs tracking-widest uppercase">Gratis indicatie</p>
        <p className="text-text-muted max-w-prose text-sm leading-relaxed">
          Deze link mist een geldige vraagprijs of oppervlak, of is niet compleet. Vul het
          formulier opnieuw in.
        </p>
        <Link
          href="/gratis"
          className="focus-visible:ring-accent-ring rounded-sm text-sm underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Naar het formulier
        </Link>
      </div>
    );
  }

  const { neighborhood, purchasePrice, builtAreaM2 } = parsed.value;

  let band;
  try {
    band = computeFreeTierBand({ neighborhood, purchasePrice, builtAreaM2 });
  } catch {
    // computeFreeTierBand() is the sole authority on which wijken are
    // covered (band.ts's own docstring) - it throws on an unrecognised
    // one rather than falling back to a city average. A hand-edited URL
    // with an unknown wijk reaches here, not a crash.
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 px-6 py-10">
        <p className="text-text-faint text-xs tracking-widest uppercase">Gratis indicatie</p>
        <p className="text-text-muted max-w-prose text-sm leading-relaxed">
          &quot;{neighborhood}&quot; is niet een van de wijken waarvoor deze indicatie
          referentiedata heeft. Kies een wijk uit de lijst.
        </p>
        <Link
          href="/gratis"
          className="focus-visible:ring-accent-ring rounded-sm text-sm underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Naar het formulier
        </Link>
      </div>
    );
  }

  const score = computeIndicativeScore(band);

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10 md:px-8">
      <IndicatieResult input={parsed.value} band={band} score={score} />
    </div>
  );
}
