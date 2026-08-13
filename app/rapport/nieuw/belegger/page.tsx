import { BeleggerForm } from "./belegger-form";

/**
 * Step 3 - de belegger (UI_SPEC.md §3), with the rental strategy behind
 * the permit gate step 2 closed.
 *
 * Server Component. The rent pre-fill it needs depends on answers held in
 * client state (wijk, area, letting status), so it cannot be computed
 * here - the client asks for it through the Server Action in actions.ts
 * instead, which keeps parameters.ts server-side either way.
 */
export default function BeleggerPage() {
  return <BeleggerForm />;
}
