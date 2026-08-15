/**
 * DESIGN_SPEC.md §10.7: a small monochrome spinner alongside a Server
 * Action button's loading text. `currentColor` on both strokes, so it
 * takes on whatever text colour the button around it already uses (white
 * on the filled primary buttons) - no colour of its own, and nothing this
 * report reserves for a signal (UI_SPEC.md §1).
 */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
