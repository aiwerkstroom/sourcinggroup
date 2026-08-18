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
  /**
   * Shifts the border towards the accent on hover
   * (HOMEPAGE_UPGRADE_SPEC.md §3, for the three "hoe het werkt" cards).
   *
   * Opt-in rather than the default, and worth flagging: DESIGN_SPEC.md §5
   * says "Kaarten reageren niet op hover (statisch)".
   * HOMEPAGE_UPGRADE_SPEC.md §3 asks for exactly this on these three
   * cards, so the newer, more specific spec wins - but only where it
   * asks. Every other card on the page, and every card in the report,
   * stays static.
   *
   * Border colour only. §3 rules out scale and movement, which also keeps
   * this inside the existing transition-colors hover language rather than
   * introducing a new one.
   */
  hoverAccent?: boolean;
  /**
   * Stretches the card to its container's height.
   *
   * Needed since HOMEPAGE_UPGRADE_SPEC.md §7 step 1: the three "hoe het
   * werkt" cards used to be direct grid children, which the grid stretched
   * to a shared row height for free. Wrapping each one in a FadeIn put a
   * div between the grid and the card - the div still stretches, the card
   * inside it no longer does - and the three cards would end up at
   * different heights depending on how long their text is. This restores
   * what the grid was doing before the wrapper existed.
   */
  fill?: boolean;
}

export function Card({
  children,
  size = "default",
  hoverAccent = false,
  fill = false,
}: CardProps) {
  const padding = size === "large" ? "p-8" : "p-6";
  const hover = hoverAccent ? "hover:border-accent transition-colors duration-150" : "";
  const height = fill ? "h-full" : "";

  return (
    <div
      className={`bg-surface border-border rounded-lg border shadow-sm ${padding} ${hover} ${height}`
        .replace(/\s+/g, " ")
        .trimEnd()}
    >
      {children}
    </div>
  );
}
