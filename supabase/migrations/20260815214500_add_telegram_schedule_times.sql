-- Add telegram_schedule_times column to public.app_settings
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS telegram_schedule_times text[] NOT NULL DEFAULT ARRAY['21:00', '21:30', '21:55'];

-- Create trigger function to sync pg_cron jobs dynamically
CREATE OR REPLACE FUNCTION public.sync_telegram_cron_jobs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  time_val text;
  cron_time text;
  job_name text;
  hour_val integer;
  min_val integer;
  utc_hour integer;
  utc_min integer;
BEGIN
  -- 1. Unschedule all existing cron jobs starting with 'telegram-reminder-'
  FOR job_name IN (SELECT jobname FROM cron.job WHERE jobname LIKE 'telegram-reminder-%') LOOP
    PERFORM cron.unschedule(job_name);
  END LOOP;

  -- Also unschedule old legacy static cron jobs if they exist
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-reminder-9pm') THEN
    PERFORM cron.unschedule('telegram-reminder-9pm');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-reminder-930pm') THEN
    PERFORM cron.unschedule('telegram-reminder-930pm');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telegram-reminder-955pm') THEN
    PERFORM cron.unschedule('telegram-reminder-955pm');
  END IF;

  -- 2. If Telegram bot is disabled or chat ID is empty, do not schedule any new jobs
  IF NOT NEW.telegram_enabled OR NEW.telegram_chat_id IS NULL OR NEW.telegram_chat_id = '' OR NEW.telegram_schedule_times IS NULL THEN
    RETURN NEW;
  END IF;

  -- 3. Schedule new cron jobs based on the times array (input is local BST UTC+6)
  FOREACH time_val IN ARRAY NEW.telegram_schedule_times LOOP
    -- split hour and minute from HH:MM format
    hour_val := split_part(time_val, ':', 1)::integer;
    min_val := split_part(time_val, ':', 2)::integer;

    -- Convert BST (UTC+6) to UTC
    utc_min := min_val;
    utc_hour := hour_val - 6;
    IF utc_hour < 0 THEN
      utc_hour := utc_hour + 24;
    END IF;

    -- Construct cron expression (minute hour * * *)
    cron_time := utc_min::text || ' ' || utc_hour::text || ' * * *';
    job_name := 'telegram-reminder-' || replace(time_val, ':', '');

    PERFORM cron.schedule(
      job_name,
      cron_time,
      $$
      SELECT net.http_post(
        url := 'https://hcbsbgjlkqugwlkilinq.supabase.co/functions/v1/telegram-meal-reminder',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
      );
      $$
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger on app_settings to run sync function
DROP TRIGGER IF EXISTS trigger_sync_telegram_cron_jobs ON public.app_settings;
CREATE TRIGGER trigger_sync_telegram_cron_jobs
  AFTER INSERT OR UPDATE OF telegram_enabled, telegram_chat_id, telegram_schedule_times
  ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_telegram_cron_jobs();

-- Trigger a update to sync current settings to pg_cron
UPDATE public.app_settings
SET telegram_schedule_times = ARRAY['21:00', '21:30', '21:55']
WHERE id = 1;
