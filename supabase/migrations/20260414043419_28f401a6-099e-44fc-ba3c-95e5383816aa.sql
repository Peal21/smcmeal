
CREATE TABLE public.password_reset_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_password_reset_codes_email ON public.password_reset_codes (email, used, expires_at);
