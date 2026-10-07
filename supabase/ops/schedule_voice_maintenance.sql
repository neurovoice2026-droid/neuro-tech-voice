-- ══════════════════════════════════════════════════════════════════════════════
-- Optional: run /api/cron/voice-maintenance every 5 minutes from Supabase
-- (pg_cron + pg_net). Use it when the Vercel plan only allows daily crons
-- (Hobby). On Vercel Pro, set the schedule in vercel.json to "*/5 * * * *"
-- instead and skip this file.
--
-- Run in Supabase → SQL Editor after replacing the two placeholders:
--   <CRON_SECRET>  the same value as the CRON_SECRET variable in Vercel
--   <BASE_URL>     the public origin, e.g. https://www.example.com (no redirect)
-- The secret is stored encrypted in Supabase Vault (not in the job text).
-- Check runs:  select * from cron.job_run_details order by start_time desc limit 5;
--              select status_code, error_msg, created from net._http_response order by created desc limit 5;
-- Remove:      select cron.unschedule('ntv-voice-maintenance');
-- Rotate the secret: select vault.update_secret((select id from vault.secrets where name = 'ntv_cron_secret'), '<NEW_SECRET>');
-- ══════════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
create extension if not exists pg_net with schema extensions;

select vault.create_secret('<CRON_SECRET>', 'ntv_cron_secret', 'Bearer for /api/cron/voice-maintenance (same value as CRON_SECRET)')
where not exists (select 1 from vault.secrets where name = 'ntv_cron_secret');

select cron.schedule(
  'ntv-voice-maintenance',
  '*/5 * * * *',
  $job$
  select net.http_get(
    url := '<BASE_URL>/api/cron/voice-maintenance',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ntv_cron_secret'),
      'User-Agent', 'ntv-pg-cron/1'
    ),
    timeout_milliseconds := 290000
  );
  $job$
);
