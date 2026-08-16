-- ═══════════════════════════════════════════════════════════════════════
--  CRON DOCTOR — "reminder/expiry ka email aur WhatsApp kyun nahi ja raha?"
-- ═══════════════════════════════════════════════════════════════════════
--
-- Supabase > SQL Editor me POORI file Run karo. Ye kuch BADALTA NAHI — sirf
-- padhta hai. Ek hi table me saare jawab aate hain; `kya_karo` column me jahan
-- pehla **LAAL** dikhe, wahi asli wajah hai (uske baad wale usi ki wajah se
-- toote dikhenge).
--
-- ⚠️ Ye poori file EK query hai, aur ye jaan-boojh ke hai.
--
-- Pehle ismein 6 alag `select` the, aur wo bekaar tha: Supabase ka SQL Editor
-- sirf AAKHRI statement ka result dikhata hai. Yaani pehle paanch jawab —
-- extension, job, placeholder, run history, HTTP status — chal to jaate the par
-- kisi ko dikhte hi nahi the. Sirf chhata dikhta tha ("11 reminder atke hain"),
-- jo bas SAWAAL dohraata hai; jawab upar wale paanch me hota hai.
--
-- ── Ye file kyun bani ──────────────────────────────────────────────────
--
-- Admin panel batata hai ki cron chal raha hai ya nahi (`lib/delivery-health.ts`),
-- par ye nahi bata paata ki KYUN nahi chal raha — uska jawab Vercel me hai hi
-- nahi, poora ka poora Supabase ke andar hai. Aur in chha me se koi bhi toota ho
-- to nateeja bilkul ek jaisa dikhta hai: "kuch nahi aaya".

with

/* 1. Extension — pg_net na ho to HTTP call ja hi nahi sakti (aur job list
      bilkul theek dikhti hai; yahi sabse chupa hua fail hai). */
step1 as (
  select
    1 as n,
    '1. EXTENSIONS' as step,
    coalesce(
      (select string_agg(extname, ' + ' order by extname)
         from pg_extension where extname in ('pg_cron', 'pg_net')),
      'koi nahi'
    ) as kya_mila,
    null::text as kab,
    case
      when (select count(*) from pg_extension where extname in ('pg_cron','pg_net')) = 2
        then 'theek hai'
      else 'LAAL: pg_cron ya pg_net nahi hai -> supabase/cron-setup.sql chalao'
    end as kya_karo
),

/* 2. Job list. `active = false` wali job list me DIKHTI hai par kabhi chalti
      nahi — ye aankh se pakadna bahut mushkil hai, sab maujood lagta hai. */
