-- ═══════════════════════════════════════════════════════════════════════
--  URL TEST — "secret dono jagah sahi hai, phir bhi 401 kyun?"
-- ═══════════════════════════════════════════════════════════════════════
--
-- Supabase > SQL Editor me POORI file Run karo. ~15 second lagta hai (beech me
-- jaan-boojh ke intezaar hai — neeche wajah likhi hai). Aakhir me ek chhoti si
-- table aati hai: kaunsa domain 200 deta hai aur kaunsa 401.
--
-- ── Ye kyun bana ──────────────────────────────────────────────────────
--
-- ⚠️ Ek soorat aisi hai jo bilkul "galat secret" jaisi dikhti hai par uska
-- secret se koi lena-dena hi nahi hota, aur wahi sabse zyada waqt khaati hai:
--
--     www.apkasaathi.com  --308-->  apkasaathi.com   (ya ulta)
--
-- pg_net us redirect ko FOLLOW karta hai, par wo curl par chalta hai — aur curl
-- doosre HOST par jaate waqt `Authorization` header JAAN-BOOJH KE gira deta hai.
-- Ye surakhsha ka niyam hai: aapka token us server ko nahi jaana chahiye jise
-- aapne bheja hi nahi tha.
--
-- Nateeja bilkul dhokha dene wala hota hai:
--   • Route CHALTA hai (401 uska apna JSON jawab hai, koi proxy ka nahi)
--   • Vercel ka secret bilkul sahi hai
--   • Job ka secret bilkul sahi hai (dono ka md5 ek)
--   • Aur phir bhi 401 — kyunki header raaste me hi gir gaya
--
-- Isliye yahan dono shakl seedha aazma li jaati hain. Jo 200 de, wahi `v_base`
-- me daalna hai (`supabase/cron-setup.sql`).
--
-- ⚠️ Secret dobara paste nahi karna — wo MAUJOODA job se hi uthaya jaata hai.
-- Ye ek jaan-boojh ke liya gaya faisla hai: agar hum yahan haath se secret
-- maangte, to ye test us galti ko pakadta hi nahi jo galat paste se aati hai
-- (test kuch aur bhejta, job kuch aur). Wahi value bhejna zaroori hai jo job
-- sach me bhejti hai.

/* Do request ki id yahan rakhi jaati hain — `net._http_response` me URL nahi
   hota, sirf id hoti hai. Bina iske ye bataya hi nahi ja sakta ki kaunsa jawab
   kis domain ka tha (aur beech me har minute wala cron bhi chal raha hota hai). */
create table if not exists public.cron_url_test (
  label     text primary key,
  req_id    bigint not null,
  fired_at  timestamptz not null default now()
);
-- Andaruni jaanch — app ko iski koi zaroorat nahi.
alter table public.cron_url_test enable row level security;

/* Dono shakl par ek-ek call — wahi secret jo asli job bhejti hai. */
insert into public.cron_url_test (label, req_id)
select
  d.label,
  net.http_post(
    url := d.base || '/api/cron/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || j.secret
    ),
    body := '{}'::jsonb
  )
from (
  select substring(command from 'Bearer ([^"]+)') as secret
  from cron.job
  where jobname = 'send-reminders-every-minute'
  limit 1
) j
cross join (values
  ('www  https://www.apkasaathi.com', 'https://www.apkasaathi.com'),
  ('apex https://apkasaathi.com',     'https://apkasaathi.com')
) as d(label, base)
on conflict (label) do update
  set req_id = excluded.req_id, fired_at = now();

/* ⚠️ Intezaar zaroori hai. pg_net call ko KATAAR me daalta hai aur ek alag
   background worker use bhejta hai — `net.http_post` turant laut aata hai, us
   waqt jawab hota hi nahi. Bina ruke neeche wali select hamesha khaali
   `status_code` dikhati, aur ye poora test bekaar lagta. */
select pg_sleep(12);

/* Nateeja. */
select
  t.label,
  r.status_code,
  case
    when r.status_code = 200 then 'YEHI SAHI HAI -> cron-setup.sql me v_base me ye daalo'
    when r.status_code = 401 then 'header pahuncha par secret match nahi hua'
    when r.status_code between 300 and 399 then 'redirect -> Authorization yahin girta hai, doosri shakl use karo'
    when r.status_code is null then 'jawab abhi nahi aaya — 10 second baad sirf ye aakhri select dobara chalao'
    else 'ye status dekho'
  end as matlab,
  coalesce(nullif(left(r.error_msg, 200), ''), left(r.content, 200)) as jawab
from public.cron_url_test t
left join net._http_response r on r.id = t.req_id
order by t.label;
