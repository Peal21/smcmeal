-- ===== Migration: 20260325205004_9e77ce7d-4ac0-4398-ba6a-64a64898c2bb.sql =====

-- Enums
CREATE TYPE public.gender_type AS ENUM ('male', 'female');
CREATE TYPE public.year_type AS ENUM ('1st', '2nd', '3rd', '4th', '5th', 'extra');
CREATE TYPE public.user_role AS ENUM ('student', 'meal_manager', 'super_admin');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  roll_number TEXT,
  year year_type NOT NULL DEFAULT '1st',
  gender gender_type NOT NULL DEFAULT 'male',
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  UNIQUE(user_id, role)
);

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Meal months
CREATE TABLE public.meal_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  total_expense NUMERIC(12,2) DEFAULT 0,
  meal_rate NUMERIC(8,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT false,
  manager_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

-- Daily meals
CREATE TABLE public.daily_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  meal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  lunch BOOLEAN NOT NULL DEFAULT false,
  dinner BOOLEAN NOT NULL DEFAULT false,
  lunch_extra_option TEXT,
  dinner_extra_option TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, meal_date)
);

-- Extra meals
CREATE TABLE public.extra_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  meal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('lunch', 'dinner')),
  quantity INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  is_feast_day BOOLEAN NOT NULL DEFAULT false,
  meal_count_equivalent INTEGER NOT NULL DEFAULT 1,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month_id UUID REFERENCES public.meal_months(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  verified_by UUID REFERENCES auth.users(id),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Member balances
CREATE TABLE public.member_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month_id UUID REFERENCES public.meal_months(id) ON DELETE CASCADE NOT NULL,
  total_meals INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  carry_forward NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, month_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_balances ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Anyone authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User roles policies
CREATE POLICY "Authenticated can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));

-- Meal months policies
CREATE POLICY "Anyone authenticated can view meal months" ON public.meal_months FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert meal months" ON public.meal_months FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can update meal months" ON public.meal_months FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));

-- Daily meals policies
CREATE POLICY "Anyone authenticated can view daily meals" ON public.daily_meals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own meals" ON public.daily_meals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meals" ON public.daily_meals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Managers can insert meals" ON public.daily_meals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can update meals" ON public.daily_meals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));

-- Extra meals policies
CREATE POLICY "Anyone authenticated can view extra meals" ON public.extra_meals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add own extra meals" ON public.extra_meals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Managers can insert extra meals" ON public.extra_meals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can update extra meals" ON public.extra_meals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can delete extra meals" ON public.extra_meals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));

-- Payments policies
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can update payments" ON public.payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));

-- Member balances policies
CREATE POLICY "Users can view own balance" ON public.member_balances FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can manage balances" ON public.member_balances FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can update balances" ON public.member_balances FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_meal_months_updated_at BEFORE UPDATE ON public.meal_months FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_daily_meals_updated_at BEFORE UPDATE ON public.daily_meals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_member_balances_updated_at BEFORE UPDATE ON public.member_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for daily_meals
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_meals;


-- ===== Migration: 20260325215002_ce0722d4-b7b8-4348-aa5b-3622f4b4919d.sql =====
-- Dedicated admin portal password (separate from user account password)
CREATE TABLE IF NOT EXISTS public.admin_portal_credentials (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash text NOT NULL,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_portal_credentials ENABLE ROW LEVEL SECURITY;

-- No direct table access; functions below manage reads/writes securely

CREATE OR REPLACE FUNCTION public.set_admin_portal_password(_new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'meal_manager'::public.user_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.user_role)
  ) THEN
    RAISE EXCEPTION 'Only managers/admins can set admin portal password';
  END IF;

  IF _new_password IS NULL OR length(trim(_new_password)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  INSERT INTO public.admin_portal_credentials (id, password_hash, updated_by, updated_at)
  VALUES (1, crypt(_new_password, gen_salt('bf')), auth.uid(), now())
  ON CONFLICT (id)
  DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_admin_portal_password(_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hash text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT password_hash INTO _hash
  FROM public.admin_portal_credentials
  WHERE id = 1;

  IF _hash IS NULL OR _password IS NULL THEN
    RETURN false;
  END IF;

  RETURN _hash = crypt(_password, _hash);
END;
$$;

-- ===== Migration: 20260325215024_1a178614-3bc2-4531-83b4-407f5db84188.sql =====
-- Add explicit restrictive RLS policies for admin_portal_credentials
CREATE POLICY "Managers can view admin portal credential metadata"
ON public.admin_portal_credentials
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'meal_manager'::public.user_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.user_role)
);

