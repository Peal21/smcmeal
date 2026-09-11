-- Migration: 20260911223000_ensure_auto_carry_cron.sql
-- Description: Ensures auto-carry-meals-nightly cron is scheduled and keeps it synced with app_settings

-- 1. Unschedule existing auto-carry cron job if it exists (to avoid duplicates)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-carry-meals-nightly') THEN
    PERFORM cron.unschedule('auto-carry-meals-nightly');
  END IF;
END $$;

-- 2. Schedule auto-carry-meals at 12:00 AM Bangladesh Time (18:00 UTC) every night
SELECT cron.schedule(
  'auto-carry-meals-nightly',
  '0 18 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://hcbsbgjlkqugwlkilinq.supabase.co/functions/v1/auto-carry-meals',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"triggered_by": "cron"}'::jsonb
  );
  $cron$
);

-- 3. Update sync_telegram_cron_jobs to guarantee auto-carry-meals-nightly remains scheduled
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

  -- 2. Ensure auto-carry-meals-nightly is ALWAYS scheduled at 18:00 UTC (12:00 AM BST)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-carry-meals-nightly') THEN
    PERFORM cron.unschedule('auto-carry-meals-nightly');
  END IF;

  PERFORM cron.schedule(
    'auto-carry-meals-nightly',
    '0 18 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://hcbsbgjlkqugwlkilinq.supabase.co/functions/v1/auto-carry-meals',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{"triggered_by": "cron"}'::jsonb
    );
    $cron$
  );

  -- 3. If Telegram bot is disabled or chat ID is empty, do not schedule any telegram reminder jobs
  IF NOT NEW.telegram_enabled OR NEW.telegram_chat_id IS NULL OR NEW.telegram_chat_id = '' OR NEW.telegram_schedule_times IS NULL THEN
    RETURN NEW;
  END IF;

  -- 4. Schedule new cron jobs based on the times array (input is local BST UTC+6)
  FOREACH time_val IN ARRAY NEW.telegram_schedule_times LOOP
    hour_val := split_part(time_val, ':', 1)::integer;
    min_val := split_part(time_val, ':', 2)::integer;

    -- Convert BST (UTC+6) to UTC
    utc_min := min_val;
    utc_hour := hour_val - 6;
    IF utc_hour < 0 THEN
      utc_hour := utc_hour + 24;
    END IF;

    cron_time := utc_min::text || ' ' || utc_hour::text || ' * * *';
    job_name := 'telegram-reminder-' || replace(time_val, ':', '');

    PERFORM cron.schedule(
      job_name,
      cron_time,
      $cron$
      SELECT net.http_post(
        url := 'https://hcbsbgjlkqugwlkilinq.supabase.co/functions/v1/telegram-meal-reminder',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
      );
      $cron$
    );
  END LOOP;

  RETURN NEW;
END;
$$;
