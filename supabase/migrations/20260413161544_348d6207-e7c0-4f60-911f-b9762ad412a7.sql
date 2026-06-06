
-- Special day items created by admin
CREATE TABLE public.special_day_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name TEXT NOT NULL,
  item_date DATE NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.special_day_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view special day items"
ON public.special_day_items FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Managers can insert special day items"
ON public.special_day_items FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

CREATE POLICY "Managers can update special day items"
ON public.special_day_items FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

CREATE POLICY "Managers can delete special day items"
ON public.special_day_items FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

-- Student responses to special day items
CREATE TABLE public.special_day_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.special_day_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  opted_in BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id)
);

ALTER TABLE public.special_day_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own responses"
ON public.special_day_responses FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

CREATE POLICY "Users can insert own responses"
ON public.special_day_responses FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own responses"
ON public.special_day_responses FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own responses"
ON public.special_day_responses FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Managers can view all responses"
ON public.special_day_responses FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'meal_manager'::user_role) OR has_role(auth.uid(), 'super_admin'::user_role));

-- Trigger for updated_at
CREATE TRIGGER update_special_day_responses_updated_at
BEFORE UPDATE ON public.special_day_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.special_day_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.special_day_responses;
