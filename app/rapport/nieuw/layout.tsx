"use client";

/**
 * Wizard shell for the paid report.
 *
 * Client component on purpose: it owns the step state (wizard-state.tsx)
 * and App Router keeps a layout mounted across navigations between its
 * child routes, so what was typed in step 1 is still there in step 3.
 *
 * Its children are still Server Components - each step page reads whatever
 * it needs from the calculation layer on the server and hands the client
 * form plain props. That is what keeps parameters.ts, and with it the
 * scoring weights UI_SPEC.md §5 says are not published, out of the browser
 * bundle (interview round 1: both paths server-side).
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WIZARD_STEPS } from "./_lib/steps";
import { useWizard } from "./_state/wizard-state";

function StepIndicator() {
  const pathname = usePathname();
  const { completedSteps } = useWizard();
  const currentIndex = WIZARD_STEPS.findIndex((step) => pathname === step.href);

  return (
    <ol className="border-border flex flex-wrap items-center gap-x-1 gap-y-2 border-b pb-4 text-sm">
      {WIZARD_STEPS.map((step, index) => {
        const isCurrent = index === currentIndex;
        const isVisitable = completedSteps.has(step.slug) || index < currentIndex;
        const number = (
          <span
            className={`tabular mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
              isCurrent
                ? "bg-text text-bg"
                : isVisitable
                  ? "border-border-strong text-text-muted border"
                  : "border-border text-text-faint border"
            }`}
          >
            {index + 1}
          </span>
        );

        return (
          <li key={step.slug} className="flex items-center">
            {isVisitable && !isCurrent ? (
              <Link
                href={step.href}
                className="text-text-muted hover:text-text focus-visible:ring-accent-ring flex items-center rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {number}
                {step.label}
              </Link>
            ) : (
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={`flex items-center ${isCurrent ? "text-text" : "text-text-faint"}`}
              >
                {number}
                {step.label}
              </span>
            )}
            {index < WIZARD_STEPS.length - 1 ? (
              <span aria-hidden className="text-text-faint mx-3">
                /
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export default function WizardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <header className="mb-6">
        <p className="text-text-faint text-xs tracking-widest uppercase">Betaald rapport</p>
        <h1 className="mt-1 text-xl font-semibold">Rendementsrapport aanvragen</h1>
      </header>
      <StepIndicator />
      <main className="py-8">{children}</main>
    </div>
  );
}