CREATE POLICY "Managers can update admin portal credentials"
ON public.admin_portal_credentials
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'meal_manager'::public.user_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.user_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'meal_manager'::public.user_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.user_role)
);

CREATE POLICY "Managers can insert admin portal credentials"
ON public.admin_portal_credentials
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'meal_manager'::public.user_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.user_role)
);

-- ===== Migration: 20260325220925_061503c3-a552-4d8a-bb8e-a3880a0d7eeb.sql =====
CREATE OR REPLACE FUNCTION public.set_admin_portal_password(_new_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'meal_manager'::public.user_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.user_role)
  ) THEN
    RAISE EXCEPTION 'Only managers/admins can set admin portal password';
  END IF;

  IF _new_password IS NULL OR length(trim(_new_password)) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  INSERT INTO public.admin_portal_credentials (id, password_hash, updated_by, updated_at)
  VALUES (1, crypt(_new_password, gen_salt('bf')), auth.uid(), now())
  ON CONFLICT (id)
  DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_admin_portal_password(_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _hash text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT password_hash INTO _hash
  FROM public.admin_portal_credentials
  WHERE id = 1;

  IF _hash IS NULL OR _password IS NULL THEN
    RETURN false;
  END IF;

  RETURN _hash = crypt(_password, _hash);
END;
$$;

-- Re-insert the password with correct search_path
DELETE FROM admin_portal_credentials WHERE id = 1;
INSERT INTO admin_portal_credentials (id, password_hash, updated_at)
SELECT 1, crypt('12345678', gen_salt('bf')), now()
FROM (SELECT 1) x
WHERE EXISTS (SELECT 1 FROM pg_proc JOIN pg_namespace ON pronamespace = pg_namespace.oid WHERE proname='crypt');

-- ===== Migration: 20260326130819_960a327d-4c45-4f83-836a-f464bbb0bd61.sql =====
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

-- ===== Migration: 20260326183952_050e24cf-d09d-45ef-9a1f-58e5fb910f70.sql =====
CREATE POLICY "Managers can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

-- ===== Migration: 20260326210729_4533b2c3-6d5c-4737-a9ad-0718a758ca69.sql =====
ALTER PUBLICATION supabase_realtime ADD TABLE payments;

-- ===== Migration: 20260327082414_35ce7164-4b6d-4dbe-86d4-1f336aba738b.sql =====

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

  INSERT INTO public.profiles (user_id, full_name, year, gender, roll_number)
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
    END,
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'roll_number', '')), '')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');

  RETURN NEW;
END;
$function$;


-- ===== Migration: 20260327145055_27ee489e-7820-4d08-9a2b-447ada483af4.sql =====

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _meta_year text;
  _meta_gender text;
  _user_count int;
BEGIN
  _meta_year := NEW.raw_user_meta_data->>'year';
  _meta_gender := NEW.raw_user_meta_data->>'gender';

  INSERT INTO public.profiles (user_id, full_name, year, gender, roll_number)
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
    END,
    NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'roll_number', '')), '')
  );

  SELECT count(*) INTO _user_count FROM public.profiles;

  IF _user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'meal_manager');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  END IF;

  RETURN NEW;
END;
$function$;


-- ===== Migration: 20260327150002_fd8ebbc3-e778-415a-826b-5ef27a66fc5a.sql =====

DELETE FROM member_balances;
DELETE FROM payments;
DELETE FROM extra_meals;
DELETE FROM daily_meals;
DELETE FROM meal_months;
DELETE FROM user_roles;
DELETE FROM admin_portal_credentials;
DELETE FROM profiles;
DELETE FROM auth.users;


-- ===== Migration: 20260327150403_820d00c6-d343-4fc0-89df-22674d1ceac2.sql =====

INSERT INTO admin_portal_credentials (id, password_hash, updated_at)
VALUES (1, crypt('12345678', gen_salt('bf')), now())
ON CONFLICT (id) DO UPDATE SET password_hash = crypt('12345678', gen_salt('bf')), updated_at = now();


-- ===== Migration: 20260327152629_ee6bf71e-5c5c-4491-ab2a-cb2607594c7d.sql =====
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ===== Migration: 20260327173713_285b27e5-97c7-447c-a810-ec6555e71b1d.sql =====
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ===== Migration: 20260328092023_e4f910ae-19aa-4f17-9e55-8f5805c02598.sql =====

