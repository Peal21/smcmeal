-- Create meal_off_periods table
CREATE TABLE IF NOT EXISTS public.meal_off_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT start_before_end CHECK (start_date <= end_date)
);

-- Enable RLS
ALTER TABLE public.meal_off_periods ENABLE ROW LEVEL SECURITY;

-- Enable SELECT for owner
CREATE POLICY "Users can view own meal off periods" ON public.meal_off_periods
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Enable INSERT for owner
CREATE POLICY "Users can insert own meal off periods" ON public.meal_off_periods
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Enable DELETE for owner
CREATE POLICY "Users can delete own meal off periods" ON public.meal_off_periods
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Enable managers/admins to view and manage all off periods
CREATE POLICY "Managers and Admins can manage all meal off periods" ON public.meal_off_periods
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'meal_manager'::public.user_role) OR 
    public.has_role(auth.uid(), 'super_admin'::public.user_role)
  );
