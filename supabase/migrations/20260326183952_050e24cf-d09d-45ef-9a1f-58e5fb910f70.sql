CREATE POLICY "Managers can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));