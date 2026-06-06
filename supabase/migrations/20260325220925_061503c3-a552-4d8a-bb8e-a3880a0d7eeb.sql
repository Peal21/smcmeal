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