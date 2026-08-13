import { NEIGHBORHOOD_RENT_LONG_TERM } from "@/lib/rules/es/parameters";
import { PandForm } from "./pand-form";

/**
 * Step 1 - het pand. Server Component: it reads the covered wijken from
 * parameters.ts here, on the server, and hands the client form a plain
 * list of names. That is what keeps parameters.ts - and with it
 * TSG_SCORE_DIMENSION_WEIGHTS, which UI_SPEC.md §5 says is not published -
 * out of the browser bundle, per interview round 1's server-side decision.
 */
export default function PandPage() {
  const neighborhoods = Object.keys(NEIGHBORHOOD_RENT_LONG_TERM.value);
  return <PandForm neighborhoods={neighborhoods} />;
}
