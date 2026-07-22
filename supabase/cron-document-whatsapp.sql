-- pg_cron: har ghante document expiry ka WhatsApp follow-up route call karo (#8).
--
-- Prereq (cron-reminders.sql jaisa hi):
--   1. Extensions: pg_cron + pg_net enabled.
--   2. Web deployed, env me CRON_SECRET set (wahi neeche daalo).
--   3. Twilio env set (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM)
--      — na ho to route chalega par WhatsApp skip karega.
--   4. supabase/document-notify.sql run kiya ho.

select cron.schedule(
  'document-whatsapp-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://www.apkasaathi.com/api/cron/document-whatsapp',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Band karna ho to:
--   select cron.unschedule('document-whatsapp-hourly');
