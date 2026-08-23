import { describe, expect, it } from "vitest";
import { FREE_TIER_DISCLOSURE_KEYS } from "@/lib/rules/es/free-tier/band";
import { INDICATIVE_SCORE_DISCLOSURE_KEYS } from "@/lib/rules/es/free-tier/indicative-score";
import { ALL_FREE_TIER_DISCLOSURE_KEYS } from "@/lib/rules/es/types";
import {
  FREE_TIER_DISCLOSURE_GROUP,
  FREE_TIER_DISCLOSURE_GROUP_HEADING_NL,
  FREE_TIER_DISCLOSURE_GROUP_ORDER,
  groupFreeTierDisclosures,
} from "../free-tier-disclosure-groups";

/**
 * The grouping is presentation only, so the property that matters is that
 * it loses nothing: every key in the union has a home, and grouping a set
 * of keys returns exactly that set.
 */
describe("free-tier disclosure grouping - nothing falls out", () => {
  it("assigns every key in the union to a group", () => {
    // The Record is already compiler-exhaustive; this is the runtime
    // mirror, so a gap shows up in the suite too.
    expect(Object.keys(FREE_TIER_DISCLOSURE_GROUP).sort()).toEqual(
      [...ALL_FREE_TIER_DISCLOSURE_KEYS].sort(),
    );
  });

  it("assigns every key to a group that is actually rendered", () => {
    for (const group of Object.values(FREE_TIER_DISCLOSURE_GROUP)) {
      expect(FREE_TIER_DISCLOSURE_GROUP_ORDER).toContain(group);
    }
  });

  it("has a Dutch heading for every group in the order", () => {
    for (const group of FREE_TIER_DISCLOSURE_GROUP_ORDER) {
      expect(FREE_TIER_DISCLOSURE_GROUP_HEADING_NL[group].length).toBeGreaterThan(0);
    }
  });

  it("returns exactly the keys it was given - no drops, no duplicates", () => {
    const keys = [
      ...FREE_TIER_DISCLOSURE_KEYS.filter((k) => k !== "band"),
      ...INDICATIVE_SCORE_DISCLOSURE_KEYS,
    ];
    const grouped = groupFreeTierDisclosures(keys).flatMap((g) => g.keys);
    expect(grouped.sort()).toEqual([...keys].sort());
  });

  it("handles the whole union at once, whatever a future result carries", () => {
    const grouped = groupFreeTierDisclosures(ALL_FREE_TIER_DISCLOSURE_KEYS).flatMap((g) => g.keys);
    expect(grouped.sort()).toEqual([...ALL_FREE_TIER_DISCLOSURE_KEYS].sort());
  });

  it("drops empty groups rather than rendering a bare heading", () => {
    const grouped = groupFreeTierDisclosures(["indicativeScoreScope"]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]!.group).toBe("scope");
  });

  it("returns nothing at all for an empty key list", () => {
    expect(groupFreeTierDisclosures([])).toEqual([]);
  });

  it("keeps the groups in their declared order, whatever order the keys arrive in", () => {
    const grouped = groupFreeTierDisclosures([
      "indicativeScoreScope",
      "financing",
      "unverified",
    ]);
    expect(grouped.map((g) => g.group)).toEqual(["figure", "data", "scope"]);
  });
});
