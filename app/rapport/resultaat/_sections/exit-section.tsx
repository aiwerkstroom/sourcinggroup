/**
 * §6.6 of UI_SPEC.md's report structure: "Exit — verkoopwaarde, kosten,
 * belasting, restschuld, netto opbrengst."
 *
 * Plain function component, same reasoning as the sections before it: it
 * takes the base scenario's already-computed ExitResult and renders it,
 * nothing more. The six rows and their order (verkoopwaarde,
 * verkoopcourtage, plusvalía, vermogenswinstbelasting, restschuld, netto
 * verkoopopbrengst) are exit.ts's own netSaleProceeds formula read
 * top to bottom - sellingPrice minus sellingCommission minus
 * municipalCapitalGainsTax minus capitalGainsTax minus
 * mortgageBalanceAtExit - not a report-layer re-derivation of that
 * arithmetic.
 *
 * One-time amounts at the end of the holding period, not monthly figures -
 * unlike section 4's cashflow walk, there is no "per month" reading of a
 * sale.
 */

import type { ExitResult } from "@/lib/rules/es/types";
import { formatEuro } from "../_lib/format";

export interface ExitSectionProps {
  exit: Pick<
    ExitResult,
    | "sellingPrice"
    | "sellingCommission"
    | "municipalCapitalGainsTax"
    | "capitalGainsTax"
    | "mortgageBalanceAtExit"
    | "netSaleProceeds"
    | "holdingYears"
  >;
}

function Row({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-text-muted text-sm">{label}</span>
      <span className="tabular text-sm">{formatEuro(amount)}</span>
    </div>
  );
}

function Subtotal({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="border-border flex items-baseline justify-between gap-4 border-t pt-2 pb-1.5">
      <span className="text-sm font-medium">{label}</span>
      <span className="tabular text-sm font-medium">{formatEuro(amount)}</span>
    </div>
  );
}

export function ExitSection({ exit }: ExitSectionProps) {
  return (
    <section aria-labelledby="sectie-exit" className="flex flex-col gap-0">
      <h2 id="sectie-exit" className="text-text-faint mb-4 text-xs tracking-widest uppercase">
        6. Exit
      </h2>
      <p className="text-text-muted mb-4 max-w-prose text-sm leading-relaxed">
        Basisscenario, bij verkoop na {exit.holdingYears} jaar.
      </p>

      <Row label="Verkoopwaarde" amount={exit.sellingPrice} />
      <Row label="Verkoopcourtage" amount={-exit.sellingCommission} />
      <Row label="Plusvalía municipal" amount={-exit.municipalCapitalGainsTax} />
      <Row label="Vermogenswinstbelasting" amount={-exit.capitalGainsTax} />
      <Row label="Restschuld hypotheek" amount={-exit.mortgageBalanceAtExit} />

      <Subtotal label="Netto verkoopopbrengst" amount={exit.netSaleProceeds} />
    </section>
  );
}
