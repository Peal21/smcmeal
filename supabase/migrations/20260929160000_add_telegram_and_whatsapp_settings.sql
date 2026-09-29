-- Add Telegram DM fields to profiles and WhatsApp configuration to app_settings

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_chat_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_username text;

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS whatsapp_webhook_url text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS whatsapp_api_key text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS whatsapp_group_id text;
