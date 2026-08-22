import { describe, expect, it } from "vitest";
import { buildFreeIndicationQuery, parseFreeIndicationQuery } from "../query-params";

/**
 * Golden test for the three fase A stap 1 query keys (servicekosten,
 * onderhoud, huurniveau): the URL is the free indication's only state
 * (this module's own docstring), so a round trip through build -> parse
 * must reproduce exactly what the customer typed, and a hand-edited or
 * stale URL must degrade one field at a time rather than failing the
 * whole indication.
 */

const BASE = { neighborhood: "Ruzafa", purchasePrice: 350_000, builtAreaM2: 90 };

describe("buildFreeIndicationQuery / parseFreeIndicationQuery - the three new fields round-trip", () => {
  it("omits all three keys when none are given - the URL for the unfilled default is unchanged", () => {
    const params = buildFreeIndicationQuery(BASE);
    expect(params.has("servicekosten")).toBe(false);
    expect(params.has("onderhoud")).toBe(false);
    expect(params.has("huurniveau")).toBe(false);
  });

  it("round-trips all three when given", () => {
    const params = buildFreeIndicationQuery({
      ...BASE,
      communityFeesAnnual: 1_200,
      maintenanceCondition: "poor",
      rentLevel: "above",
    });
    const parsed = parseFreeIndicationQuery(Object.fromEntries(params));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.communityFeesAnnual).toBe(1_200);
    expect(parsed.value.maintenanceCondition).toBe("poor");
    expect(parsed.value.rentLevel).toBe("above");
  });

  it("round-trips only the subset given, leaving the rest undefined", () => {
    const params = buildFreeIndicationQuery({ ...BASE, rentLevel: "below" });
    const parsed = parseFreeIndicationQuery(Object.fromEntries(params));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.communityFeesAnnual).toBeUndefined();
    expect(parsed.value.maintenanceCondition).toBeUndefined();
    expect(parsed.value.rentLevel).toBe("below");
  });

  it("drops an unparseable servicekosten rather than failing the whole indication", () => {
    const parsed = parseFreeIndicationQuery({
      wijk: BASE.neighborhood,
      prijs: String(BASE.purchasePrice),
      m2: String(BASE.builtAreaM2),
      servicekosten: "not-a-number",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.communityFeesAnnual).toBeUndefined();
  });

  it("drops a negative servicekosten", () => {
    const parsed = parseFreeIndicationQuery({
      wijk: BASE.neighborhood,
      prijs: String(BASE.purchasePrice),
      m2: String(BASE.builtAreaM2),
      servicekosten: "-100",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.communityFeesAnnual).toBeUndefined();
  });

  it("drops an onderhoud value outside the closed good/average/poor set", () => {
    const parsed = parseFreeIndicationQuery({
      wijk: BASE.neighborhood,
      prijs: String(BASE.purchasePrice),
      m2: String(BASE.builtAreaM2),
      onderhoud: "excellent",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.maintenanceCondition).toBeUndefined();
  });

  it("drops a huurniveau value outside the closed below/average/above set", () => {
    const parsed = parseFreeIndicationQuery({
      wijk: BASE.neighborhood,
      prijs: String(BASE.purchasePrice),
      m2: String(BASE.builtAreaM2),
      huurniveau: "sky-high",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.rentLevel).toBeUndefined();
  });

  it("accepts servicekosten of exactly 0 - a real answer, not a missing one", () => {
    const params = buildFreeIndicationQuery({ ...BASE, communityFeesAnnual: 0 });
    const parsed = parseFreeIndicationQuery(Object.fromEntries(params));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.communityFeesAnnual).toBe(0);
  });
});
