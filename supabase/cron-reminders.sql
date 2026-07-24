-- Supabase pg_cron: har minute reminder sender (web route) ko call karo.
--
-- Prereq:
--   1. Dashboard > Database > Extensions me `pg_cron` AUR `pg_net` enable karo.
--   2. Web (apkasaathi.com) deployed ho, aur uske env me CRON_SECRET set ho
--      (wahi value neeche <CRON_SECRET> me daalo).
--   3. URL apna domain se badlo agar alag ho.
--
-- Run karne se pehle <CRON_SECRET> replace karna mat bhoolna.
--
-- "schema \"cron\" does not exist" aaye to pg_cron enable nahi hai — neeche wali
-- do lines wahi kaam kar deti hain (Dashboard toggle ki bhi zaroorat nahi).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://www.apkasaathi.com/api/cron/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Band karna ho to:
--   select cron.unschedule('send-reminders-every-minute');
-- Job list dekhne ke liye:
--   select * from cron.job;
