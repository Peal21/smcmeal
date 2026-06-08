-- Unschedule existing auto-carry cron job if it exists (to avoid duplicates)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-carry-meals-nightly') THEN
    PERFORM cron.unschedule('auto-carry-meals-nightly');
  END IF;
END $$;

-- Schedule auto-carry-meals at 12:00 AM Bangladesh Time (18:00 UTC) every night
-- This copies today's meals to tomorrow automatically at midnight
SELECT cron.schedule(
  'auto-carry-meals-nightly',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hcbsbgjlkqugwlkilinq.supabase.co/functions/v1/auto-carry-meals',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"triggered_by": "cron"}'::jsonb
  );
  $$
);