CREATE POLICY "Users can update own extra meals"
ON public.extra_meals
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own extra meals"
ON public.extra_meals
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


-- ===== Migration: 20260328185835_1dcbedf7-cb7a-401e-b4ac-d61be3040d4a.sql =====
CREATE TABLE public.carry_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_date date NOT NULL,
  target_date date NOT NULL,
  total_active_users integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  triggered_by text NOT NULL DEFAULT 'cron',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.carry_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view carry logs" ON public.carry_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

CREATE POLICY "Service can insert carry logs" ON public.carry_logs
  FOR INSERT WITH CHECK (true);

-- ===== Migration: 20260329102756_8bad841f-8038-4497-b37d-c890d9599bf5.sql =====

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
    OR dinner_extra_option LIKE '%egg_poach%');


-- ===== Migration: 20260329103833_453f0295-10a1-4ef2-9a8e-544f8dc211ef.sql =====
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

-- ===== Migration: 20260331184908_bf044ea0-4d5a-4785-9d5c-f0426ddbaed6.sql =====
ALTER TABLE public.meal_months ADD COLUMN start_date date, ADD COLUMN end_date date;

-- ===== Migration: 20260402072326_68ea7763-6318-4e37-a79f-f767c597e128.sql =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_months;

-- ===== Migration: 20260402073218_80087849-7bb5-453c-baaf-03c8d38d12f4.sql =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.extra_meals;

-- ===== Migration: 20260404172601_aa0cd5fd-da07-4375-9179-aac457ff18d8.sql =====

-- Add extra_charge column to meal_months
ALTER TABLE public.meal_months ADD COLUMN IF NOT EXISTS extra_charge numeric NOT NULL DEFAULT 0;

-- Create app_settings table for signup toggle etc.
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  signup_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read app_settings (needed for auth page)
CREATE POLICY "Anyone can view app settings" ON public.app_settings FOR SELECT TO public USING (true);

-- Only managers can update
CREATE POLICY "Managers can update app settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

CREATE POLICY "Managers can insert app settings" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

-- Insert default row
INSERT INTO public.app_settings (id, signup_enabled) VALUES (1, true) ON CONFLICT (id) DO NOTHING;


-- ===== Migration: 20260404193005_45b073de-1742-4bba-9d28-fb2a574af367.sql =====
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- ===== Migration: 20260413161544_348d6207-e7c0-4f60-911f-b9762ad412a7.sql =====

-- Special day items created by admin
CREATE TABLE public.special_day_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  item_date DATE NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.special_day_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view special day items"
ON public.special_day_items FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Managers can insert special day items"
ON public.special_day_items FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

CREATE POLICY "Managers can update special day items"
ON public.special_day_items FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

CREATE POLICY "Managers can delete special day items"
ON public.special_day_items FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

-- Student responses to special day items
CREATE TABLE public.special_day_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.special_day_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  opted_in BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id)
);

ALTER TABLE public.special_day_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own responses"
ON public.special_day_responses FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

CREATE POLICY "Users can insert own responses"
ON public.special_day_responses FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own responses"
ON public.special_day_responses FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own responses"
ON public.special_day_responses FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all responses"
ON public.special_day_responses FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

-- Trigger for updated_at
CREATE TRIGGER update_special_day_responses_updated_at
BEFORE UPDATE ON public.special_day_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.special_day_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.special_day_responses;


-- ===== Migration: 20260413162115_01a91658-a5e6-4dfb-8f38-a8353e8962d6.sql =====

ALTER TABLE public.app_settings
ADD COLUMN meal_cutoff_hour INTEGER NOT NULL DEFAULT 22,
ADD COLUMN meal_cutoff_minute INTEGER NOT NULL DEFAULT 0;


-- ===== Migration: 20260414040752_f67dd334-391e-4ece-a349-ae11150d14d7.sql =====
ALTER TABLE public.extra_meals ADD COLUMN extra_option text;

-- ===== Migration: 20260414043419_28f401a6-099e-44fc-ba3c-95e5383816aa.sql =====

CREATE TABLE public.password_reset_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_password_reset_codes_email ON public.password_reset_codes (email, used, expires_at);


-- ===== Migration: 20260414050756_c9e37277-cdfd-4a0e-87ff-9e033ba112d1.sql =====

ALTER TABLE public.extra_meals ALTER COLUMN quantity TYPE numeric USING quantity::numeric;
ALTER TABLE public.extra_meals ALTER COLUMN meal_count_equivalent TYPE numeric USING meal_count_equivalent::numeric;


