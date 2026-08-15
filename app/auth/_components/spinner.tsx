/**
 * Local duplicate of app/rapport/nieuw/_components/spinner.tsx - /app/auth
 * is its own route family, decoupled from the paid wizard the same way
 * /gratis already is (that folder's own docstring explains why: a
 * leading underscore marks a folder private to its route, and reaching
 * across route families for even small shared primitives has been this
 * project's deliberate choice throughout, not an oversight). `currentColor`
 * on both strokes, so it takes on whatever text colour the button around
 * it uses - no colour of its own (UI_SPEC.md §1 reserves colour for signals).
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
