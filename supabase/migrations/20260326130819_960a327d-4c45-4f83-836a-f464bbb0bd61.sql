CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _meta_year text;
  _meta_gender text;
BEGIN
  _meta_year := NEW.raw_user_meta_data->>'year';
  _meta_gender := NEW.raw_user_meta_data->>'gender';

  INSERT INTO public.profiles (user_id, full_name, year, gender)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email),
    CASE
      WHEN _meta_year IN ('1st', '2nd', '3rd', '4th', '5th', 'extra') THEN _meta_year::public.year_type
      ELSE '1st'::public.year_type
    END,
    CASE
      WHEN _meta_gender IN ('male', 'female') THEN _meta_gender::public.gender_type
      ELSE 'male'::public.gender_type
    END
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');

  RETURN NEW;
END;
$function$;