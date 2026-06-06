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