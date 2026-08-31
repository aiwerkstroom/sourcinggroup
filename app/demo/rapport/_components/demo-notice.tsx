/**
 * The demo route's one required piece of copy: that this is a worked
 * example on a fixed reference property, not a real customer's report.
 *
 * Styled as a Card (the report's own chrome, _components/card.tsx under
 * app/rapport/resultaat) rather than a warning banner - it is not an
 * error state or a risk to flag, it is the same kind of scope-setting
 * statement the report already makes elsewhere (placeholders-section.tsx's
 * "dit rapport rekent op enkele aannames...", assumptions-section.tsx's
 * sourcing notes). A red or yellow alert box would suggest something is
 * wrong with the report; nothing is - it is simply not this visitor's own.
 *
 * Plain function component, no client boundary: this whole route never
 * needs one.
 */

import { Card } from "@/app/rapport/resultaat/_components/card";

export function DemoNotice({ propertyAddress }: { propertyAddress: string }) {
  return (
    <Card>
      <p data-demo-notice="" className="text-sm leading-relaxed">
        Dit is een voorbeeldrapport, opgebouwd rond één vast referentiepand ({propertyAddress}) -
        niet een eigen aanvraag. Het toont hoe een volledig rendementsrapport eruitziet en rekent,
        inclusief de Yield &amp; Stone-score en de cashflowgrafiek, ter illustratie tijdens een
        gesprek of demonstratie.
      </p>
    </Card>
  );
}
