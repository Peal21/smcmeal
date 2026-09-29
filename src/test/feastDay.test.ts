import { describe, it, expect } from "vitest";
import { isDefaultFeastDay, getExtraMealEquivalent, calculateExtraMealsTotal } from "../lib/feastDay";

describe("feastDay helpers", () => {
  it("should identify Monday and Friday as default Feast Days", () => {
    // 2026-09-28 is Monday (1)
    expect(isDefaultFeastDay("2026-09-28")).toBe(true);
    // 2026-10-02 is Friday (5)
    expect(isDefaultFeastDay("2026-10-02")).toBe(true);
    // 2026-09-29 is Tuesday (2)
    expect(isDefaultFeastDay("2026-09-29")).toBe(false);
    // 2026-09-30 is Wednesday (3)
    expect(isDefaultFeastDay("2026-09-30")).toBe(false);
    // 2026-10-01 is Thursday (4)
    expect(isDefaultFeastDay("2026-10-01")).toBe(false);
  });

  it("should calculate correct meal count equivalent for extra meals on feast days", () => {
    // Extra meal on Monday with default or missing equivalent
    expect(getExtraMealEquivalent({ meal_date: "2026-09-28", meal_count_equivalent: 1 })).toBe(3);
    expect(getExtraMealEquivalent({ meal_date: "2026-10-02", is_feast_day: true, meal_count_equivalent: 1 })).toBe(3);

    // Extra meal on Tuesday (regular day)
    expect(getExtraMealEquivalent({ meal_date: "2026-09-29", meal_count_equivalent: 1 })).toBe(1);

    // Explicit custom multiplier (e.g. 4)
    expect(getExtraMealEquivalent({ meal_date: "2026-09-28", meal_count_equivalent: 4 })).toBe(4);
  });

  it("should calculate total extra meals sum correctly", () => {
    const extras = [
      { quantity: 1, meal_date: "2026-09-28", meal_count_equivalent: 1 }, // Monday => 1 * 3 = 3
      { quantity: 2, meal_date: "2026-10-02", meal_count_equivalent: 1 }, // Friday => 2 * 3 = 6
      { quantity: 1, meal_date: "2026-09-29", meal_count_equivalent: 1 }, // Tuesday => 1 * 1 = 1
    ];

    expect(calculateExtraMealsTotal(extras)).toBe(10);
  });
});
