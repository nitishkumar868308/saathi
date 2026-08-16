-- pg_cron: har 30 min naye errors ka email digest bhejo (saathi8683@gmail.com).
--
-- Prereq:
--   1. supabase/error-logs.sql chal chuka ho
--   2. Web deployed ho, env me CRON_SECRET + SMTP_* set ho
--   3. <CRON_SECRET> neeche apni asli value se badlo
--
-- NOTE: "schema \"cron\" does not exist" error aata tha kyunki pg_cron extension
-- enable nahi thi. Neeche wali do lines wahi enable kar deti hain (dobara chalana
-- safe). Agar SQL se enable na ho to Dashboard > Database > Extensions se pg_cron
-- aur pg_net toggle on karo, phir yeh file chalao.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'error-digest-30min',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://apkasaathi.com/api/cron/error-digest',
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
