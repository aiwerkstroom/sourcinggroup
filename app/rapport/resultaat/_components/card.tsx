/**
 * The report's card shell (DESIGN_SPEC.md §3): white surface on the
 * warm-white page, a subtle shadow and an almost-invisible border - the
 * border exists because the shadow alone is not reliably visible on every
 * screen, not because the card needs a hard edge.
 *
 * Pure presentation, no logic: `paid-report.tsx` wraps each of the nine
 * sections in one of these rather than any section owning its own card
 * chrome. That is what keeps every section's own golden-render test
 * (which renders e.g. <ExitSection /> directly, never through PaidReport)
 * untouched by this pass - the card is chrome around content, not part of
 * the content the tests check.
 *
 * `size="large"` is for the one card DESIGN_SPEC.md §3 names explicitly as
 * a "grote hoofdkaart": the TSG-score. Every other section is the p-6
 * default.
 */

export interface CardProps {
  children: React.ReactNode;
  size?: "default" | "large";
}

export function Card({ children, size = "default" }: CardProps) {
  return (
    <div className={`bg-surface border-border rounded-lg border shadow-sm ${size === "large" ? "p-8" : "p-6"}`}>
      {children}
    </div>
  );
}
