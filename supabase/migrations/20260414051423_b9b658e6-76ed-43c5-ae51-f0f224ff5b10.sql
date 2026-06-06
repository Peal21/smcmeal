
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
