"use server";

/**
 * The paid report's calculation, run server-side.
 *
 * Interview round 1 put both paths on the server, and this is the call
 * that decision was about: runEngine() reaches computeTsgScore(), which
 * reads TSG_SCORE_DIMENSION_WEIGHTS - the one thing UI_SPEC.md §5 says is
 * not published. The weights stay here; what travels back is the result,
 * whose TsgScore carries the five dimension scores and their total but
 * not the weighting that produced it.
 *
 * Validation failures come back as data rather than as a thrown error:
 * every field has already been checked by its own step, so an issue here
 * means a cross-field rule the form could not see, and the customer needs
 * to be told rather than shown a crash.
 */

import { runEngine } from "@/lib/rules/es/engine";
import { ValidationError } from "@/lib/rules/es/validation";
import type { EngineResult } from "@/lib/rules/es/types";
import { buildEngineInput } from "../_lib/build-engine-input";
import type { WizardData } from "../_state/wizard-state";

export type RunReportOutcome =
  | { ok: true; result: EngineResult }
  | { ok: false; issues: string[] };

export async function runReport(data: WizardData): Promise<RunReportOutcome> {
  try {
    return { ok: true, result: runEngine(buildEngineInput(data)) };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { ok: false, issues: error.issues };
    }
    throw error;
  }
}
