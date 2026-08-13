import { redirect } from "next/navigation";
import { WIZARD_STEPS } from "./_lib/steps";

/** The wizard always starts at its first step. */
export default function NieuwRapportPage() {
  redirect(WIZARD_STEPS[0].href);
}
