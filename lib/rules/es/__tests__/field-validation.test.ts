import { describe, expect, it } from "vitest";
import { FIELD_VALIDATION_COPY_NL, translateFieldValidation } from "../../../copy/es/validation";
import {
  checkBuiltAreaM2,
  checkCadastralConstruccion,
  checkCadastralSuelo,
  checkCommunityFeesAnnual,
  checkHoldingYears,
  checkLtvRange,
  checkMaxLtv,
  checkMinLtv,
  checkMinMonthlyCashflow,
  checkOccupancyLongTerm,
  checkOccupancyShortTerm,
  checkOwnMoney,
  checkPreferredLtv,
  checkPurchasePrice,
  checkTotalBudget,
  checkUpcomingDerramasAmount,
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

describe("checkCommunityFeesAnnual", () => {
  it("accepts zero - a building genuinely without a comunidad", () => {
    expect(checkCommunityFeesAnnual(0)).toBeNull();
    expect(checkCommunityFeesAnnual(900)).toBeNull();
  });

  it("rejects negatives and non-numbers, including absence", () => {
    // MODEL_SPEC.md §15: mandatory, no default anywhere in the engine.
    expect(checkCommunityFeesAnnual(-1)).toBe("communityFeesMustBeZeroOrPositive");
    expect(checkCommunityFeesAnnual(undefined)).toBe("communityFeesMustBeZeroOrPositive");
    expect(checkCommunityFeesAnnual(Number.NaN)).toBe("communityFeesMustBeZeroOrPositive");
  });
});

describe("checkCadastralSuelo / checkCadastralConstruccion", () => {
  it("accept zero and positive values", () => {
    expect(checkCadastralSuelo(0)).toBeNull();
    expect(checkCadastralSuelo(40_000)).toBeNull();
    expect(checkCadastralConstruccion(0)).toBeNull();
    expect(checkCadastralConstruccion(60_000)).toBeNull();
  });

  it("reject negatives and non-numbers", () => {
    expect(checkCadastralSuelo(-1)).toBe("cadastralSueloMustBeZeroOrPositive");
    expect(checkCadastralConstruccion(-1)).toBe("cadastralConstruccionMustBeZeroOrPositive");
    expect(checkCadastralSuelo(undefined)).toBe("cadastralSueloMustBeZeroOrPositive");
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
    "communityFeesMustBeZeroOrPositive",
    "cadastralSueloMustBeZeroOrPositive",
    "cadastralConstruccionMustBeZeroOrPositive",
    "ownMoneyMustBeZeroOrPositive",
    "totalBudgetMustBePositive",
    "maxRenovationBudgetMustBeZeroOrPositive",
    "minLtvMustBeFraction",
    "maxLtvMustBeFraction",
    "preferredLtvMustBeFraction",
    "minLtvCannotExceedMaxLtv",
    "minMonthlyCashflowMustBeANumber",
    "maxMonthlyDebtMustBeZeroOrPositive",
    "holdingYearsMustBePositiveInteger",
    "rentPerM2LongTermMustBePositive",
    "rentPerM2ShortTermMustBePositive",
    "occupancyLongTermMustBeFraction",
    "occupancyShortTermMustBeFraction",
    "upcomingDerramasAmountMustBeZeroOrPositive",
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

describe("investor constraint rules (wizard step 3)", () => {
  it("own money accepts zero but not negative", () => {
    expect(checkOwnMoney(0)).toBeNull();
    expect(checkOwnMoney(115_000)).toBeNull();
    expect(checkOwnMoney(-1)).toBe("ownMoneyMustBeZeroOrPositive");
    expect(checkOwnMoney(undefined)).toBe("ownMoneyMustBeZeroOrPositive");
  });

  it("total budget must be strictly positive", () => {
    expect(checkTotalBudget(450_000)).toBeNull();
    expect(checkTotalBudget(0)).toBe("totalBudgetMustBePositive");
  });

  it("LTV bounds are fractions, inclusive of both ends", () => {
    expect(checkMinLtv(0)).toBeNull();
    expect(checkMinLtv(1)).toBeNull();
    expect(checkMinLtv(0.6)).toBeNull();
    expect(checkMinLtv(1.01)).toBe("minLtvMustBeFraction");
    expect(checkMaxLtv(-0.01)).toBe("maxLtvMustBeFraction");
    // 60 rather than 0.6 is the classic percent/fraction slip; the form
    // divides by 100 before calling this, so reaching here means it didn't.
    expect(checkMaxLtv(60)).toBe("maxLtvMustBeFraction");
  });

  it("preferred LTV is optional but bounded when present", () => {
    expect(checkPreferredLtv(undefined)).toBeNull();
    expect(checkPreferredLtv(0.7)).toBeNull();
    expect(checkPreferredLtv(1.5)).toBe("preferredLtvMustBeFraction");
  });

  it("occupancy (long-term and short-term) is optional but bounded when present - datakwaliteitsfix stap 3", () => {
    expect(checkOccupancyLongTerm(undefined)).toBeNull();
    expect(checkOccupancyLongTerm(0.9)).toBeNull();
    expect(checkOccupancyLongTerm(1.5)).toBe("occupancyLongTermMustBeFraction");
    expect(checkOccupancyLongTerm(-0.1)).toBe("occupancyLongTermMustBeFraction");

    expect(checkOccupancyShortTerm(undefined)).toBeNull();
    expect(checkOccupancyShortTerm(0.6)).toBeNull();
    expect(checkOccupancyShortTerm(1.5)).toBe("occupancyShortTermMustBeFraction");
  });

  it("upcoming derramas amount is optional (even when the checkbox is ticked) but zero-or-positive when present - datakwaliteitsfix stap 4", () => {
    expect(checkUpcomingDerramasAmount(undefined)).toBeNull();
    expect(checkUpcomingDerramasAmount(0)).toBeNull();
    expect(checkUpcomingDerramasAmount(5000)).toBeNull();
    expect(checkUpcomingDerramasAmount(-1)).toBe("upcomingDerramasAmountMustBeZeroOrPositive");
  });

  it("the LTV range must not be inverted", () => {
    expect(checkLtvRange(0.6, 0.75)).toBeNull();
    expect(checkLtvRange(0.75, 0.75)).toBeNull();
    expect(checkLtvRange(0.8, 0.75)).toBe("minLtvCannotExceedMaxLtv");
  });

  it("skips the range comparison while either bound is unusable", () => {
    // One field, one message - the same principle as the usable/built area pair.
    expect(checkLtvRange(Number.NaN, 0.75)).toBeNull();
    expect(checkLtvRange(0.8, undefined)).toBeNull();
  });

  it("minimum monthly cashflow accepts a negative floor", () => {
    // "I accept paying in €200 a month" is a real answer, not an error.
    expect(checkMinMonthlyCashflow(-200)).toBeNull();
    expect(checkMinMonthlyCashflow(500)).toBeNull();
    expect(checkMinMonthlyCashflow(undefined)).toBe("minMonthlyCashflowMustBeANumber");
  });

  it("holding years must be a positive whole number", () => {
    expect(checkHoldingYears(10)).toBeNull();
    expect(checkHoldingYears(1)).toBeNull();
    expect(checkHoldingYears(0)).toBe("holdingYearsMustBePositiveInteger");
    expect(checkHoldingYears(-5)).toBe("holdingYearsMustBePositiveInteger");
    // The projection is built year by year, so half a year has nowhere to go.
    expect(checkHoldingYears(3.5)).toBe("holdingYearsMustBePositiveInteger");
  });
});
