/**
 * §6.2 of UI_SPEC.md's report structure: "Uitkomst in één regel — het
 * lichte oordeel, met de drie kerncijfers van het basisscenario:
 * maandcashflow, DSCR, IRR."
 *
 * Plain function component, same reasoning as TsgScoreSection: it takes
 * the engine's own types and nothing from wizard state, so it renders
 * identically on the result page, in a golden-render test, and later in
 * the PDF.
 *
 * This is also where EngineResult.rentInputProvenance surfaces - no new
 * logic, the four statuses and their disclosure keys already exist
 * (rent-provenance.ts). What is new here is only the visual weight per
 * key, chosen once and applied per this task's instruction: a boxed
 * callout for a significant override (it changed the headline figures,
 * so it sits where the headline is), a plain sentence for the reassuring
 * actualCurrentRent case, and a faint aside for a minor override. None of
 * the three uses colour - UI_SPEC.md §1 reserves colour for a pass/fail
 * signal, and a rent deviation is neither.
 */

// Imported from rent-provenance-key.ts, not rent-provenance.ts - see that
// module's own docstring for why: rent-provenance.ts also imports
// parameters.ts, which this component must never reach even transitively.
import { rentProvenanceDisclosureKey } from "@/lib/rules/es/rent-provenance-key";
import { translateRentProvenanceDisclosure } from "@/lib/copy/es/rent-provenance-disclosures";
import type {
  IrrResult,
  RentInputProvenance,
  RentInputProvenanceReport,
} from "@/lib/rules/es/types";
import { formatEuro, formatPercent } from "../_lib/format";
import { buildOneLineVerdict } from "../_lib/one-line-verdict";

export interface OneLineOutcomeSectionProps {
  monthlyCashflow: number;
  dscr: number;
  irr: IrrResult;
  meetsMinRequiredReturn: boolean | null;
  rentInputProvenance: RentInputProvenanceReport;
}

function StatFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-text-faint text-xs tracking-wide uppercase">{label}</span>
      <span className="tabular text-lg">{value}</span>
    </div>
  );
}

interface RateNote {
  rate: "longTerm" | "shortTerm";
  text: string;
}

function collectNotes(
  report: RentInputProvenanceReport,
  key: "rentOverrideSignificant" | "rentOverrideMinor" | "rentFromActualCurrentRent",
): RateNote[] {
  const notes: RateNote[] = [];
  for (const [rate, provenance] of [
    ["longTerm", report.longTerm],
    ["shortTerm", report.shortTerm],
  ] as const) {
    if (provenance === null) continue;
    if (rentProvenanceDisclosureKey(provenance as RentInputProvenance) !== key) continue;
    const text = translateRentProvenanceDisclosure(rate, provenance as RentInputProvenance);
    if (text !== null) notes.push({ rate, text });
  }
  return notes;
}

function RentProvenanceNotes({ report }: { report: RentInputProvenanceReport }) {
  const significant = collectNotes(report, "rentOverrideSignificant");
  const actual = collectNotes(report, "rentFromActualCurrentRent");
  const minor = collectNotes(report, "rentOverrideMinor");

  if (significant.length === 0 && actual.length === 0 && minor.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {significant.length > 0 ? (
        <div className="border-border-strong flex flex-col gap-1.5 border-l-2 pl-4">
          {significant.map((note) => (
            <p key={note.rate} className="text-sm leading-relaxed">
              {note.text}
            </p>
          ))}
        </div>
      ) : null}
      {actual.map((note) => (
        <p key={note.rate} className="text-text-muted text-sm leading-relaxed">
          {note.text}
        </p>
      ))}
      {minor.map((note) => (
        <p key={note.rate} className="text-text-faint text-xs leading-relaxed">
          {note.text}
        </p>
      ))}
    </div>
  );
}

export function OneLineOutcomeSection({
  monthlyCashflow,
  dscr,
  irr,
  meetsMinRequiredReturn,
  rentInputProvenance,
}: OneLineOutcomeSectionProps) {
  const verdict = buildOneLineVerdict({ monthlyCashflow, dscr, irr, meetsMinRequiredReturn });

  return (
    <section aria-labelledby="sectie-uitkomst" className="flex flex-col gap-6">
      <h2 id="sectie-uitkomst" className="text-text-faint text-xs tracking-widest uppercase">
        2. Uitkomst in één regel
      </h2>

      <p className="max-w-prose text-base leading-relaxed">{verdict}</p>

      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <StatFigure label="Maandcashflow" value={formatEuro(monthlyCashflow)} />
        <StatFigure label="DSCR" value={dscr.toFixed(2).replace(".", ",")} />
        <StatFigure label="IRR" value={irr.defined ? formatPercent(irr.irr) : "onbepaald"} />
      </div>

      <RentProvenanceNotes report={rentInputProvenance} />
    </section>
  );
}
