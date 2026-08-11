/**
 * Tourist rental license gate (MODEL_SPEC.md §18). Spanish short-term/
 * tourist rental requires a título habilitante; long-term rental does
 * not. Without one, "shortTerm" and "hybrid" are not degenerate (zeroed)
 * options - they are not options at all, and the reason travels with the
 * result so a report can explain the absence.
 */

import type { RentalStrategyAvailability } from "./types";

export const TOURIST_LICENSE_REQUIRED_REASON =
  "Requires a valid título habilitante (Spanish tourist/short-term rental license); PropertyInput.hasTouristRentalLicense is false for this property.";

export function rentalStrategyAvailability(
  hasTouristRentalLicense: boolean,
): RentalStrategyAvailability {
  if (hasTouristRentalLicense) {
    return { available: ["longTerm", "shortTerm", "hybrid"], unavailable: [] };
  }
  return {
    available: ["longTerm"],
    unavailable: [
      { strategy: "shortTerm", reason: TOURIST_LICENSE_REQUIRED_REASON },
      { strategy: "hybrid", reason: TOURIST_LICENSE_REQUIRED_REASON },
    ],
  };
}
