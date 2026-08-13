import { describe, expect, it } from "vitest";
import { runEngine } from "../engine";
import { validateEngineInput, ValidationError } from "../validation";
import { referenceCase } from "./referencecase";

describe("input validation (self-serve: reject impossible combinations)", () => {
  it("accepts the reference case", () => {
    expect(validateEngineInput(referenceCase)).toEqual([]);
  });

  it("rejects a non-positive built area", () => {
    const bad = {
      ...referenceCase,
      property: { ...referenceCase.property, builtAreaM2: 0 },
    };
    expect(validateEngineInput(bad)).not.toEqual([]);
    expect(() => runEngine(bad)).toThrow(ValidationError);
  });

  it("rejects a non-positive usable area when given", () => {
    const bad = {
      ...referenceCase,
      property: { ...referenceCase.property, usableAreaM2: 0 },
    };
    expect(validateEngineInput(bad)).not.toEqual([]);
  });

  it("rejects usableAreaM2 exceeding builtAreaM2", () => {
    const bad = {
      ...referenceCase,
      property: { ...referenceCase.property, usableAreaM2: 140, builtAreaM2: 133 },
    };
    expect(validateEngineInput(bad).join(" ")).toContain("usableAreaM2 cannot exceed");
  });

  it("accepts a property without usableAreaM2 (derived from builtAreaM2)", () => {
    const { usableAreaM2: _usableAreaM2, ...propertyWithoutUsableArea } = referenceCase.property;
    const ok = { ...referenceCase, property: propertyWithoutUsableArea };
    expect(validateEngineInput(ok)).toEqual([]);
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

  it("rejects a missing/undefined communityFeesAnnual (MODEL_SPEC.md §15: mandatory, no default)", () => {
    const bad = {
      ...referenceCase,
      property: { ...referenceCase.property, communityFeesAnnual: undefined as unknown as number },
    };
    expect(validateEngineInput(bad).join(" ")).toContain("communityFeesAnnual");
    expect(() => runEngine(bad)).toThrow(ValidationError);
  });

  it("rejects a negative communityFeesAnnual", () => {
    const bad = {
      ...referenceCase,
      property: { ...referenceCase.property, communityFeesAnnual: -1 },
    };
    expect(validateEngineInput(bad).join(" ")).toContain("communityFeesAnnual");
  });

  it("accepts communityFeesAnnual: 0 (a building with no community fee is a real, valid case)", () => {
    const zero = {
      ...referenceCase,
      property: { ...referenceCase.property, communityFeesAnnual: 0 },
    };
    expect(validateEngineInput(zero)).toEqual([]);
  });

  it("accepts a valid cadastralValue (MODEL_SPEC.md §16, optional)", () => {
    const withCadastral = {
      ...referenceCase,
      property: {
        ...referenceCase.property,
        cadastralValue: { suelo: 120000, construccion: 80000 },
      },
    };
    expect(validateEngineInput(withCadastral)).toEqual([]);
  });

  it("rejects a negative cadastralValue.suelo or .construccion", () => {
    const badSuelo = {
      ...referenceCase,
      property: {
        ...referenceCase.property,
        cadastralValue: { suelo: -1, construccion: 80000 },
      },
    };
    expect(validateEngineInput(badSuelo).join(" ")).toContain("cadastralValue.suelo");

    const badConstruccion = {
      ...referenceCase,
      property: {
        ...referenceCase.property,
        cadastralValue: { suelo: 120000, construccion: -1 },
      },
    };
    expect(validateEngineInput(badConstruccion).join(" ")).toContain(
      "cadastralValue.construccion",
    );
  });

  it("rejects a missing/non-boolean hasTouristRentalLicense (MODEL_SPEC.md §18: mandatory, no default)", () => {
    const bad = {
      ...referenceCase,
      property: {
        ...referenceCase.property,
        hasTouristRentalLicense: undefined as unknown as boolean,
      },
    };
    expect(validateEngineInput(bad).join(" ")).toContain("hasTouristRentalLicense");
    expect(() => runEngine(bad)).toThrow(ValidationError);
  });

  it("rejects rentalStrategy 'shortTerm' or 'hybrid' without a valid título habilitante", () => {
    const noLicense = { ...referenceCase.property, hasTouristRentalLicense: false };

    const shortTerm = {
      ...referenceCase,
      property: noLicense,
      selections: { ...referenceCase.selections, rentalStrategy: "shortTerm" as const },
    };
    expect(validateEngineInput(shortTerm).join(" ")).toContain("título habilitante");
    expect(() => runEngine(shortTerm)).toThrow(ValidationError);

    const hybrid = {
      ...referenceCase,
      property: noLicense,
      selections: { ...referenceCase.selections, rentalStrategy: "hybrid" as const },
    };
    expect(validateEngineInput(hybrid).join(" ")).toContain("título habilitante");
  });

  it("accepts rentalStrategy 'longTerm' regardless of hasTouristRentalLicense", () => {
    const noLicense = {
      ...referenceCase,
      property: { ...referenceCase.property, hasTouristRentalLicense: false },
      selections: { ...referenceCase.selections, rentalStrategy: "longTerm" as const },
    };
    expect(validateEngineInput(noLicense)).toEqual([]);
    expect(() => runEngine(noLicense)).not.toThrow();
  });
});
