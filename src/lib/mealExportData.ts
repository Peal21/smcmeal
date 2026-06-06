export const EXTRA_LABEL_MAP: Record<string, string> = {
  beef: 'গরু',
  mutton: 'খাসি',
  chicken: 'গরু/খাসির পরিবর্তে মুরগি',
  egg_fish_fry: 'ডিম ভাজি (মাছ)',
  egg_fish_poach: 'ডিম পোচ (মাছ)',
  egg_chicken_fry: 'ডিম ভাজি (পোল্ট্রি)',
  egg_chicken_poach: 'ডিম পোচ (পোল্ট্রি)',
  egg_instead_of_fish: 'ডিম (মাছ)',
  egg_instead_of_chicken: 'ডিম (পোল্ট্রি)',
  egg_fry: 'ডিম ভাজি',
  egg_poach: 'ডিম পোচ',
};

export const YEAR_ORDER = ['5th', '4th', '3rd', '2nd', '1st', 'extra'] as const;

export const YEAR_LABELS: Record<string, string> = {
  '1st': '1st Year',
  '2nd': '2nd Year',
  '3rd': '3rd Year',
  '4th': '4th Year',
  '5th': '5th Year',
  extra: 'Extra',
};

const EXTRA_SUMMARY_ORDER = [
  'beef',
  'mutton',
  'chicken',
  'egg_fish_fry',
  'egg_fish_poach',
  'egg_chicken_fry',
  'egg_chicken_poach',
  'egg_instead_of_fish',
  'egg_instead_of_chicken',
  'egg_fry',
  'egg_poach',
] as const;

export interface Profile {
  user_id: string;
  full_name: string;
  year: string;
  roll_number: string | null;
}

export interface Meal {
  user_id: string;
  lunch: boolean;
  dinner: boolean;
  lunch_extra_option: string | null;
  meal_date?: string;
}

export interface ExtraMeal {
  user_id: string;
  meal_type: string;
  quantity: number;
  meal_count_equivalent: number;
  is_feast_day: boolean;
  extra_option?: string | null;
}

export interface ExportMemberRow {
  name: string;
  lunch: string;
  dinner: string;
  extraText: string;
}

export interface ExportBatch {
  year: string;
  members: ExportMemberRow[];
}

export function buildMealExportData(
  profiles: Profile[],
  meals: Meal[],
  filterYears: string[],
  extraMeals?: ExtraMeal[],
  isFeastDay?: boolean,
  userSpecialMap?: Map<string, string[]>,
) {
  const mealMap = new Map(meals.map((meal) => [meal.user_id, meal]));
  const extraMap = new Map<string, { extraLunch: number; extraDinner: number }>();
  const extraOptionMap = new Map<string, string[]>();

  if (extraMeals) {
    for (const extraMeal of extraMeals) {
      const current = extraMap.get(extraMeal.user_id) || { extraLunch: 0, extraDinner: 0 };
      if (extraMeal.meal_type === 'lunch') current.extraLunch += extraMeal.quantity;
      else current.extraDinner += extraMeal.quantity;
      extraMap.set(extraMeal.user_id, current);

      // Collect extra_option keys from extra meals
      if (extraMeal.extra_option) {
        const opts = extraMeal.extra_option.split(',').map(v => v.trim()).filter(Boolean);
        const existing = extraOptionMap.get(extraMeal.user_id) || [];
        existing.push(...opts);
        extraOptionMap.set(extraMeal.user_id, existing);
      }
    }
  }

  const extraCounts: Record<string, number> = {};
  Object.keys(EXTRA_LABEL_MAP).forEach((key) => {
    extraCounts[key] = 0;
  });

  const batches: ExportBatch[] = [];
  let totalLunch = 0;
  let totalDinner = 0;

  for (const year of YEAR_ORDER) {
    if (!filterYears.includes(year)) continue;
    const yearProfiles = profiles.filter((profile) => profile.year === year);
    if (!yearProfiles.length) continue;

    const members = yearProfiles.map((profile) => {
      const meal = mealMap.get(profile.user_id);
      const extra = extraMap.get(profile.user_id);
      const lunchCount = (meal?.lunch ? 1 : 0) + (extra?.extraLunch || 0);
      const dinnerCount = (meal?.dinner ? 1 : 0) + (extra?.extraDinner || 0);

      totalLunch += lunchCount;
      totalDinner += dinnerCount;

      const rawExtraKeys = (meal?.lunch_extra_option || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      // Merge extra_option from extra_meals
      const extraMealKeys = extraOptionMap.get(profile.user_id) || [];
      const allRawKeys = [...rawExtraKeys, ...extraMealKeys];

      const displayExtraKeys = isFeastDay
        ? allRawKeys
        : allRawKeys.filter((key) => key !== 'chicken');

      displayExtraKeys.forEach((key) => {
        if (extraCounts[key] !== undefined) extraCounts[key] += 1;
      });

      // Count occurrences of each extra key
      const keyCounts = new Map<string, number>();
      for (const key of displayExtraKeys) {
        keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
      }

      const specialItems = userSpecialMap?.get(profile.user_id) || [];
      const countedLabels = Array.from(keyCounts.entries()).map(([key, count]) => {
        const label = EXTRA_LABEL_MAP[key] || key;
        return count > 1 ? `${count}${label}` : `1${label}`;
      });
      const allExtraLabels = [...countedLabels, ...specialItems];

      return {
        name: profile.full_name,
        lunch: lunchCount > 1 ? `${lunchCount}L` : lunchCount === 1 ? 'L' : '',
        dinner: dinnerCount > 1 ? `${dinnerCount}D` : dinnerCount === 1 ? 'D' : '',
        extraText: allExtraLabels.join(' '),
      } satisfies ExportMemberRow;
    });

    batches.push({ year, members });
  }

  const maxRows = batches.length ? Math.max(...batches.map((batch) => batch.members.length)) : 0;

  const extraSummary = EXTRA_SUMMARY_ORDER.filter((key) => extraCounts[key] > 0).map((key) => ({
    key,
    label: EXTRA_LABEL_MAP[key],
    value: extraCounts[key],
  }));

  return {
    batches,
    extraSummary,
    totalLunch,
    totalDinner,
    maxRows,
  };
}
