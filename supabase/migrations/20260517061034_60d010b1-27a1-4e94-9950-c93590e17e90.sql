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