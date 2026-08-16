-- ═══════════════════════════════════════════════════════════════════════
--  CRON DOCTOR — "reminder/expiry ka email aur WhatsApp kyun nahi ja raha?"
-- ═══════════════════════════════════════════════════════════════════════
--
-- Supabase > SQL Editor me POORI file Run karo. Ye kuch BADALTA NAHI — sirf
-- padhta hai. Neeche 6 jawab ek-ek karke aate hain; jo pehla LAAL nikle, wahi
-- asli wajah hai (uske baad wale usi ki wajah se toote dikhenge).
--
-- ── Ye file kyun bani ──────────────────────────────────────────────────
--
-- Admin panel batata hai ki cron chal raha hai ya nahi (`lib/delivery-health.ts`
-- — beet chuke par na chhue gaye reminder ginta hai, jo ek pakka saboot hai).
-- Par wo ye nahi bata paata ki cron KYUN nahi chal raha, kyunki uska jawab
-- Vercel me hai hi nahi — poora ka poora Supabase ke andar hai:
--
--   1. Extension (pg_cron / pg_net) hai bhi ya nahi
--   2. Job list me kuch hai ya nahi
--   3. Job ke command me `<CRON_SECRET>` placeholder to nahi pada
--   4. Job chala to, par fail hua (cron.job_run_details)
--   5. Call gayi to, par jawab 401/404/500 aaya (net._http_response)
--   6. Job ka URL sach me hamara domain hai ya nahi
--
-- In chaaron me se kisi ek ke toot-ne par nateeja BILKUL ek jaisa dikhta hai:
-- "kuch nahi aaya". Isliye har ek ka apna jawab yahan alag se nikalta hai.

/* ------------------------------------------------------------------ */
/*  1. Extension hain ya nahi                                          */
/* ------------------------------------------------------------------ */
--
-- pg_net na ho to cron chalega par HTTP call ja hi nahi sakti — aur ye sabse
-- chupa hua fail hai, kyunki job list bilkul theek dikhti hai.
select
  '1. EXTENSIONS' as step,
  coalesce(bool_or(extname = 'pg_cron'), false) as pg_cron_hai,
  coalesce(bool_or(extname = 'pg_net'), false) as pg_net_hai,
  case
    when not coalesce(bool_or(extname = 'pg_cron'), false)
      then 'pg_cron nahi hai -> supabase/cron-setup.sql chalao'
    when not coalesce(bool_or(extname = 'pg_net'), false)
      then 'pg_net nahi hai -> HTTP call ja hi nahi sakti. supabase/cron-setup.sql chalao'
    else 'theek hai'
  end as kya_karo
from pg_extension
where extname in ('pg_cron', 'pg_net');

