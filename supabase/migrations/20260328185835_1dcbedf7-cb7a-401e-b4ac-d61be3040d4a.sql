CREATE TABLE public.carry_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_date date NOT NULL,
  target_date date NOT NULL,
  total_active_users integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  updated_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  triggered_by text NOT NULL DEFAULT 'cron',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.carry_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view carry logs" ON public.carry_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

CREATE POLICY "Service can insert carry logs" ON public.carry_logs
  FOR INSERT WITH CHECK (true);