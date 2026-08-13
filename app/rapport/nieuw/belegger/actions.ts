"use server";

/**
 * Server Action for step 3's rent pre-fill.
 *
 * The pre-fill rule lives in the calculation layer (rent-prefill.ts) and
 * reads parameters.ts - both neighbourhood rent tables and the
 * usable/built ratio. Interview round 1 put the engine server-side so
 * TSG_SCORE_DIMENSION_WEIGHTS never reaches the browser, and parameters.ts
 * is one module: importing any part of it into a client component would
 * pull the weights in with it.
 *
 * So the client asks, the server answers. One round-trip when step 3
 * mounts, carrying only the two rates this property needs - not the table.
 */

import { computeRentPrefill } from "@/lib/rules/es/rent-prefill";
import type { RentPrefill } from "@/lib/rules/es/rent-prefill";

export async function fetchRentPrefill(args: {
  neighborhood: string | undefined;
  builtAreaM2: number;
  usableAreaM2?: number;
  actualCurrentRentMonthly?: number;
  actualCurrentRentAppliesTo?: "longTerm" | "shortTerm";
}): Promise<RentPrefill> {
  return computeRentPrefill(args);
}
