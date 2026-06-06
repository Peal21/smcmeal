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