import { format } from 'date-fns';

import { supabase } from '@/integrations/supabase/client';

type MealMonthRecord = {
  id: string;
  month: number;
  year: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  meal_rate?: number | null;
  total_expense?: number | null;
  manager_user_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

const toDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

export function pickResolvedMealMonth(mealMonths: MealMonthRecord[], referenceDate = new Date()) {
  if (!mealMonths.length) return null;

  const today = toDateKey(referenceDate);
  const currentMonth = referenceDate.getMonth() + 1;
  const currentYear = referenceDate.getFullYear();

  return (
    mealMonths.find((month) => month.start_date && month.end_date && month.start_date <= today && month.end_date >= today) ||
    mealMonths.find((month) => month.is_active) ||
    mealMonths.find((month) => month.month === currentMonth && month.year === currentYear) ||
    mealMonths[0] ||
    null
  );
}

export async function fetchResolvedMealMonth(referenceDate = new Date()) {
  const { data, error } = await supabase
    .from('meal_months')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return { data: null, error };
  }

  return {
    data: pickResolvedMealMonth((data || []) as MealMonthRecord[], referenceDate),
    error: null,
  };
}

export function getMealMonthDateRange(mealMonth: MealMonthRecord | null | undefined, fallbackDate = new Date()) {
  const baseYear = mealMonth?.year ?? fallbackDate.getFullYear();
  const baseMonthIndex = (mealMonth?.month ?? fallbackDate.getMonth() + 1) - 1;

  return {
    start: mealMonth?.start_date || format(new Date(baseYear, baseMonthIndex, 1), 'yyyy-MM-dd'),
    end: mealMonth?.end_date || format(new Date(baseYear, baseMonthIndex + 1, 0), 'yyyy-MM-dd'),
  };
}

export function getMealMonthLabel(mealMonth: MealMonthRecord | null | undefined, fallbackDate = new Date()) {
  if (!mealMonth) {
    return format(fallbackDate, 'MMMM yyyy');
  }

  if (mealMonth.start_date && mealMonth.end_date) {
    return `${mealMonth.start_date} → ${mealMonth.end_date}`;
  }

  return `${mealMonth.year}-${String(mealMonth.month).padStart(2, '0')}`;
}