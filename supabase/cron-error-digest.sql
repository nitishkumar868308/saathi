-- pg_cron: har 30 min naye errors ka email digest bhejo (saathi8683@gmail.com).
--
-- Prereq:
--   1. Extensions: pg_cron + pg_net enabled
--   2. supabase/error-logs.sql chal chuka ho
--   3. Web deployed ho, env me CRON_SECRET + SMTP_* set ho
--   4. <CRON_SECRET> neeche apni asli value se badlo

select cron.schedule(
  'error-digest-30min',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://www.apkasaathi.com/api/cron/error-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Band karna ho to:
--   select cron.unschedule('error-digest-30min');
