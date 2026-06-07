-- Unschedule existing cron jobs to avoid duplicates
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-reminder-9pm') THEN
    PERFORM cron.unschedule('telegram-reminder-9pm');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-reminder-930pm') THEN
    PERFORM cron.unschedule('telegram-reminder-930pm');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-reminder-955pm') THEN
    PERFORM cron.unschedule('telegram-reminder-955pm');
  END IF;
END $$;

-- Schedule Telegram reminder at 9:00 PM Bangladesh Time (15:00 UTC) with correct URL
SELECT cron.schedule(
  'telegram-reminder-9pm',
  '0 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hcbsbgjlkqugwlkilinq.supabase.co/functions/v1/telegram-meal-reminder',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Schedule Telegram reminder at 9:30 PM Bangladesh Time (15:30 UTC) with correct URL
SELECT cron.schedule(
  'telegram-reminder-930pm',
  '30 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hcbsbgjlkqugwlkilinq.supabase.co/functions/v1/telegram-meal-reminder',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Schedule Telegram reminder at 9:55 PM Bangladesh Time (15:55 UTC) with correct URL
SELECT cron.schedule(
  'telegram-reminder-955pm',
  '55 15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hcbsbgjlkqugwlkilinq.supabase.co/functions/v1/telegram-meal-reminder',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
