/**
 * The landing page's card shell (DESIGN_SPEC.md §3): white surface on the
 * warm-white page, a subtle shadow and an almost-invisible border - the
 * border exists because the shadow alone is not reliably visible on every
 * screen, not because the card needs a hard edge.
 *
 * A local duplicate of app/rapport/resultaat/_components/card.tsx and its
 * siblings (app/gratis, app/zoeken, app/auth, app/rapport/betalen each
 * keep their own copy) - established project convention: a route area
 * does not reach into another route's private _components folder for a
 * few lines of Tailwind classes.
 *
 * `size="large"` is for the landing page's own closing CTA
 * (LANDING_SPEC.md §7) - the one card on this page meant to read as a
 * destination, not a supporting block.
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
