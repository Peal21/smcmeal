
-- Add extra_charge column to meal_months
ALTER TABLE public.meal_months ADD COLUMN IF NOT EXISTS extra_charge numeric NOT NULL DEFAULT 0;

-- Create app_settings table for signup toggle etc.
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  signup_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read app_settings (needed for auth page)
CREATE POLICY "Anyone can view app settings" ON public.app_settings FOR SELECT TO public USING (true);

-- Only managers can update
CREATE POLICY "Managers can update app settings" ON public.app_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

CREATE POLICY "Managers can insert app settings" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

-- Insert default row
INSERT INTO public.app_settings (id, signup_enabled) VALUES (1, true) ON CONFLICT (id) DO NOTHING;
