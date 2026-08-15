/**
 * Local duplicate of app/rapport/resultaat/_components/card.tsx
 * (DESIGN_SPEC.md §3): white surface on the warm-white page, a subtle
 * shadow, an almost-invisible border. /app/auth is its own route family
 * - the same reasoning /gratis's own card.tsx already documents applies
 * here: decoupled flows keep their own copies of small presentational
 * primitives rather than reaching into another route's private folder.
 */
export function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-surface border-border rounded-lg border p-6 shadow-sm">{children}</div>;
}