step2 as (
  select
    2 as n,
    '2. JOB: ' || jobname as step,
    schedule || (case when active then '  (chalu)' else '  (BAND)' end) as kya_mila,
    null::text as kab,
    case
      when not active
        then 'LAAL: job BAND hai -> select cron.alter_job((select jobid from cron.job where jobname = ''' || jobname || '''), active := true);'
      when command like '%<CRON_SECRET>%'
        then 'LAAL: command me abhi bhi <CRON_SECRET> placeholder pada hai -> har call 401 hogi'
      /**
       * ⚠️ URL wali jaanch SIRF un jobs par jo web ko call karti hain.
       *
       * Sab cron job HTTP nahi karti. `downgrade-expired-plans`
       * (`cron-plan-expiry.sql`) poori tarah DB ke andar chalti hai — koi URL,
       * koi secret, kuch nahi. Pehle ye shart har job par lagti thi, isliye wo
       * bilkul theek chalti hui job LAAL dikhti thi aur dhyan asli wajah se hat
       * jaata tha. Ek jhootha alarm poori doctor file ka bharosa kha jaata hai.
       */
      when command like '%net.http_post%' and command not like '%apkasaathi.com%'
        then 'LAAL: URL hamara domain nahi hai -> command dekho'
      when command not like '%net.http_post%'
        then 'theek hai (ye SQL wali job hai — na URL, na secret)'
      else 'theek hai'
    end as kya_karo
  from cron.job
),

/* Job hai hi nahi — tab step2 khaali rehta hai aur uski chuppi bhi ek jawab
   hai. Ise saaf likh dena zaroori hai, warna table me bas ek line kam dikhti
   hai aur wo kisi ko nazar nahi aati. */
step2b as (
  select 2 as n, '2. JOB' as step, 'koi job nahi mili' as kya_mila,
         null::text as kab,
         'LAAL: ek bhi cron job maujood nahi -> supabase/cron-setup.sql chalao' as kya_karo
  where not exists (select 1 from cron.job)
),

/* 3. Placeholder — sabse aam wajah. Purani setup files me secret ek PLACEHOLDER
      hai jise haath se badalna padta tha; bina badle job ban jaati hai, roz
      chalti hai, aur har call chup-chaap 401 hoti hai. */
step3 as (
  select
    3 as n,
    '3. PLACEHOLDER' as step,
    (select count(*) filter (where command like '%<CRON_SECRET>%') from cron.job)::text
      || ' job me placeholder' as kya_mila,
    null::text as kab,
    case
      when (select count(*) filter (where command like '%<CRON_SECRET>%') from cron.job) > 0
        then 'LAAL: yahi wajah hai -> supabase/cron-setup.sql me apna asli CRON_SECRET daal ke chalao'
      else 'theek hai'
    end as kya_karo
),

/* 4. Job sach me chali ya nahi.
      ⚠️ `succeeded` ka matlab SIRF itna hai ki `net.http_post()` line chal gayi.
      Wo CALL kaamyab hui ya nahi, wo agla sawaal hai (step 5). Yahi farq bahut
      logon ko bhataka deta hai. */
step4 as (
  select
    4 as n,
    '4. RUN: ' || j.jobname as step,
    d.status || coalesce('  ' || left(d.return_message, 120), '') as kya_mila,
    to_char(d.start_time, 'DD Mon HH24:MI') as kab,
    case
      when d.status = 'succeeded' then 'chali thi — ab step 5 (HTTP) dekho'
      else 'LAAL: job chal hi nahi paayi -> upar wala sandesh padho'
    end as kya_karo
  from cron.job_run_details d
  join cron.job j on j.jobid = d.jobid
  order by d.start_time desc
  limit 6
),

step4b as (
  select 4 as n, '4. RUN' as step, 'ek bhi run nahi mila' as kya_mila,
         null::text as kab,
         'LAAL: job kabhi chali hi nahi (naya setup ho to 1 minute ruk ke dobara chalao)' as kya_karo
  where not exists (select 1 from cron.job_run_details)
),

/* 5. HTTP call ka ASLI jawab.
      ⚠️ Yahi wo jagah hai jo "sab kuch theek dikhta hai par kuch jaata nahi" ka
      jawab deti hai, aur ise koi dekhta hi nahi kyunki table ka naam andaruni
      (`net._`) hai. */
step5 as (
  select
    5 as n,
    '5. HTTP ' || coalesce(r.status_code::text, 'jawab hi nahi') as step,
    -- ⚠️ 400 akshar, 120 nahi. 401 ka jawab ab apni wajah SAATH le kar aata hai
    -- (`expected` + `got` ka len/md5 — dekho `web/lib/cron-auth.ts`), aur wo
    -- 120 me kat jaata tha — yaani jo ek cheez sabse zyada chahiye thi, wahi
    -- nahi dikhti thi.
    coalesce(nullif(left(r.error_msg, 400), ''), left(r.content, 400), '') as kya_mila,
    to_char(r.created, 'DD Mon HH24:MI') as kab,
    case
      when r.status_code = 200 then 'theek hai — call pahunch gayi'
      when r.status_code = 401 then 'LAAL: secret match nahi kar raha -> jawab me expected/got ka len+md5 hai; use step 7 se milao'
      when r.status_code = 404 then 'LAAL: URL galat hai (www / route ka naam dekho)'
      when r.status_code >= 500 then 'LAAL: route khud fail ho raha hai -> Vercel > Logs dekho'
      when r.status_code is null then 'LAAL: pg_net ka jawab hi nahi aaya -> Settings > General > Restart project'
      else 'ye status dekho'
    end as kya_karo
  from net._http_response r
  order by r.created desc
  limit 6
),

step5b as (
  select 5 as n, '5. HTTP' as step, 'ek bhi call ka jawab nahi mila' as kya_mila,
         null::text as kab,
         'LAAL: HTTP call gayi hi nahi -> pg_net dekho (step 1), ya job abhi-abhi bani hai to 1 min ruko' as kya_karo
  where not exists (select 1 from net._http_response)
),

/* 6. Aakhri sach — kitne reminder atke pade hain.
      ⚠️ Ye ginti env, plan, Twilio ya SMTP — kisi se nahi badalti, aur yahi use
      bharosemand banata hai. Cron HAR due reminder par `advance_reminder()`
      chalata hai, chahe user free ho ya Plus. Isliye beeta hua par `notified_at`
      khaali reminder ka ek hi matlab hai: cron us row tak pahuncha hi nahi. */
step6 as (
  select
    6 as n,
    '6. ATKE REMINDER' as step,
    count(*)::text || ' atke hain' as kya_mila,
    to_char(min(remind_at), 'DD Mon HH24:MI') as kab,
    case
      when count(*) = 0 then 'theek hai — cron chal raha hai'
      else 'cron in tak pahuncha nahi tha. Setup abhi-abhi kiya ho to 1-2 min ruk ke ye file dobara chalao'
    end as kya_karo
  from reminders
  where is_on = true
    and is_paused = false
    and notified_at is null
    and remind_at <= now() - interval '5 minutes'
)

/* 7. Job ke andar pada secret — uska NAAP aur NISHAAN (value kabhi nahi).
      ⚠️ Ye step hi "dono jagah daal to diya, phir 401 kyun" ka aakhri jawab
      deta hai. 401 ka jawab ab server ki taraf ka `expected.md5` aur
      `expected.len` saath bhejta hai (`web/lib/cron-auth.ts`); yahan job ki
      taraf ka wahi naap milta hai. Dono milao:
        md5 ek    -> value ek hai, galti kahin aur hai
        md5 alag  -> do jagah do value padi hai
        len alag  -> paste me space ya newline aa gaya
      Secret khud kahin nahi chhapta — md5 sirf milaan ke liye hai. */
step7 as (
  select
    7 as n,
    '7. JOB SECRET: ' || jobname as step,
    'len ' || length(substring(command from 'Bearer ([^"]+)'))::text
      || '   md5 ' || md5(substring(command from 'Bearer ([^"]+)')) as kya_mila,
    null::text as kab,
    'Ise 401 ke jawab wale expected.len / expected.md5 se milao' as kya_karo
  from cron.job
  where command like '%net.http_post%'
    and substring(command from 'Bearer ([^"]+)') is not null
)

select step, kya_mila, kab, kya_karo from (
  select * from step1
  union all select * from step2
  union all select * from step2b
  union all select * from step3
  union all select * from step4
  union all select * from step4b
  union all select * from step5
  union all select * from step5b
  union all select * from step6
  union all select * from step7
) all_steps
order by n, step;
