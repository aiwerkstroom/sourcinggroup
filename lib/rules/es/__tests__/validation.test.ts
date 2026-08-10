import { describe, expect, it } from "vitest";
import { runEngine } from "../engine";
import { validateEngineInput, ValidationError } from "../validation";
import { referenceCase } from "./referencecase";

describe("input validation (self-serve: reject impossible combinations)", () => {
  it("accepts the reference case", () => {
    expect(validateEngineInput(referenceCase)).toEqual([]);
  });

  it("rejects a non-positive living area", () => {
    const bad = {
      ...referenceCase,
      property: { ...referenceCase.property, livingAreaM2: 0 },
    };
    expect(validateEngineInput(bad)).not.toEqual([]);
    expect(() => runEngine(bad)).toThrow(ValidationError);
  });

  it("rejects minLtv > maxLtv", () => {
    const bad = {
      ...referenceCase,
      constraints: { ...referenceCase.constraints, minLtv: 0.8, maxLtv: 0.7 },
    };
    expect(validateEngineInput(bad).join(" ")).toContain("minLtv");
  });

  it("rejects an out-of-range preferred LTV", () => {
    const bad = {
      ...referenceCase,
      constraints: { ...referenceCase.constraints, preferredLtv: 1.2 },
    };
    expect(validateEngineInput(bad)).not.toEqual([]);
  });

  it("rejects a negative purchase price", () => {
    const bad = {
      ...referenceCase,
      property: { ...referenceCase.property, purchasePrice: -1 },
    };
    expect(validateEngineInput(bad)).not.toEqual([]);
  });

  it("rejects non-positive rent selections", () => {
    const bad = {
      ...referenceCase,
      selections: { ...referenceCase.selections, rentPerM2LongTerm: 0 },
    };
    expect(validateEngineInput(bad)).not.toEqual([]);
  });
});
