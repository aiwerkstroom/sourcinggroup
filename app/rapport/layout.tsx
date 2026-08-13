"use client";

/**
 * Holds the wizard state for everything under /rapport - the four input
 * steps and the result page alike.
 *
 * The provider sits here rather than on /rapport/nieuw because the result
 * has to read what the wizard produced, and nothing is persisted
 * (wizard-state.tsx explains why). App Router keeps a layout mounted
 * across navigations between its child routes, so the engine's output
 * survives the move from step 4 to the result without a store, a URL
 * payload or a round-trip.
 */

import { WizardProvider } from "./nieuw/_state/wizard-state";

export default function RapportLayout({ children }: { children: React.ReactNode }) {
  return <WizardProvider>{children}</WizardProvider>;
}
