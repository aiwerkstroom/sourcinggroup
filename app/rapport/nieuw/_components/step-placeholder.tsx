"use client";

/**
 * Stand-in for a wizard step that has not been built yet, so the step
 * indicator and the "Volgende" navigation are real while the wizard is
 * assembled one step at a time. Each of these is replaced wholesale by the
 * step's own form; none of it survives into the finished wizard.
 */

import Link from "next/link";

export function StepPlaceholder({
  title,
  stepNumber,
  previousHref,
}: {
  title: string;
  stepNumber: number;
  previousHref: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-text-muted mt-1 max-w-prose text-sm">
          Deze stap wordt nog gebouwd.
        </p>
      </div>
      <div className="border-border flex items-center justify-between border-t pt-6">
        <p className="text-text-faint text-xs">Stap {stepNumber} van 4</p>
        <Link
          href={previousHref}
          className="border-border-strong rounded-md border px-4 py-2 text-sm hover:bg-white/5"
        >
          Terug
        </Link>
      </div>
    </div>
  );
}
