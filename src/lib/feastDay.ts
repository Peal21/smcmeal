import { getDay } from 'date-fns';

export interface FeastDayConfig {
  id?: string;
  feast_date: string;
  meal_type?: string;
  meal_count_equivalent?: number;
  note?: string | null;
}

/**
 * Checks if a given date string (YYYY-MM-DD) or Date object is a default Feast Day (Monday = 1 or Friday = 5).
 * Always parses string dates with 'T00:00:00' to prevent UTC/local timezone shifts.
 */
export function isDefaultFeastDay(date: Date | string): boolean {
  if (!date) return false;
  const d = typeof date === 'string'
    ? new Date(date.includes('T') ? date : `${date}T00:00:00`)
    : date;
  const day = getDay(d);
  return day === 1 || day === 5;
}

/**
 * Returns the effective meal count equivalent for an extra meal record.
 * If meal_count_equivalent > 1, returns it.
 * Otherwise, if is_feast_day is true OR the date is Monday/Friday, returns 3.
 * Defaults to 1 for normal regular days.
 */
export function getExtraMealEquivalent(extra: {
  meal_date?: string | Date;
  is_feast_day?: boolean | null;
  meal_count_equivalent?: number | string | null;
}): number {
  const explicitEquiv = Number(extra.meal_count_equivalent);
  if (explicitEquiv > 1) {
    return explicitEquiv;
  }
  const isFeast = extra.is_feast_day || (extra.meal_date ? isDefaultFeastDay(extra.meal_date) : false);
  return isFeast ? 3 : 1;
}

/**
 * Calculates total extra meals from an array of extra meal rows.
 */
export function calculateExtraMealsTotal(extraMeals: Array<{
  quantity?: number | string | null;
  meal_date?: string | Date;
  is_feast_day?: boolean | null;
  meal_count_equivalent?: number | string | null;
}>): number {
  return extraMeals.reduce((sum, e) => {
    const qty = Number(e.quantity) || 0;
    const equiv = getExtraMealEquivalent(e);
    return sum + qty * equiv;
  }, 0);
}
