CREATE OR REPLACE FUNCTION public.clean_extra_options(raw text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  items text[];
  cleaned text[];
  item text;
  has_egg_fish boolean := false;
  has_egg_chicken boolean := false;
BEGIN
  IF raw IS NULL OR raw = '' THEN RETURN raw; END IF;
  items := string_to_array(raw, ',');
  cleaned := ARRAY[]::text[];
  FOREACH item IN ARRAY items LOOP
    item := trim(item);
    IF item = '' THEN CONTINUE; END IF;
    IF item = ANY(cleaned) THEN CONTINUE; END IF;
    IF item IN ('egg_fish_fry', 'egg_fish_poach') THEN
      IF NOT has_egg_fish THEN
        cleaned := array_append(cleaned, item);
        has_egg_fish := true;
      END IF;
      CONTINUE;
    END IF;
    IF item IN ('egg_chicken_fry', 'egg_chicken_poach') THEN
      IF NOT has_egg_chicken THEN
        cleaned := array_append(cleaned, item);
        has_egg_chicken := true;
      END IF;
      CONTINUE;
    END IF;
    cleaned := array_append(cleaned, item);
  END LOOP;
  IF array_length(cleaned, 1) IS NULL THEN RETURN NULL; END IF;
  RETURN array_to_string(cleaned, ',');
END;
$$;

UPDATE public.daily_meals
SET lunch_extra_option = public.clean_extra_options(lunch_extra_option)
WHERE lunch_extra_option IS NOT NULL AND lunch_extra_option != '';

UPDATE public.daily_meals
SET dinner_extra_option = public.clean_extra_options(dinner_extra_option)
WHERE dinner_extra_option IS NOT NULL AND dinner_extra_option != '';

DROP FUNCTION public.clean_extra_options(text);