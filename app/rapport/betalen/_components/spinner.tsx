/**
 * Local duplicate of the wizard's spinner (DESIGN_SPEC.md §8): a small
 * monochrome circle beside a button's loading text, drawn in
 * `currentColor` so it takes the colour of whatever button holds it.
 * Copied rather than imported, per this route family's decoupling - the
 * same reason /app/auth carries its own.
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
