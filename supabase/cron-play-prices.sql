-- pg_cron: Play Console ke price roz `play_prices` me utaro.
--
-- Kaam kya hota hai: web ka /api/cron/sync-play-prices Google Play Developer API
-- se har desh ka daam padhta hai aur `play_prices` table me rakh deta hai.
-- Website aur admin panel wahin se dikhate hain. (App ko iski zaroorat nahi —
-- wo Play se seedha padhti hai.)
--
-- Prereq:
--   1. Extensions: pg_cron + pg_net enabled.
--   2. supabase/play-prices.sql chalaya ho.
--   3. Web ke env me: GOOGLE_PLAY_SA_JSON, GOOGLE_PLAY_PACKAGE_NAME, CRON_SECRET.
--      Poora setup: docs/play-prices.md
--
-- ⚠️ Ye cron sirf BIMA hai. Daam badalne ka asli raasta ye hai: Play Console me
--    badlo → admin panel → "Sync now". Turant live ho jaata hai. Cron sirf us
--    din ke liye hai jab "Sync now" dabana bhool jao.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Roz subah 4 baje IST (22:30 UTC).
--
-- Raat isliye ki Play API ka daily quota din ke asli kaam ke liye bacha rahe,
-- aur is waqt koi admin panel khol ke nahi baitha hota — sync ke beech table
-- aadhi-adhoori dikhne ka koi mauka hi nahi.
select cron.schedule(
  'play-prices-daily',
  '30 22 * * *',
  $$
  select net.http_post(
    url := 'https://apkasaathi.com/api/cron/sync-play-prices',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Band karna ho to:
--   select cron.unschedule('play-prices-daily');
-- Job list dekhne ke liye:
--   select * from cron.job;
