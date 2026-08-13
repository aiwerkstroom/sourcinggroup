"use client";

/**
 * Scaffolding for the paid report, not the report itself.
 *
 * UI_SPEC.md §6 specifies nine sections in a fixed order, with the five
 * score dimensions as horizontal bars, a ten-year table plus one SVG line
 * chart, and the assumptions appendix. None of that is here yet. This
 * page exists so the wizard has somewhere to land and so the chain -
 * four steps, one EngineInput, one runEngine() - is visible end to end.
 *
 * What it does already follow: §5's rule that the free tier gets no
 * dimension breakdown but the paid report does, §7's insistence that a
 * weak outcome is reported as a finding rather than an alarm (no red
 * panels here), and §1's ban on false precision - figures are rounded to
 * whole euros.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { translateRentInputProvenanceReport } from "@/lib/copy/es/rent-provenance-disclosures";
import { useWizard } from "../nieuw/_state/wizard-state";

const EURO = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const PERCENT = new Intl.NumberFormat("nl-NL", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const SCENARIO_LABELS: Readonly<Record<string, string>> = {
  conservative: "Conservatief",
  base: "Basis",
  optimistic: "Optimistisch",
};

export function ResultatView() {
  const router = useRouter();
  const { result, data } = useWizard();

  // Nothing is persisted, so a refresh or a direct visit has no result to
  // show. Starting over is the honest answer.
  useEffect(() => {
    if (result === null) router.replace("/rapport/nieuw/pand");
  }, [result, router]);
  if (result === null) return null;

  const outcomes = result.scenarioOutcomes;
  const base = outcomes?.find((o) => o.scenario === "base") ?? null;
  const rentNotes = translateRentInputProvenanceReport(result.rentInputProvenance);

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <header className="border-border border-b pb-6">
        <p className="text-text-faint text-xs tracking-widest uppercase">Rendementsrapport</p>
        <h1 className="mt-1 text-xl font-semibold">{data.pand.address}</h1>
      </header>

      <p className="border-border text-text-muted mt-6 rounded-md border border-dashed px-4 py-3 text-xs leading-relaxed">
        Dit is de uitkomst van de rekenkern. De volledige rapportopbouw — de vijf scoredimensies,
        de drie scenario&apos;s naast elkaar, de tienjarige reeks, de exit en de aannamebijlage —
        wordt hierna gebouwd.
      </p>

      {base?.score ? (
        <section className="mt-10">
          <h2 className="text-text-faint text-xs tracking-widest uppercase">
            TSG-score — basisscenario
          </h2>
          <div className="mt-3 flex items-baseline gap-4">
            <span className="tabular text-4xl font-semibold">
              {base.score.total.toFixed(1).replace(".", ",")}
            </span>
            <span className="text-text-muted text-sm">
              percentiel {base.percentile} van ons modelbereik
            </span>
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-text-faint text-xs tracking-widest uppercase">De drie scenario&apos;s</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-lg border-collapse text-sm">
            <thead>
              <tr className="border-border text-text-muted border-b text-left">
                <th className="py-2 pr-4 font-medium">Scenario</th>
                <th className="py-2 pr-4 text-right font-medium">Maandcashflow</th>
                <th className="py-2 pr-4 text-right font-medium">DSCR</th>
                <th className="py-2 pr-4 text-right font-medium">IRR</th>
                <th className="py-2 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {result.scenarios.map((scenario) => {
                const outcome = outcomes?.find((o) => o.scenario === scenario.id) ?? null;
                return (
                  <tr key={scenario.id} className="border-border/50 border-b">
                    <td className="py-2 pr-4">{SCENARIO_LABELS[scenario.id]}</td>
                    <td className="tabular py-2 pr-4 text-right">
                      {EURO.format(scenario.monthlyCashflow)}
                    </td>
                    <td className="tabular py-2 pr-4 text-right">
                      {scenario.dscr.toFixed(3).replace(".", ",")}
                    </td>
                    <td className="tabular py-2 pr-4 text-right">
                      {outcome?.irr.defined ? PERCENT.format(outcome.irr.irr) : "—"}
                    </td>
                    <td className="tabular py-2 text-right">
                      {outcome?.score ? outcome.score.total.toFixed(1).replace(".", ",") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {rentNotes.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-text-faint text-xs tracking-widest uppercase">Huurwaarde</h2>
          {rentNotes.map((note) => (
            <p key={note} className="text-text-muted mt-2 max-w-prose text-sm leading-relaxed">
              {note}
            </p>
          ))}
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-text-faint text-xs tracking-widest uppercase">
          Onbevestigde aannames
        </h2>
        <p className="text-text-muted mt-2 max-w-prose text-sm">
          Deze uitkomst rust op {base?.placeholdersUsed.length ?? 0} parameters die nog niet tegen
          een externe bron zijn geverifieerd. Het volledige rapport noemt ze bij naam.
        </p>
      </section>

      <div className="border-border mt-12 border-t pt-6">
        <Link href="/rapport/nieuw/pand" className="text-text-muted hover:text-text text-sm">
          Nieuw pand invoeren
        </Link>
      </div>
    </div>
  );
}
