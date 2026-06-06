
UPDATE public.daily_meals
SET lunch_extra_option = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(lunch_extra_option,
        'egg_instead_of_fish', 'egg_fish_fry'),
      'egg_instead_of_chicken', 'egg_chicken_fry'),
    '(^|,)egg_fry($|,)', '\1egg_fish_fry\2'),
  '(^|,)egg_poach($|,)', '\1egg_fish_poach\2')
WHERE lunch_extra_option IS NOT NULL
  AND (lunch_extra_option LIKE '%egg_instead_of_fish%'
    OR lunch_extra_option LIKE '%egg_instead_of_chicken%'
    OR lunch_extra_option LIKE '%egg_fry%'
    OR lunch_extra_option LIKE '%egg_poach%');

UPDATE public.daily_meals
SET dinner_extra_option = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(dinner_extra_option,
        'egg_instead_of_fish', 'egg_fish_fry'),
      'egg_instead_of_chicken', 'egg_chicken_fry'),
    '(^|,)egg_fry($|,)', '\1egg_fish_fry\2'),
  '(^|,)egg_poach($|,)', '\1egg_fish_poach\2')
WHERE dinner_extra_option IS NOT NULL
  AND (dinner_extra_option LIKE '%egg_instead_of_fish%'
    OR dinner_extra_option LIKE '%egg_instead_of_chicken%'
    OR dinner_extra_option LIKE '%egg_fry%'
    OR dinner_extra_option LIKE '%egg_poach%')
