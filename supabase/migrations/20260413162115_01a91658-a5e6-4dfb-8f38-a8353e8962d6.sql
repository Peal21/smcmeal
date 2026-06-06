
ALTER TABLE public.app_settings
ADD COLUMN meal_cutoff_hour INTEGER NOT NULL DEFAULT 22,
ADD COLUMN meal_cutoff_minute INTEGER NOT NULL DEFAULT 0;
