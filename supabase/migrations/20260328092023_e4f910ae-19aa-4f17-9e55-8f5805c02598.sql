
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
