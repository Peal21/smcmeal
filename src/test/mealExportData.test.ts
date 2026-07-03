import { describe, it, expect } from "vitest";
import { buildMealExportData, type Profile, type Meal } from "../lib/mealExportData";

describe("buildMealExportData", () => {
  it("should split beef and mutton into goruText and khasiText and other items into otherExtraText", () => {
    const profiles: Profile[] = [
      {
        user_id: "user1",
        full_name: "Abir Hasan",
        year: "1st",
        roll_number: "12",
      },
    ];

    const meals: Meal[] = [
      {
        user_id: "user1",
        lunch: true,
        dinner: true,
        lunch_extra_option: "beef,mutton,egg_fry",
      },
    ];

    const result = buildMealExportData(profiles, meals, ["1st"]);
    expect(result.batches.length).toBe(1);
    
    const member = result.batches[0].members[0];
    expect(member.name).toBe("Abir Hasan");
    expect(member.extraItemText).toBe("1গরু 1খাসি");
    expect(member.otherExtraText).toBe("1ডিম ভাজি");
    
    // extraText should still contain all elements so that the PDF is unmodified
    expect(member.extraText).toContain("গরু");
    expect(member.extraText).toContain("খাসি");
    expect(member.extraText).toContain("ডিম ভাজি");
  });
});
