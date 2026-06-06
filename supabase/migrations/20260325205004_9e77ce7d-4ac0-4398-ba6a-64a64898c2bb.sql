
-- Enums
CREATE TYPE public.gender_type AS ENUM ('male', 'female');
CREATE TYPE public.year_type AS ENUM ('1st', '2nd', '3rd', '4th', '5th', 'extra');
CREATE TYPE public.user_role AS ENUM ('student', 'meal_manager', 'super_admin');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  roll_number TEXT,
  year year_type NOT NULL DEFAULT '1st',
  gender gender_type NOT NULL DEFAULT 'male',
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  UNIQUE(user_id, role)
);

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Meal months
CREATE TABLE public.meal_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  total_expense NUMERIC(12,2) DEFAULT 0,
  meal_rate NUMERIC(8,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT false,
  manager_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

-- Daily meals
CREATE TABLE public.daily_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  meal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  lunch BOOLEAN NOT NULL DEFAULT false,
  dinner BOOLEAN NOT NULL DEFAULT false,
  lunch_extra_option TEXT,
  dinner_extra_option TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, meal_date)
);

-- Extra meals
CREATE TABLE public.extra_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  meal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('lunch', 'dinner')),
  quantity INTEGER NOT NULL DEFAULT 1,
  reason TEXT,
  is_feast_day BOOLEAN NOT NULL DEFAULT false,
  meal_count_equivalent INTEGER NOT NULL DEFAULT 1,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Payments
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month_id UUID REFERENCES public.meal_months(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  verified_by UUID REFERENCES auth.users(id),
  is_verified BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Member balances
CREATE TABLE public.member_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month_id UUID REFERENCES public.meal_months(id) ON DELETE CASCADE NOT NULL,
  total_meals INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  carry_forward NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, month_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extra_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_balances ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Anyone authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User roles policies
CREATE POLICY "Authenticated can view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));

-- Meal months policies
CREATE POLICY "Anyone authenticated can view meal months" ON public.meal_months FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert meal months" ON public.meal_months FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can update meal months" ON public.meal_months FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));

-- Daily meals policies
CREATE POLICY "Anyone authenticated can view daily meals" ON public.daily_meals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own meals" ON public.daily_meals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meals" ON public.daily_meals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Managers can insert meals" ON public.daily_meals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can update meals" ON public.daily_meals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));

-- Extra meals policies
CREATE POLICY "Anyone authenticated can view extra meals" ON public.extra_meals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add own extra meals" ON public.extra_meals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Managers can insert extra meals" ON public.extra_meals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can update extra meals" ON public.extra_meals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can delete extra meals" ON public.extra_meals FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));

-- Payments policies
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can update payments" ON public.payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));

-- Member balances policies
CREATE POLICY "Users can view own balance" ON public.member_balances FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can manage balances" ON public.member_balances FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Managers can update balances" ON public.member_balances FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'meal_manager') OR public.has_role(auth.uid(), 'super_admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_meal_months_updated_at BEFORE UPDATE ON public.meal_months FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_daily_meals_updated_at BEFORE UPDATE ON public.daily_meals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_member_balances_updated_at BEFORE UPDATE ON public.member_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for daily_meals
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_meals;
