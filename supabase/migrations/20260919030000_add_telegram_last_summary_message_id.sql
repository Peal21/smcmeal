ALTER TABLE public.app_settings 
ADD COLUMN IF NOT EXISTS telegram_last_summary_message_id text;
