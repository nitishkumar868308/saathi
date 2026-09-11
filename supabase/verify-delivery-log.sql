-- ============================================================================
-- Jaanch: delivery-log.sql sach me chadhi ya nahi
--
-- Supabase SQL Editor me chalao. Kuch badalta nahi — sirf batata hai.
-- ============================================================================
--
-- ⚠️ Ye file isliye hai ki ek baar aisa ho chuka hai jisme sab theek DIKHTA tha
-- par kuch bana hi nahi tha.
--
-- Supabase ka SQL Editor poori file EK transaction me chalata hai. `delivery-log
-- .sql` ke aakhir me ek line thi — `cron.unschedule('prune-delivery-log')` — jo
-- job na hone par error phenkti hai. Us ek error ne poori file roll back kar di:
-- table nahi bana, ek bhi function nahi bana. Upar ke saare statement "success"
-- dikhe the, isliye maan liya gaya ki chal gayi.
--
-- Galti ka pata bahut baad me chala, jab cron `log_delivery_batch` bulaata raha
-- aur har 15 minute par ek 404 wala error mail aata raha.
--
-- Isliye ab chalane ke baad ye file ek baar chala lo. Andaza lagane se behtar
-- hai ek nazar me dekh lena.

/* ------------------------------------------------------------------ */
/* 1. Table bana ya nahi                                              */
/* ------------------------------------------------------------------ */
select
  case when to_regclass('public.delivery_log') is null
       then '❌ delivery_log table NAHI bana — delivery-log.sql dobara chalao'
       else '✅ delivery_log table hai'
  end as table_check;

/* ------------------------------------------------------------------ */
/* 2. Paanchon function — ek bhi chhoota to cron fail karega          */
/* ------------------------------------------------------------------ */
--
-- `log_delivery_batch` sabse zaroori hai: cron har run me WAHI bulaata hai.
-- Uske bina har 15 minute par "HTTP 404" wala error mail aata rahega.
with chahiye(name) as (
  values
    ('log_delivery'),
    ('log_delivery_batch'),
    ('log_notification'),
    ('admin_delivery_log'),
    ('prune_delivery_log')
)
select
  c.name as function_name,
  case when p.proname is null then '❌ NAHI bana' else '✅ hai' end as status
from chahiye c
left join pg_proc p
       on p.proname = c.name
      and p.pronamespace = 'public'::regnamespace
order by c.name;

/* ------------------------------------------------------------------ */
/* 3. Server ko ijaazat hai ya nahi                                   */
/* ------------------------------------------------------------------ */
--
-- ⚠️ Function ka ban jaana kaafi nahi. `revoke` ke baad service_role ko grant na
-- mile to PostgREST use dikhata hi nahi — call 404 khaati hai, bilkul waise hi
-- jaise function hota hi na ho. Ye farq dhoondhne me sabse zyada waqt jaata hai.
select
  p.proname as function_name,
  case when has_function_privilege('service_role', p.oid, 'EXECUTE')
       then '✅ server chala sakta hai'
       else '❌ ijaazat NAHI — is file ka grant wala hissa chhoot gaya'
  end as service_role
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('log_delivery', 'log_delivery_batch', 'admin_delivery_log',
                    'prune_delivery_log', 'enforce_plan_limits')
order by p.proname;

/* ------------------------------------------------------------------ */
/* 4. Safai wala cron laga ya nahi                                    */
/* ------------------------------------------------------------------ */
--
-- Ye NA hona bhi theek hai — table aur functions iske bina bhi poora kaam karte
-- hain. Bas 90 din se purani rows apne aap nahi hatengi, aur wo kaam kabhi bhi
-- baad me lagaya ja sakta hai.
--
-- ⚠️ `cron.job` ko `to_regclass` se pehle tola jaata hai — seedha padha nahi
-- jaata. pg_cron enable na ho (ya ijaazat na ho) to seedha `select ... from
-- cron.job` KHUD error phenk deta hai, aur ye jaanch-file wahin ruk jaati —
-- yaani jo file bata rahi thi ki kya toota hai, wo khud toot jaati. Ek
-- diagnostic ka fail hona sabse bekaar tarah ka fail hai.
select
  case
    when to_regclass('cron.job') is null
      then 'ℹ️ pg_cron is database me hai hi nahi — safai ka cron nahi lagega. Table aur functions iske bina poora kaam karte hain.'
    when exists (select 1 from cron.job where jobname = 'prune-delivery-log')
      then '✅ roz ki safai lagi hui hai'
    else '⚠️ safai ka cron nahi laga — zaroori nahi, par 90 din baad rows badhti rahengi'
  end as cleanup_cron;

/* ------------------------------------------------------------------ */
/* 5. Ab tak kitna record hua                                         */
/* ------------------------------------------------------------------ */
--
-- Abhi-abhi chalayi hai to `0` bilkul theek hai — agla reminder/expiry jaate hi
-- rows aani shuru ho jaayengi.
select count(*) as ab_tak_rows from public.delivery_log;
