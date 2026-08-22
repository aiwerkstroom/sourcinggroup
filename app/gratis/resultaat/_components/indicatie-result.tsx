/**
 * The free indication's result (UI_SPEC.md §2/§3, SCORE_SPEC.md §8).
 *
 * Plain function component, same reasoning as the paid report's sections:
 * it takes the calculation layer's own FreeTierBand/IndicativeScore and
 * renders them, nothing more - so it renders identically from the result
 * page's Server Component and from a golden-render test via
 * react-dom/server.
 *
 * Visual weight follows this task's own instruction: the indicative
 * labels come first and large, the cashflow figure with its own
 * disclosure directly under it, then the remaining disclosures read in
 * full - none of the FreeTierDisclosureKey entries sits behind a fold or
 * an accordion. The underlying 0-10 scores are never rendered, because
 * IndicativeScore never carries them (SCORE_SPEC.md §8.2's own point -
 * see that type's docstring).
 *
 * Fase A stap 2: the cashflow card renders a range or a point depending
 * on band.pointEstimate, never both - "band" and
 * "pointEstimateFromCustomerInput" are mutually exclusive in
 * band.disclosures for exactly this reason (band.ts's own comment on
 * this), so picking the matching heading/figure/disclosure by that same
 * flag keeps the layout and the text describing it from ever disagreeing.
 *
 * No colour on the labels: UI_SPEC.md §1 reserves colour for a pass/fail
 * threshold, and Laag/Gemiddeld/Hoog is a coarse grade, not a threshold -
 * the same restraint the paid report's TSG-score dimension bars already
 * apply.
 *
 * Card styling (DESIGN_SPEC.md §3): each of the four content sections is
 * its own card, no dividers between them - the same treatment
 * paid-report.tsx gives its nine sections. The indicative-score card is
 * `size="large"`, the one card enlarged to match how this flow's own task
 * instructions named it: "visueel zwaartepunt". Header and footer (the
 * context line and the share/CTA row) stay outside any card, exactly as
 * they do in the paid report.
 */

import { translateFreeTierDisclosure, translateIndicativeLabel } from "@/lib/copy/es/free-tier-disclosures";
import type { FreeTierBand, IndicativeScore } from "@/lib/rules/es/types";
import { Card } from "../../_components/card";
import type { FreeIndicationQuery } from "../../_lib/query-params";
import { formatEuro } from "../_lib/format";
import { ShareButton } from "./share-button";

export interface IndicatieResultProps {
  input: FreeIndicationQuery;
  band: FreeTierBand;
  score: IndicativeScore;
}

function LabelStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-faint text-xs tracking-wide uppercase">{label}</span>
      <span className="text-3xl font-semibold">{value}</span>
    </div>
  );
}

/** What the paid report adds on top of this indication - factual, per this task's instruction, not sales copy. */
const FULL_REPORT_ADDITIONS: readonly string[] = [
  "Volledige TSG-score op alle vijf dimensies (cashflow, schuldbestendigheid, rendement, haalbaarheid, datazekerheid) - deze indicatie scoort er twee.",
  "Conservatief, basis en optimistisch scenario naast elkaar, inclusief DSCR en rendement op eigen vermogen (IRR).",
  "Opbouw van de cashflow: elke kostenpost, van bruto huur tot netto maandcashflow na belasting.",
  "Tienjarige projectie, jaar voor jaar.",
  "Exit-analyse: verkoopwaarde, verkoopcourtage, plusvalía, vermogenswinstbelasting, restschuld en netto opbrengst.",
  "Toetsing aan uw eigen randvoorwaarden: eigen vermogen, minimale cashflow en rendementsdoelstelling.",
  "Herkomst per aanname (bron en datum), en een expliciete lijst van wat niet geverifieerd is.",
];

export function IndicatieResult({ input, band, score }: IndicatieResultProps) {
  const remainingDisclosures = [
    ...band.disclosures.filter(
      (key) => key !== "band" && key !== "pointEstimateFromCustomerInput",
    ),
    ...score.disclosures,
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="border-border border-b pb-6">
        <p className="text-text-faint text-xs tracking-widest uppercase">Gratis indicatie</p>
        <h1 className="mt-1 text-xl font-semibold">{input.neighborhood}</h1>
        <p className="text-text-muted mt-2 text-sm">
          {formatEuro(input.purchasePrice)} · {input.builtAreaM2} m²
        </p>
      </header>

      <Card size="large">
        <section aria-labelledby="sectie-indicatieve-score" className="flex flex-col gap-6">
          <h2 id="sectie-indicatieve-score" className="text-text-faint text-xs tracking-widest uppercase">
            Indicatieve score
          </h2>
          <div className="flex flex-wrap gap-x-12 gap-y-6">
            <LabelStat label="Cashflow" value={translateIndicativeLabel(score.cashflowLabel)} />
            <LabelStat label="Datazekerheid" value={translateIndicativeLabel(score.dataConfidenceLabel)} />
          </div>
        </section>
      </Card>

      <Card>
        <section aria-labelledby="sectie-bandbreedte" className="flex flex-col gap-4">
          <h2 id="sectie-bandbreedte" className="text-text-faint text-xs tracking-widest uppercase">
            {band.pointEstimate ? "Cashflow-schatting" : "Cashflow-bandbreedte"}
          </h2>
          {band.pointEstimate ? (
            <p className="tabular text-2xl">
              {formatEuro(band.monthlyCashflowBeforeFinancing.low)}
              <span className="text-text-muted ml-2 text-sm">per maand</span>
            </p>
          ) : (
            <p className="tabular text-2xl">
              {formatEuro(band.monthlyCashflowBeforeFinancing.low)} –{" "}
              {formatEuro(band.monthlyCashflowBeforeFinancing.high)}
              <span className="text-text-muted ml-2 text-sm">per maand</span>
            </p>
          )}
          <p className="text-text-muted max-w-prose text-sm leading-relaxed">
            {translateFreeTierDisclosure(
              band.pointEstimate ? "pointEstimateFromCustomerInput" : "band",
            )}
          </p>
        </section>
      </Card>

      <Card>
        <section aria-labelledby="sectie-toelichting" className="flex flex-col gap-4">
          <h2 id="sectie-toelichting" className="text-text-faint text-xs tracking-widest uppercase">
            Toelichting
          </h2>
          <ul className="flex flex-col gap-3">
            {remainingDisclosures.map((key) => (
              <li key={key} className="text-text-muted max-w-prose text-sm leading-relaxed">
                {translateFreeTierDisclosure(key)}
              </li>
            ))}
          </ul>
        </section>
      </Card>

      <Card>
        <section aria-labelledby="sectie-wat-mist" className="flex flex-col gap-4">
          <h2 id="sectie-wat-mist" className="text-text-faint text-xs tracking-widest uppercase">
            Wat het volledige rapport toevoegt
          </h2>
          <ul className="flex flex-col gap-2">
            {FULL_REPORT_ADDITIONS.map((line) => (
              <li key={line} className="flex gap-3">
                <span aria-hidden="true" className="text-text-faint select-none">
                  –
                </span>
                <p className="max-w-prose text-sm leading-relaxed">{line}</p>
              </li>
            ))}
          </ul>
        </section>
      </Card>

      <footer className="border-border flex flex-wrap items-center justify-between gap-4 border-t pt-6">
        <ShareButton />
        <a
          href="/rapport/nieuw/pand"
          className="text-text-muted hover:text-accent focus-visible:ring-accent-ring rounded-sm text-sm underline transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Naar het volledige rapport
        </a>
      </footer>
    </div>
  );
}
