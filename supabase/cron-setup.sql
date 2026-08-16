-- ═══════════════════════════════════════════════════════════════════════
--  CRON SETUP — saare cron jobs, EK jagah se, EK baar me
-- ═══════════════════════════════════════════════════════════════════════
--
-- Neeche `v_secret` me apna asli CRON_SECRET daalo (wahi jo Vercel ke env me
-- hai), aur poori file Supabase > SQL Editor me Run kar do. Bas.
--
-- Dobara chalana bilkul safe hai — har job pehle unschedule hoti hai.
--
-- ── Ye file kyun bani ──────────────────────────────────────────────────
--
-- ⚠️ Purani setup files (`cron-reminders.sql`, `cron-document-expiry.sql`,
-- `cron-error-digest.sql`, `cron-play-prices.sql`) me secret ek PLACEHOLDER
-- (`<CRON_SECRET>`) hai jise CHAAR alag files me haath se badalna padta tha.
-- Aur ye wahi galti hai jo sabse zyada hoti hai, kyunki bina badle bhi sab kuch
-- KAAMYAB dikhta hai: job ban jaati hai, roz chalti hai, `cron.job_run_details`
-- me `succeeded` likha aata hai — aur har call chup-chaap 401 hoti hai. Ek bhi
-- message kabhi nahi jaata, aur kahin koi error nahi dikhta, kyunki us 401 ko
-- dekhne wala koi hai hi nahi.
--
-- Yahan secret EK hi jagah hai, isliye wo galti ho hi nahi sakti. Aur neeche
-- aakhri me ek jaanch bhi hai jo placeholder reh jaane par saaf mana kar deti
-- hai.
--
-- ⚠️ Secret badlo (Vercel me rotate karo) to ye file DOBARA chalani padti hai.
-- Job me secret hardcoded hota hai — Supabase ka Postgres Vercel ke env ko
-- padh nahi sakta. Ye "cron ne 25 July ke baad kaam karna band kar diya" wali
-- soorat ki sabse aam wajah hai.
--
-- Chalane ke baad jaanch: supabase/cron-doctor.sql

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $setup$
declare
  -- ⚠️⚠️⚠️ YAHAN apna asli CRON_SECRET daalo (Vercel > Settings > Environment
  -- Variables me jo hai, HUBAHU wahi — aage-peeche space bhi nahi).
  v_secret text := '<CRON_SECRET>';

  -- Apna domain. www hai ya nahi, ye maayne rakhta hai (galat par 404/308).
  v_base   text := 'https://www.apkasaathi.com';

  v_headers jsonb;
  v_job     record;
begin
  if v_secret = '<CRON_SECRET>' or length(trim(v_secret)) = 0 then
    raise exception
      'CRON_SECRET daalna bhool gaye. File ke upar v_secret me apni asli value daalo, phir dobara Run karo.';
  end if;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_secret
  );

  /* --------------------------------------------------------------- */
  /*  Purani jobs hatao — naam badle hue bhi                          */
  /* --------------------------------------------------------------- */
  --
  -- ⚠️ Ye hissa zaroori hai. Ek hi kaam ki DO jobs saath chal jaayein to
  -- WhatsApp do baar jaata hai (dono ka dedupe alag table par hota hai), aur
  -- purane naam wali job apne purane (aksar galat) secret ke saath chupke se
  -- chalti rehti hai. Isliye naam se nahi, URL se pehchaan ke hataate hain —
  -- naam kabhi bhi badla ja sakta hai, kaam nahi.
  for v_job in
    select jobname from cron.job
    where command like '%/api/cron/%'
       or jobname in (
         'send-reminders-every-minute',
         'document-expiry-every-15-min',
         'document-whatsapp-hourly',
         'error-digest-30min',
         'play-prices-daily'
       )
  loop
    perform cron.unschedule(v_job.jobname);
    raise notice 'purani job hatai: %', v_job.jobname;
  end loop;

  /* --------------------------------------------------------------- */
  /*  1. Reminder — har minute                                        */
  /* --------------------------------------------------------------- */
  --
  -- Har minute isliye ki reminder ka waqt user ne khud chuna hai; 5 minute ki
  -- der bhi "reminder late aaya" hi hai.
  perform cron.schedule(
    'send-reminders-every-minute',
    '* * * * *',
    format(
      $job$select net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_base || '/api/cron/send-reminders',
      v_headers
    )
  );

  /* --------------------------------------------------------------- */
  /*  2. Document expiry — har 15 minute                              */
  /* --------------------------------------------------------------- */
  --
  -- Khabar ka lamha 9:00 IST hai, isliye har 15 minute kaafi hai: khabar
  -- 9:00-9:15 ke beech nikal jaati hai. Route apni taraf se 25 ghante ki khidki
  -- rakhta hai, taaki ek raat ka outage bhi khabar na khaaye.
  perform cron.schedule(
    'document-expiry-every-15-min',
    '*/15 * * * *',
    format(
      $job$select net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_base || '/api/cron/document-expiry',
      v_headers
    )
  );

  /* --------------------------------------------------------------- */
  /*  3. Error digest — har 30 minute                                 */
  /* --------------------------------------------------------------- */
  perform cron.schedule(
    'error-digest-30min',
    '*/30 * * * *',
    format(
      $job$select net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_base || '/api/cron/error-digest',
      v_headers
    )
  );

  /* --------------------------------------------------------------- */
  /*  4. Play Store ke daam — roz raat 22:30 UTC (4:00 IST)           */
  /* --------------------------------------------------------------- */
  perform cron.schedule(
    'play-prices-daily',
    '30 22 * * *',
    format(
      $job$select net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      v_base || '/api/cron/sync-play-prices',
      v_headers
    )
  );

  raise notice 'Ho gaya. Ab supabase/cron-doctor.sql chala ke jaanch lo.';
end
$setup$;

-- ⚠️ Plan-expiry (Plus khatam hote hi downgrade) ki job IS FILE ME NAHI hai —
-- wo poori tarah DB ke andar chalti hai (koi HTTP nahi, isliye koi secret bhi
-- nahi). Uske liye alag se `supabase/cron-plan-expiry.sql` chalao.

/* ------------------------------------------------------------------ */
/*  Jaanch — kya sach me ban gaya                                     */
/* ------------------------------------------------------------------ */
select
  jobname,
  schedule,
  active as chalu_hai,
  -- ⚠️ Secret kabhi mat chhaapo. Sirf itna dekhna hai ki placeholder to nahi
  -- bacha — asli value screen par aana (aur screenshot me chala jaana) usse
  -- rotate karne ki nautan le aata hai.
  (command not like '%<CRON_SECRET>%') as secret_bhara_hai
from cron.job
where command like '%/api/cron/%'
order by jobname;
