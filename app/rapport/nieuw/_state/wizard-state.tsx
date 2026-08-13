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
import type { EngineResult } from "@/lib/rules/es/types";

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

/**
 * Step 3. LTV and ROI are held as percentages, the way the customer types
 * them ("70"), and converted to the engine's fractions (0.7) at
 * validation time - so the field rules stay the engine's own.
 */
export interface BeleggerStepData {
  ownMoney: string;
  totalBudget: string;
  maxRenovationBudget: string;
  preferredLtvPercent: string;
  minLtvPercent: string;
  maxLtvPercent: string;
  maxMonthlyDebt: string;
  minMonthlyCashflow: string;
  minRoiTargetPercent: string;
  holdingYears: string;
  /** "" until chosen; otherwise a RentalStrategy the permit gate allows. */
  rentalStrategy: string;
  rentPerM2LongTerm: string;
  rentPerM2ShortTerm: string;
  /** Which rate, if any, the prefill took from the observed current rent - carried into ModelSelections. */
  rentFromActualCurrentRent: "" | "longTerm" | "shortTerm";
  /** False until the server action has filled the rate fields once, so it does not overwrite edits. */
  rentPrefilled: boolean;
}

/**
 * Step 4. Both figures are exit assumptions the engine gives no default
 * (MODEL_SPEC_FASE1B §5) - they have to come from the customer or the
 * report cannot compute an exit at all.
 *
 * The commission is pre-filled because a Spanish selling commission has a
 * conventional range and 4% is the figure the golden tests are anchored
 * on; the plusvalía is not, because it is a municipal levy that varies per
 * town and per holding period and no generic figure would be honest.
 */
export interface ExitStepData {
  sellingCommissionPercent: string;
  municipalCapitalGainsTax: string;
}

export interface WizardData {
  pand: PandStepData;
  staatEnLasten: StaatEnLastenStepData;
  belegger: BeleggerStepData;
  exit: ExitStepData;
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

export const EMPTY_BELEGGER: BeleggerStepData = {
  ownMoney: "",
  totalBudget: "",
  maxRenovationBudget: "",
  preferredLtvPercent: "",
  minLtvPercent: "",
  maxLtvPercent: "",
  maxMonthlyDebt: "",
  minMonthlyCashflow: "",
  minRoiTargetPercent: "",
  holdingYears: "",
  rentalStrategy: "",
  rentPerM2LongTerm: "",
  rentPerM2ShortTerm: "",
  rentFromActualCurrentRent: "",
  rentPrefilled: false,
};

/**
 * Pre-filled selling commission, as a percentage. Not a parameter in
 * parameters.ts: it is a starting value for a field the customer is
 * expected to confirm or change, not a figure any calculation falls back
 * on. Whatever ends up in the field is what the engine receives.
 */
export const DEFAULT_SELLING_COMMISSION_PERCENT = "4";

export const EMPTY_EXIT: ExitStepData = {
  sellingCommissionPercent: DEFAULT_SELLING_COMMISSION_PERCENT,
  municipalCapitalGainsTax: "",
};

interface WizardContextValue {
  data: WizardData;
  setPand: (patch: Partial<PandStepData>) => void;
  setStaatEnLasten: (patch: Partial<StaatEnLastenStepData>) => void;
  setBelegger: (patch: Partial<BeleggerStepData>) => void;
  setExit: (patch: Partial<ExitStepData>) => void;
  /** The engine's output, once step 4 has run it. Held here so the result page can render it - nothing is persisted. */
  result: EngineResult | null;
  setResult: (result: EngineResult | null) => void;
  /** Slugs of steps submitted successfully - later steps use this to detect a cold entry. */
  completedSteps: ReadonlySet<string>;
  markCompleted: (slug: string) => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<WizardData>({
    pand: EMPTY_PAND,
    staatEnLasten: EMPTY_STAAT_EN_LASTEN,
    belegger: EMPTY_BELEGGER,
    exit: EMPTY_EXIT,
  });
  const [result, setResult] = useState<EngineResult | null>(null);
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

  const setBelegger = useCallback((patch: Partial<BeleggerStepData>) => {
    setData((current) => ({ ...current, belegger: { ...current.belegger, ...patch } }));
  }, []);

  const setExit = useCallback((patch: Partial<ExitStepData>) => {
    setData((current) => ({ ...current, exit: { ...current.exit, ...patch } }));
  }, []);

  const value = useMemo<WizardContextValue>(
    () => ({
      data,
      setPand,
      setStaatEnLasten,
      setBelegger,
      setExit,
      result,
      setResult,
      completedSteps,
      markCompleted,
    }),
    [data, setPand, setStaatEnLasten, setBelegger, setExit, result, completedSteps, markCompleted],
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
