import { describe, expect, it } from "vitest";
import {
  MAINTENANCE_CONDITION_COPY_NL,
  MAINTENANCE_CONDITION_ORDER,
  RENOVATION_STRATEGY_CHOICE_COPY_NL,
  RENOVATION_STRATEGY_ORDER,
  RENTAL_STRATEGY_COPY_NL,
  renovationStrategyDerivedOptionLabel,
} from "../../../copy/es/selections";
import { deriveRenovationStrategy } from "../derive-selections";
import { rentalStrategyAvailability } from "../licensing";
import type { MaintenanceCondition } from "../types";

describe("maintenance condition copy covers the whole union", () => {
  const allConditions: MaintenanceCondition[] = ["good", "average", "poor"];

  it("has a label and a description for every condition", () => {
    expect(Object.keys(MAINTENANCE_CONDITION_COPY_NL).sort()).toEqual([...allConditions].sort());
    for (const condition of allConditions) {
      expect(MAINTENANCE_CONDITION_COPY_NL[condition].label.length).toBeGreaterThan(0);
      expect(MAINTENANCE_CONDITION_COPY_NL[condition].description.length).toBeGreaterThan(0);
    }
  });

  it("orders them best to worst, which is the order the form offers them in", () => {
    expect(MAINTENANCE_CONDITION_ORDER).toEqual(["good", "average", "poor"]);
  });

  it("every offered condition maps to a real renovation tier", () => {
    for (const condition of MAINTENANCE_CONDITION_ORDER) {
      expect(["minimal", "light", "heavy"]).toContain(deriveRenovationStrategy(condition));
    }
  });
});

describe("rental strategy copy covers the whole union", () => {
  it("has a Dutch label for each of the three strategies", () => {
    expect(Object.keys(RENTAL_STRATEGY_COPY_NL).sort()).toEqual([
      "hybrid",
      "longTerm",
      "shortTerm",
    ]);
  });

  it("can label every strategy the permit gate makes available, either way", () => {
    // Step 2 promises step 3 will offer exactly these; step 3 must be able
    // to render each of them, whichever way the licence question is answered.
    for (const hasLicence of [true, false]) {
      const availability = rentalStrategyAvailability(hasLicence);
      for (const strategy of availability.available) {
        expect(RENTAL_STRATEGY_COPY_NL[strategy].length).toBeGreaterThan(0);
      }
      for (const { strategy } of availability.unavailable) {
        expect(RENTAL_STRATEGY_COPY_NL[strategy].length).toBeGreaterThan(0);
      }
    }
  });
});

describe("the permit gate does what step 2 tells the customer it will do", () => {
  it("with a licence: all three strategies stay on the table", () => {
    const availability = rentalStrategyAvailability(true);
    expect(availability.available).toEqual(["longTerm", "shortTerm", "hybrid"]);
    expect(availability.unavailable).toEqual([]);
  });

  it("without a licence: long-term only, and short-term/hybrid are absent with a reason", () => {
    // UI_SPEC.md §4: they do not appear as zero, they do not appear - and
    // the reason travels so the report can explain the absence.
    const availability = rentalStrategyAvailability(false);
    expect(availability.available).toEqual(["longTerm"]);
    expect(availability.unavailable.map((u) => u.strategy).sort()).toEqual([
      "hybrid",
      "shortTerm",
    ]);
    for (const entry of availability.unavailable) {
      expect(entry.reason).toContain("título habilitante");
    }
  });
});

/**
 * Fase C stap 1: the renovation-tier choice copy, and the label of its
 * "derive it for me" option - which names the tier the derivation
 * currently lands on, so the customer sees what they are accepting.
 */
describe("renovation tier choice copy (fase C stap 1)", () => {
  it("has a label and a description for all three tiers", () => {
    for (const tier of RENOVATION_STRATEGY_ORDER) {
      const { label, description } = RENOVATION_STRATEGY_CHOICE_COPY_NL[tier];
      expect(label.length).toBeGreaterThan(0);
      expect(description.length).toBeGreaterThan(0);
    }
  });

  it("offers the three tiers in ascending order of work", () => {
    expect(RENOVATION_STRATEGY_ORDER).toEqual(["minimal", "light", "heavy"]);
  });

  it("names the derived tier in the derive-it-for-me label", () => {
    expect(renovationStrategyDerivedOptionLabel("light")).toBe(
      "Afgeleid uit de staat van onderhoud (Licht)",
    );
    expect(renovationStrategyDerivedOptionLabel("heavy")).toBe(
      "Afgeleid uit de staat van onderhoud (Grondig)",
    );
  });

  it("names no tier when there is nothing to derive from yet", () => {
    // The condition question is unanswered - guessing a tier here would
    // show the customer an assumption the model has not actually made.
    expect(renovationStrategyDerivedOptionLabel(null)).toBe("Afgeleid uit de staat van onderhoud");
  });

  it("describes scope of work, never a euro figure - the per-tier capex is itself PLACEHOLDER", () => {
    for (const tier of RENOVATION_STRATEGY_ORDER) {
      expect(RENOVATION_STRATEGY_CHOICE_COPY_NL[tier].description).not.toMatch(/€|\d{3}/);
    }
  });
});
