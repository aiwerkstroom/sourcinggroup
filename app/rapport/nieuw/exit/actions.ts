"use server";

/**
 * Server Action for step 4's plusvalía pre-fill. Same reasoning as
 * belegger/actions.ts: the estimate reads parameters.ts (both the
 * coefficient table and the rate), which must never reach the browser -
 * TSG_SCORE_DIMENSION_WEIGHTS lives in the same module.
 */

import { computePlusvaliaPrefill } from "@/lib/rules/es/plusvalia-prefill";
import type { PlusvaliaPrefill } from "@/lib/rules/es/plusvalia-prefill";

export async function fetchPlusvaliaPrefill(args: {
  cadastralSuelo?: number;
  holdingYears?: number;
}): Promise<PlusvaliaPrefill> {
  return computePlusvaliaPrefill(args);
}
