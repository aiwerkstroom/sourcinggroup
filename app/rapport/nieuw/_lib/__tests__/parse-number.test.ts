import { describe, expect, it } from "vitest";
import { parseNumberInput } from "../parse-number";

describe("parseNumberInput - Dutch number conventions", () => {
  it("reads a plain integer", () => {
    expect(parseNumberInput("350000")).toEqual({ state: "ok", value: 350_000 });
  });

  it("reads dots as thousands separators when they group in threes", () => {
    expect(parseNumberInput("350.000")).toEqual({ state: "ok", value: 350_000 });
    expect(parseNumberInput("1.234.567")).toEqual({ state: "ok", value: 1_234_567 });
  });

  it("reads a comma as the decimal separator", () => {
    expect(parseNumberInput("85,5")).toEqual({ state: "ok", value: 85.5 });
    expect(parseNumberInput("1.234,56")).toEqual({ state: "ok", value: 1_234.56 });
  });

  it("keeps a dot as a decimal point when it does not group in threes", () => {
    // Someone typing an area without reaching for the comma key.
    expect(parseNumberInput("12.5")).toEqual({ state: "ok", value: 12.5 });
    expect(parseNumberInput("1.23")).toEqual({ state: "ok", value: 1.23 });
  });

  it("ignores surrounding and internal whitespace", () => {
    expect(parseNumberInput("  350 000 ")).toEqual({ state: "ok", value: 350_000 });
  });

  it("handles negatives, which the field rules then reject on their own", () => {
    expect(parseNumberInput("-5")).toEqual({ state: "ok", value: -5 });
  });
});

describe("parseNumberInput - empty and invalid are different answers", () => {
  it("reports an untouched field as empty, not invalid", () => {
    expect(parseNumberInput("")).toEqual({ state: "empty" });
    expect(parseNumberInput("   ")).toEqual({ state: "empty" });
  });

  it("reports unparseable text as invalid", () => {
    expect(parseNumberInput("abc")).toEqual({ state: "invalid" });
    expect(parseNumberInput("1.2.3")).toEqual({ state: "invalid" });
    expect(parseNumberInput("€ 350.000")).toEqual({ state: "invalid" });
  });

  it("does not silently read a lone separator as zero", () => {
    // Number(".") and Number(",") would be NaN, but Number("") is 0 -
    // guarding this explicitly because a mid-typing "," must not become 0.
    expect(parseNumberInput(",")).toEqual({ state: "invalid" });
    expect(parseNumberInput(".")).toEqual({ state: "invalid" });
  });
});
