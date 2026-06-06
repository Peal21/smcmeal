
ALTER TABLE public.daily_meals 
  ADD COLUMN IF NOT EXISTS lunch_off_today_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dinner_off_today_only boolean NOT NULL DEFAULT false;
