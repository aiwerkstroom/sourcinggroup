import { ExitForm } from "./exit-form";

/**
 * Step 4 - de verkoop (UI_SPEC.md §3's exit assumptions), and the step
 * that runs the engine. Server Component; the calculation itself happens
 * in the Server Action the form calls.
 */
export default function ExitPage() {
  return <ExitForm />;
}
