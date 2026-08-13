import { describe, expect, it } from "vitest";
import { FIELD_VALIDATION_COPY_NL, translateFieldValidation } from "../../../copy/es/validation";
import {
  checkBuiltAreaM2,
  checkPurchasePrice,
  checkUsableAreaM2,
} from "../field-validation";
import type { FieldValidationKey } from "../field-validation";
import { validateEngineInput } from "../validation";
import { referenceCase } from "./referencecase";

describe("checkBuiltAreaM2", () => {
  it("accepts a positive number", () => {
    expect(checkBuiltAreaM2(133)).toBeNull();
    expect(checkBuiltAreaM2(0.5)).toBeNull();
  });

  it("rejects zero, negatives and non-numbers", () => {
    expect(checkBuiltAreaM2(0)).toBe("builtAreaMustBePositive");
    expect(checkBuiltAreaM2(-1)).toBe("builtAreaMustBePositive");
    expect(checkBuiltAreaM2(Number.NaN)).toBe("builtAreaMustBePositive");
    expect(checkBuiltAreaM2(Number.POSITIVE_INFINITY)).toBe("builtAreaMustBePositive");
    expect(checkBuiltAreaM2(undefined)).toBe("builtAreaMustBePositive");
    expect(checkBuiltAreaM2("133")).toBe("builtAreaMustBePositive");
  });
});

describe("checkUsableAreaM2", () => {
  it("accepts an absent usable area - it is optional (MODEL_SPEC.md §17)", () => {
    expect(checkUsableAreaM2(undefined, 133)).toBeNull();
  });

  it("accepts a positive usable area at or below the built area", () => {
    expect(checkUsableAreaM2(113, 133)).toBeNull();
    expect(checkUsableAreaM2(133, 133)).toBeNull();
  });

  it("rejects a non-positive usable area", () => {
    expect(checkUsableAreaM2(0, 133)).toBe("usableAreaMustBePositive");
    expect(checkUsableAreaM2(-5, 133)).toBe("usableAreaMustBePositive");
    expect(checkUsableAreaM2("113", 133)).toBe("usableAreaMustBePositive");
  });

  it("rejects a usable area larger than the built area", () => {
    expect(checkUsableAreaM2(140, 133)).toBe("usableAreaCannotExceedBuiltArea");
  });

  it("reports only the usable area's own problem when the built area is also broken", () => {
    // One field, one message: the comparison is skipped while builtAreaM2
    // is not a usable number, so a broken built area does not produce a
    // second, confusing complaint about the usable one.
    expect(checkUsableAreaM2(140, Number.NaN)).toBeNull();
    expect(checkUsableAreaM2(140, undefined)).toBeNull();
  });
});

describe("checkPurchasePrice", () => {
  it("accepts a positive price", () => {
    expect(checkPurchasePrice(330_000)).toBeNull();
  });

  it("rejects zero, negatives and non-numbers", () => {
    expect(checkPurchasePrice(0)).toBe("purchasePriceMustBePositive");
    expect(checkPurchasePrice(-1)).toBe("purchasePriceMustBePositive");
    expect(checkPurchasePrice(undefined)).toBe("purchasePriceMustBePositive");
  });
});

describe("validateEngineInput delegates to the same rules - one definition, not two", () => {
  it("still reports the reference case as valid", () => {
    expect(validateEngineInput(referenceCase)).toEqual([]);
  });

  it("reports the built-area rule with the same English string as before the refactor", () => {
    const issues = validateEngineInput({
      ...referenceCase,
      property: { ...referenceCase.property, builtAreaM2: 0 },
    });
    expect(issues).toContain("builtAreaM2 must be a positive number");
  });

  it("reports the usable-area ceiling with the same English string as before the refactor", () => {
    const issues = validateEngineInput({
      ...referenceCase,
      property: { ...referenceCase.property, usableAreaM2: 200, builtAreaM2: 133 },
    });
    expect(issues).toContain("usableAreaM2 cannot exceed builtAreaM2");
  });

  it("agrees field-by-field with the standalone checks", () => {
    const property = { ...referenceCase.property, purchasePrice: -1, builtAreaM2: 0 };
    const issues = validateEngineInput({ ...referenceCase, property });
    expect(checkBuiltAreaM2(property.builtAreaM2)).not.toBeNull();
    expect(checkPurchasePrice(property.purchasePrice)).not.toBeNull();
    expect(issues).toContain("builtAreaM2 must be a positive number");
    expect(issues).toContain("purchasePrice must be a positive number");
  });
});

describe("Dutch copy covers every field-validation key", () => {
  const allKeys: FieldValidationKey[] = [
    "required",
    "mustBeANumber",
    "builtAreaMustBePositive",
    "usableAreaMustBePositive",
    "usableAreaCannotExceedBuiltArea",
    "purchasePriceMustBePositive",
  ];

  it("has exactly one Record entry per key", () => {
    expect(Object.keys(FIELD_VALIDATION_COPY_NL).sort()).toEqual([...allKeys].sort());
  });

  it("translates every key to non-empty Dutch", () => {
    for (const key of allKeys) {
      expect(translateFieldValidation(key).length).toBeGreaterThan(0);
    }
  });

  it("throws rather than silently returning empty text for an unknown key", () => {
    expect(() => translateFieldValidation("nonexistent" as unknown as never)).toThrow(
      /Missing Dutch copy for field validation key/,
    );
  });
});
