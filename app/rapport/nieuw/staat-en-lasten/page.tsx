import { StaatEnLastenForm } from "./staat-en-lasten-form";

/**
 * Step 2 - staat en lasten (UI_SPEC.md §3), including the permit gate.
 *
 * Server Component, like step 1: nothing from parameters.ts reaches the
 * browser. This step needs no server data at all - the Dutch labels come
 * from the copy layer, which imports only types - so it simply renders
 * the client form.
 */
export default function StaatEnLastenPage() {
  return <StaatEnLastenForm />;
}