-- ===== Migration: 20260414051423_b9b658e6-76ed-43c5-ae51-f0f224ff5b10.sql =====

CREATE TABLE public.feast_day_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feast_date date NOT NULL,
  meal_type text NOT NULL DEFAULT 'both',
  meal_count_equivalent numeric NOT NULL DEFAULT 3,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_feast_day_config_date_type ON public.feast_day_config (feast_date, meal_type);

ALTER TABLE public.feast_day_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view feast config"
ON public.feast_day_config FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Managers can insert feast config"
ON public.feast_day_config FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

CREATE POLICY "Managers can update feast config"
ON public.feast_day_config FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

CREATE POLICY "Managers can delete feast config"
ON public.feast_day_config FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));


-- ===== Migration: 20260424130400_bb3e5bbe-03d1-4a61-802a-e59866a59c6e.sql =====

ALTER TABLE public.daily_meals 
  ADD COLUMN IF NOT EXISTS lunch_off_today_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dinner_off_today_only boolean NOT NULL DEFAULT false;


-- ===== Migration: 20260509194730_88932f5b-0e21-4e9b-9666-f920315ff894.sql =====
ALTER TABLE public.meal_months ADD COLUMN IF NOT EXISTS min_meals numeric NOT NULL DEFAULT 0;

-- ===== Migration: 20260510080937_3a149a32-6306-43b5-b72e-8a6b2f15988e.sql =====
ALTER TABLE public.member_balances ADD COLUMN IF NOT EXISTS meal_count_override numeric;

-- ===== Migration: 20260511183805_87199f9b-fa81-497a-8738-4973db74db0b.sql =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.member_balances;

-- ===== Migration: 20260512045700_07f9855e-6989-4364-aea5-395483c77bb3.sql =====

DROP POLICY IF EXISTS "Service can insert carry logs" ON public.carry_logs;
CREATE POLICY "Admins can insert carry logs"
ON public.carry_logs FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'meal_manager'::public.user_role) OR public.has_role(auth.uid(), 'super_admin'::public.user_role));

DROP POLICY IF EXISTS "Anyone can view app settings" ON public.app_settings;
CREATE POLICY "Authenticated users can view app settings"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.is_signup_enabled()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT signup_enabled FROM public.app_settings WHERE id = 1), true);
$$;
GRANT EXECUTE ON FUNCTION public.is_signup_enabled() TO anon, authenticated;

DROP POLICY IF EXISTS "Authenticated can view roles" ON public.user_roles;
CREATE POLICY "Users view own roles or managers view all"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'meal_manager'::public.user_role)
  OR public.has_role(auth.uid(), 'super_admin'::public.user_role)
);


-- ===== Migration: 20260517061034_60d010b1-27a1-4e94-9950-c93590e17e90.sql =====
-- Master admin credentials table (single row)
CREATE TABLE IF NOT EXISTS public.master_admin_credentials (
  id integer PRIMARY KEY DEFAULT 1,
  login_id text NOT NULL,
  password_hash text NOT NULL,
  bound_user_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT master_admin_single_row CHECK (id = 1)
);

ALTER TABLE public.master_admin_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view master admin meta"
  ON public.master_admin_credentials FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.user_role) OR public.has_role(auth.uid(), 'meal_manager'::public.user_role));

CREATE POLICY "Super admins can update master admin"
  ON public.master_admin_credentials FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.user_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.user_role));

CREATE POLICY "Super admins can insert master admin"
  ON public.master_admin_credentials FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.user_role));

-- Seed default credentials: superadmin / 12345678
INSERT INTO public.master_admin_credentials (id, login_id, password_hash)
VALUES (1, 'superadmin', crypt('12345678', gen_salt('bf')))
ON CONFLICT (id) DO NOTHING;