/* ------------------------------------------------------------------ */
/*  2. Job list — hai bhi ya nahi, aur chalu hai ya band               */
/* ------------------------------------------------------------------ */
--
-- ⚠️ `active = false` wali job list me DIKHTI hai par kabhi chalti nahi. Ye
-- soorat aankh se pakadna bahut mushkil hai: sab kuch maujood lagta hai.
select
  '2. JOBS' as step,
  jobname,
  schedule,
  active as chalu_hai,
  case
    when not active then 'BAND hai -> select cron.alter_job((select jobid from cron.job where jobname = ''' || jobname || '''), active := true);'
    when command like '%<CRON_SECRET>%' then 'LAAL: command me abhi bhi <CRON_SECRET> placeholder pada hai -> har call 401 hogi'
    when command not like '%apkasaathi.com%' then 'URL hamara domain nahi hai -> command dekho'
    else 'theek dikhta hai'
  end as kya_karo
from cron.job
order by jobname;

-- Ek bhi row na aaye to iska matlab: koi job hai hi nahi.
-- Ilaaj: supabase/cron-setup.sql chalao.

/* ------------------------------------------------------------------ */
/*  3. `<CRON_SECRET>` placeholder — sabse aam wajah                   */
/* ------------------------------------------------------------------ */
--
-- ⚠️ Purani setup files (`cron-reminders.sql` waghairah) me secret ek
-- PLACEHOLDER hai jise haath se badalna padta hai. Bina badle chalane par job
-- ban to jaati hai aur roz chalti bhi hai — par har call 401 hoti hai aur ek
-- bhi message kabhi nahi jaata. Kahin koi error bhi nahi dikhta, kyunki us 401
-- ko dekhne wala koi hai hi nahi.
--
-- `cron-setup.sql` me ye galti ho hi nahi sakti (secret ek hi jagah, upar).
select
  '3. PLACEHOLDER' as step,
  count(*) filter (where command like '%<CRON_SECRET>%') as galat_jobs,
  case
    when count(*) filter (where command like '%<CRON_SECRET>%') > 0
      then 'LAAL: yahi wajah hai. supabase/cron-setup.sql me apna asli CRON_SECRET daal ke chalao'
    else 'theek hai'
  end as kya_karo
from cron.job;

/* ------------------------------------------------------------------ */
/*  4. Job chali ya nahi — aur chali to kya hua                        */
/* ------------------------------------------------------------------ */
--
-- Ye Postgres ka apna record hai. `status = 'failed'` ka matlab hai ki SQL hi
-- nahi chal paaya (aksar: pg_net nahi hai, ya permission nahi hai).
--
-- ⚠️ `status = 'succeeded'` ka matlab SIRF itna hai ki `net.http_post()` line
-- chal gayi — wo call KAMYAB hui ya nahi, wo agla sawaal (step 5) hai. Ye farq
-- bahut logon ko yahin bhataka deta hai.
select
  '4. RUNS' as step,
  j.jobname,
  d.status,
  d.start_time,
  left(coalesce(d.return_message, ''), 200) as sandesh
from cron.job_run_details d
join cron.job j on j.jobid = d.jobid
order by d.start_time desc
limit 20;

-- Ek bhi row na aaye = job kabhi chali hi nahi (ya `active = false` hai).

/* ------------------------------------------------------------------ */
/*  5. HTTP call ka asli jawab — 401 / 404 / 500 yahan dikhta hai      */
/* ------------------------------------------------------------------ */
--
-- ⚠️ YAHI wo table hai jo "sab kuch theek dikhta hai par kuch jaata nahi" ka
-- jawab deta hai, aur ise koi dekhta hi nahi kyunki iska naam andaruni (`net._`)
-- hai.
--
--   401 -> CRON_SECRET match nahi kar raha (job me purana, Vercel me naya —
--          ya placeholder). Vercel ke env wali value aur job ki value ek honi
--          chahiye.
--   404 -> URL galat hai (route ka naam badal gaya, ya www/non-www).
--   5xx -> route khud fail ho raha hai — Vercel ke logs dekho.
--   khaali/timeout -> pg_net ka worker atka hua hai; project restart se theek
--          ho jaata hai (Settings > General > Restart project).
select
  '5. HTTP' as step,
  r.status_code,
  r.created,
  left(coalesce(r.error_msg, ''), 200) as galti,
  left(coalesce(r.content, ''), 300) as jawab
from net._http_response r
order by r.created desc
limit 20;

/* ------------------------------------------------------------------ */
/*  6. Aakhri sach — kitne reminder atke pade hain                     */
/* ------------------------------------------------------------------ */
--
-- ⚠️ Ye ginti env, plan, Twilio ya SMTP — kisi se nahi badalti, aur yahi use
-- bharosemand banata hai. Cron HAR due reminder par `advance_reminder()`
-- chalata hai, chahe user free ho ya Plus, chahe koi message jaye ya na jaye.
-- Isliye jo reminder beet chuka hai par `notified_at` abhi bhi khaali hai —
-- uska ek hi matlab hai: cron us row tak pahuncha hi nahi.
--
-- (Admin panel ka verdict bilkul isi hisaab par banta hai — `lib/delivery-health.ts`.)
select
  '6. ATKE REMINDER' as step,
  count(*) as kitne,
  min(remind_at) as sabse_purana,
  case
    when count(*) = 0 then 'theek hai — cron chal raha hai'
    else 'LAAL: cron in tak pahuncha hi nahi. Upar step 1-5 me se pehla LAAL dekho'
  end as kya_karo
from reminders
where is_on = true
  and is_paused = false
  and notified_at is null
  and remind_at <= now() - interval '5 minutes';
