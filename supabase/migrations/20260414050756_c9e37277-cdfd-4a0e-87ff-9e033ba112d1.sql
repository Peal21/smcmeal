
ALTER TABLE public.extra_meals ALTER COLUMN quantity TYPE numeric USING quantity::numeric;
ALTER TABLE public.extra_meals ALTER COLUMN meal_count_equivalent TYPE numeric USING meal_count_equivalent::numeric;
