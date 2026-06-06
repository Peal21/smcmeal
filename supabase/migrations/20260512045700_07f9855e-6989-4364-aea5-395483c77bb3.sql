
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
