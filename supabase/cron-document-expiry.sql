-- pg_cron: document expiry ki khabar (email + WhatsApp) — item 18.
--
-- Ye purani `cron-document-whatsapp.sql` ki JAGAH leta hai. Farq:
--   * Ladder ab 7 / 1 / 0 din hai (pehle 14 / 3 / 0) — app ke saath milta hua.
--   * Email BHI jaata hai, sirf WhatsApp nahi.
--   * Khabar apne waqt par jaati hai — pehle WhatsApp jaan-boojh ke 1 ghanta
--     der se jaata tha.
--
-- Prereq:
--   1. Extensions: pg_cron + pg_net enabled.
--   2. Web deployed, env me CRON_SECRET set (wahi neeche daalo).
--   3. supabase/document-notify.sql AUR supabase/document-renewal.sql chalaya ho.
--   4. Twilio env set — na ho to route chalega par WhatsApp skip karega.
--   5. SMTP env set — na ho to email skip hoga.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ⚠️ Pehle PURANA job band karo. Dono ek saath chalte rahe to WhatsApp do baar
-- jaayega (dono alag log table use karte hain, isliye dedupe kaam nahi karega).
-- Job pehle se na ho to ye line error deti hai — usse ignore kar dena.
select cron.unschedule('document-whatsapp-hourly');

-- Har 15 minute. Notification-moment 9:00 IST hai, isliye khabar 9:00-9:15 ke
-- beech nikal jaati hai. Ghante wale cron me 1 ghante tak ki der ho sakti thi.
select cron.schedule(
  'document-expiry-every-15-min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://www.apkasaathi.com/api/cron/document-expiry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Band karna ho to:
--   select cron.unschedule('document-expiry-every-15-min');
-- Job list dekhne ke liye:
--   select * from cron.job;