-- Verify function returns bound_user_id when credentials match, else null
CREATE OR REPLACE FUNCTION public.verify_master_admin(_login_id text, _password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _row public.master_admin_credentials%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.master_admin_credentials WHERE id = 1;
  IF _row.id IS NULL THEN RETURN NULL; END IF;
  IF _row.login_id IS DISTINCT FROM _login_id THEN RETURN NULL; END IF;
  IF _row.password_hash IS DISTINCT FROM crypt(_password, _row.password_hash) THEN RETURN NULL; END IF;
  RETURN _row.bound_user_id;
END;
$$;

-- Allow edge function (service role) to update bound user when null
CREATE OR REPLACE FUNCTION public.bind_master_admin_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.master_admin_credentials
    SET bound_user_id = _user_id, updated_at = now()
    WHERE id = 1 AND bound_user_id IS NULL;
END;
$$;

-- Super admin can change master credentials
CREATE OR REPLACE FUNCTION public.set_master_admin_credentials(_login_id text, _new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.user_role) THEN
    RAISE EXCEPTION 'Only super_admin can change master credentials';
  END IF;
  IF _login_id IS NULL OR length(trim(_login_id)) < 3 THEN RAISE EXCEPTION 'Login ID must be at least 3 chars'; END IF;
  IF _new_password IS NULL OR length(_new_password) < 6 THEN RAISE EXCEPTION 'Password must be at least 6 chars'; END IF;

  UPDATE public.master_admin_credentials
    SET login_id = trim(_login_id),
        password_hash = crypt(_new_password, gen_salt('bf')),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = 1;
END;
$$;

-- ===== Migration: 20260518114837_09a218e5-ffe7-425b-86e0-c124980a8b82.sql =====
ALTER TABLE public.daily_meals REPLICA IDENTITY FULL;
ALTER TABLE public.extra_meals REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;
ALTER TABLE public.member_balances REPLICA IDENTITY FULL;
ALTER TABLE public.meal_months REPLICA IDENTITY FULL;
ALTER TABLE public.special_day_items REPLICA IDENTITY FULL;
ALTER TABLE public.special_day_responses REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.app_settings REPLICA IDENTITY FULL;
ALTER TABLE public.feast_day_config REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feast_day_config;

-- ===== Migration: 20260520173858_63f83899-ae82-451c-b573-53ff7e3ba79b.sql =====
UPDATE public.master_admin_credentials
SET login_id = 'superadmin',
    password_hash = extensions.crypt('12345678', extensions.gen_salt('bf')),
    updated_at = now()
WHERE id = 1;

-- ===== Migration: 20260520173928_bb6aa58b-ffbd-4e70-865a-d3a3e0989c1a.sql =====
UPDATE public.master_admin_credentials
SET bound_user_id = (
  SELECT user_id FROM public.user_roles WHERE role = 'super_admin' ORDER BY id LIMIT 1
),
updated_at = now()
WHERE id = 1 AND bound_user_id IS NULL;

-- ===== Migration: 20260520175710_8617f7b0-81a3-421a-9978-14abd22a19ec.sql =====
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash';
CREATE INDEX IF NOT EXISTS idx_payments_method ON public.payments(payment_method);

-- ===== Migration: 20260521154512_ce43e562-5147-400c-b57e-d3903db7d89d.sql =====
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS telegram_enabled boolean NOT NULL DEFAULT true;

-- ===== Migration: 20260607012500_telegram_reminder_schedule.sql =====
-- Unschedule any existing cron jobs for telegram reminders if they exist in the cron.job table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-reminder-9pm') THEN
    PERFORM cron.unschedule('telegram-reminder-9pm');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-reminder-930pm') THEN
    PERFORM cron.unschedule('telegram-reminder-930pm');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-reminder-955pm') THEN
    PERFORM cron.unschedule('telegram-reminder-955pm');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-meal-reminder') THEN
    PERFORM cron.unschedule('telegram-meal-reminder');
  END IF;
END $$;

-- Schedule Telegram reminder at 9:00 PM Bangladesh Time (15:00 UTC)
SELECT cron.schedule(
  'telegram-reminder-9pm',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hcbsbgjlkqugwlkilinq.supabase.co/functions/v1/telegram-meal-reminder',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Schedule Telegram reminder at 9:30 PM Bangladesh Time (15:30 UTC)
SELECT cron.schedule(
  'telegram-reminder-930pm',
  '30 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hcbsbgjlkqugwlkilinq.supabase.co/functions/v1/telegram-meal-reminder',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Schedule Telegram reminder at 9:55 PM Bangladesh Time (15:55 UTC)
SELECT cron.schedule(
  'telegram-reminder-955pm',
  '55 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hcbsbgjlkqugwlkilinq.supabase.co/functions/v1/telegram-meal-reminder',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);


-- ===== Migration: 20260607022000_add_delete_payment_policy.sql =====
-- Add delete policy for payments table to allow managers and admins to delete entries.
DROP POLICY IF EXISTS "Managers can delete payments" ON public.payments;

CREATE POLICY "Managers can delete payments" ON public.payments 
FOR DELETE TO authenticated 
USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));


