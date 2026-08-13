"use client";

/**
 * Wizard state for the paid report's four steps.
 *
 * Held in React context on a client layout, which App Router keeps mounted
 * across step navigations - so moving between steps preserves what was
 * typed without any storage. Nothing is persisted: CLAUDE.md §4 puts
 * accounts and storage in phase 4, and this form contains a full address,
 * which is not something to park in browser storage on my own initiative.
 * The consequence is deliberate and worth stating plainly: a hard refresh
 * mid-wizard loses the input, and steps entered without prior state send
 * the visitor back to step 1 rather than showing a half-empty form.
 *
 * Values are kept as raw strings, exactly as typed. Parsing happens at
 * validation time (parse-number.ts), so a half-finished "1," or "-" is
 * never rewritten under the cursor.
 *
 * The shape grows one step at a time, as each step is built.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/** Step 1. Mirrors UI_SPEC.md §3's first- and second-order property fields. */
export interface PandStepData {
  address: string;
  /** One of NEIGHBORHOOD_RENT_LONG_TERM's keys, or OTHER_NEIGHBORHOOD. Drives the step-3 rent pre-fill. */
  neighborhood: string;
  propertyType: string;
  units: string;
  purchasePrice: string;
  builtAreaM2: string;
  usableAreaM2: string;
  rooms: string;
  bedrooms: string;
  bathrooms: string;
  constructionYear: string;
  energyLabel: string;
}

/**
 * Step 2. The permit answer lives here on purpose: it is asked before the
 * rentalStrategy choice in step 3, so the gate from UI_SPEC.md §4 can
 * close before short-term and hybrid are ever offered (interview round 1).
 *
 * `hasTouristRentalLicense` is a tri-state string rather than a boolean
 * because "" means "not answered yet". PropertyInput's own field is a
 * mandatory boolean with no default (MODEL_SPEC.md §18), which is exactly
 * why the form must not start it at false: an unanswered question would
 * silently read as "no licence".
 */
export interface StaatEnLastenStepData {
  /** "" until answered; otherwise a MaintenanceCondition. Drives renovationStrategy via deriveRenovationStrategy(). */
  maintenanceCondition: string;
  communityFeesAnnual: string;
  /** Both cadastral halves are optional, but supplying one without the other is not (MODEL_SPEC.md §16). */
  cadastralSuelo: string;
  cadastralConstruccion: string;
  currentRentStatus: string;
  /** Only meaningful when currentRentStatus is "rented". Collected per UI_SPEC.md §3; no engine field consumes it yet. */
  currentRentMonthly: string;
  /** "" (unanswered) | "yes" | "no". Never defaulted - see the note above. */
  hasTouristRentalLicense: string;
}

export interface WizardData {
  pand: PandStepData;
  staatEnLasten: StaatEnLastenStepData;
}

/**
 * The value the neighbourhood select uses for "not one of the covered
 * wijken". The paid path accepts any address (UI_SPEC.md §3 asks for a
 * full one), so this is a legitimate answer rather than an error: the rent
 * field in step 3 then has no reference to pre-fill from, and
 * EngineResult.rentInputProvenance reports "noReference".
 */
export const OTHER_NEIGHBORHOOD = "__other__";

export const EMPTY_PAND: PandStepData = {
  address: "",
  neighborhood: "",
  propertyType: "",
  units: "",
  purchasePrice: "",
  builtAreaM2: "",
  usableAreaM2: "",
  rooms: "",
  bedrooms: "",
  bathrooms: "",
  constructionYear: "",
  energyLabel: "",
};

export const EMPTY_STAAT_EN_LASTEN: StaatEnLastenStepData = {
  maintenanceCondition: "",
  communityFeesAnnual: "",
  cadastralSuelo: "",
  cadastralConstruccion: "",
  currentRentStatus: "",
  currentRentMonthly: "",
  hasTouristRentalLicense: "",
};

interface WizardContextValue {
  data: WizardData;
  setPand: (patch: Partial<PandStepData>) => void;
  setStaatEnLasten: (patch: Partial<StaatEnLastenStepData>) => void;
  /** Slugs of steps submitted successfully - later steps use this to detect a cold entry. */
  completedSteps: ReadonlySet<string>;
  markCompleted: (slug: string) => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<WizardData>({
    pand: EMPTY_PAND,
    staatEnLasten: EMPTY_STAAT_EN_LASTEN,
  });
  const [completedSteps, setCompletedSteps] = useState<ReadonlySet<string>>(new Set());

  const setPand = useCallback((patch: Partial<PandStepData>) => {
    setData((current) => ({ ...current, pand: { ...current.pand, ...patch } }));
  }, []);

  const setStaatEnLasten = useCallback((patch: Partial<StaatEnLastenStepData>) => {
    setData((current) => ({
      ...current,
      staatEnLasten: { ...current.staatEnLasten, ...patch },
    }));
  }, []);

  const markCompleted = useCallback((slug: string) => {
    setCompletedSteps((current) => {
      if (current.has(slug)) return current;
      const next = new Set(current);
      next.add(slug);
      return next;
    });
  }, []);

  const value = useMemo<WizardContextValue>(
    () => ({ data, setPand, setStaatEnLasten, completedSteps, markCompleted }),
    [data, setPand, setStaatEnLasten, completedSteps, markCompleted],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (context === null) {
    throw new Error("useWizard must be used inside a WizardProvider");
  }
  return context;
}
