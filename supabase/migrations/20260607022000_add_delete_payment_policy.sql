-- Add delete policy for payments table to allow managers and admins to delete entries.
CREATE POLICY "Managers can delete payments" ON public.payments 
FOR DELETE TO authenticated 
USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
