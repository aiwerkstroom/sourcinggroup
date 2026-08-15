/**
 * The free indication's card shell (DESIGN_SPEC.md §3): white surface on
 * the warm-white page, a subtle shadow and an almost-invisible border - the
 * border exists because the shadow alone is not reliably visible on every
 * screen, not because the card needs a hard edge.
 *
 * A local duplicate of app/rapport/resultaat/_components/card.tsx, same
 * reasoning as this flow's fields.tsx and parse-number.ts: /gratis is a
 * deliberately separate flow from the paid wizard, so it does not reach
 * into that route's private _components folder for a few lines of
 * Tailwind classes.
 *
 * `size="large"` is for the one card this flow's own task instructions
 * name as its visual centre of gravity: the indicative score, the same
 * role the TSG-score card plays in the paid report.
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
