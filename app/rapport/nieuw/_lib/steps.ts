/**
 * The four wizard steps (interview round 1).
 *
 * The order is load-bearing, not cosmetic: título habilitante is asked in
 * step 2, ahead of the rentalStrategy choice in step 3, so the permit gate
 * from UI_SPEC.md §4 can close before the customer is offered short-term
 * or hybrid at all. Without a valid licence those two strategies do not
 * appear as zero - they do not appear (MODEL_SPEC.md §18, and
 * validateEngineInput() rejects the combination outright).
 */

export const WIZARD_STEPS = [
  { slug: "pand", label: "Pand", href: "/rapport/nieuw/pand" },
  {
    slug: "staat-en-lasten",
    label: "Staat en lasten",
    href: "/rapport/nieuw/staat-en-lasten",
  },
  { slug: "belegger", label: "Belegger", href: "/rapport/nieuw/belegger" },
  { slug: "exit", label: "Exit", href: "/rapport/nieuw/exit" },
] as const;

export type WizardStepSlug = (typeof WIZARD_STEPS)[number]["slug"];

export function stepIndex(slug: WizardStepSlug): number {
  return WIZARD_STEPS.findIndex((s) => s.slug === slug);
}
