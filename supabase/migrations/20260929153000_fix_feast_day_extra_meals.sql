-- Fix existing extra_meals on Feast Days and add auto-fill trigger

-- 1. Update existing extra_meals on configured feast dates
UPDATE public.extra_meals e
SET 
  is_feast_day = (COALESCE(f.meal_count_equivalent, 3) > 1),
  meal_count_equivalent = COALESCE(f.meal_count_equivalent, 3)
FROM public.feast_day_config f
WHERE e.meal_date = f.feast_date 
  AND (f.meal_type = 'both' OR f.meal_type = e.meal_type);

-- 2. Update existing extra_meals on default feast days (Monday = 1, Friday = 5)
UPDATE public.extra_meals e
SET 
  is_feast_day = true,
  meal_count_equivalent = 3
WHERE EXTRACT(DOW FROM e.meal_date) IN (1, 5)
  AND (e.meal_count_equivalent = 1 OR e.is_feast_day = false)
  AND NOT EXISTS (
    SELECT 1 FROM public.feast_day_config f 
    WHERE f.feast_date = e.meal_date 
      AND (f.meal_type = 'both' OR f.meal_type = e.meal_type)
  );

-- 3. Trigger to ensure future extra_meals always get correct is_feast_day and meal_count_equivalent
CREATE OR REPLACE FUNCTION public.set_extra_meal_feast_defaults()
RETURNS TRIGGER AS $$
DECLARE
  v_mce numeric;
BEGIN
  -- Look for custom feast config first
  SELECT meal_count_equivalent INTO v_mce
  FROM public.feast_day_config
  WHERE feast_date = NEW.meal_date
    AND (meal_type = 'both' OR meal_type = NEW.meal_type)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_mce IS NOT NULL THEN
    NEW.is_feast_day := (v_mce > 1);
    NEW.meal_count_equivalent := v_mce;
  ELSIF EXTRACT(DOW FROM NEW.meal_date) IN (1, 5) THEN
    -- Monday (1) or Friday (5) are standard feast days in SMC
    NEW.is_feast_day := true;
    NEW.meal_count_equivalent := 3;
  ELSE
    IF NEW.meal_count_equivalent IS NULL OR NEW.meal_count_equivalent <= 0 THEN
      NEW.meal_count_equivalent := 1;
      NEW.is_feast_day := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_extra_meal_feast_defaults ON public.extra_meals;
CREATE TRIGGER trg_set_extra_meal_feast_defaults
BEFORE INSERT OR UPDATE OF meal_date, meal_type, quantity
ON public.extra_meals
FOR EACH ROW
EXECUTE FUNCTION public.set_extra_meal_feast_defaults();
