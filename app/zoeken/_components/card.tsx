/**
 * Local duplicate of the card primitive (DESIGN_SPEC.md §3): white
 * surface on the warm-white page, a subtle shadow, an almost-invisible
 * border. /app/zoeken is its own route family, decoupled the same way
 * /gratis, /app/auth and /app/rapport/betalen already are - small
 * presentational primitives get copied rather than imported across a
 * route's private folder boundary.
 */
export function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-surface border-border rounded-lg border p-6 shadow-sm">{children}</div>;
}
