ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash';
CREATE INDEX IF NOT EXISTS idx_payments_method ON public.payments(payment_method);