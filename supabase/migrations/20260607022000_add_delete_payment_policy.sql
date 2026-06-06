-- Add delete policy for payments table to allow managers and admins to delete entries.
DROP POLICY IF EXISTS "Managers can delete payments" ON public.payments;

CREATE POLICY "Managers can delete payments" ON public.payments 
FOR DELETE TO authenticated 
USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
