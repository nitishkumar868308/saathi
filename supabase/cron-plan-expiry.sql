-- Apka Saathi — Plus khatam hote hi downgrade (documents lock + reminders pause)
-- Supabase SQL Editor me Run karo. Dobara run safe hai.
-- Pehle chala lena: plan-limits.sql
--
-- ⚠️ Ye file kyun bani: downgrade ka koi apna waqt tha hi nahi.
--
-- `enforce_plan_limits()` ab tak SIRF tab chalta tha jab app khud use bulati thi
-- (`enforce_my_limits`, session load par aur data badalne par). Yaani jis din
-- user ka Plus khatam hua, us din agar usne app KHOLI HI NAHI, to DB me kuch
-- badla hi nahi:
--
--   • uske 40 documents `is_locked = false` pade rahe,
--   • uske 20 reminders `is_paused = false` pade rahe — aur reminder cron unhe
--     roz uthata raha (WhatsApp/email to isPlus par ruk jaata hai, par har
--     reminder par ek `advance_reminder` chalta hi raha),
--   • aur jis pal usne app kholi, us pehle frame me use apne saare documents
--     khule hue dikhte the — phir achanak lock ho jaate the.
--
-- Ab downgrade ka apna waqt hai: har ghante, apne aap, bina app khole.
--
-- ⚠️ Ye kisi ka DATA nahi hataata. Sirf ACCESS badalta hai — bilkul wahi kaam
-- jo `enforce_plan_limits` app se chalne par karta hai. Plus wapas milte hi
-- `grant_plus_days` khud sab unlock/unpause kar deta hai.

create extension if not exists pg_cron;

/* ------------------------------------------------------------------ */
/*  1. Jinka Plus abhi-abhi khatam hua — unhe downgrade karo           */
/* ------------------------------------------------------------------ */

/**
 * Har us user par `enforce_plan_limits` chalao jiska `plan = 'plus'` hai par
 * expiry nikal chuki hai.
 *
 * ⚠️ `plan` column ko 'free' NAHI karte, aur ye jaan-boojh ke hai. Wo column
 * itihaas hai ("ye banda kabhi Plus tha") aur membership screen usse padhti
 * hai. "Abhi Plus hai kya" ka jawab hamesha `is_plus_active()` deta hai, jo
 * expiry khud dekhta hai. Column badal dene par renewal ke waqt "wapas aa jao"
 * wali baat kehne laayak kuch bachta hi nahi.
 *
 * Ek limit isliye ki ek hi run me hazaaron user na aa jayein — agli ghante wale
 * run me baaki nikal jaate hain. Har user par ye chalna zaroori bhi ek hi baar
 * hai: `enforce_plan_limits` sirf UNHI rows ko chhoota hai jinka jhanda galat
 * hai (`where is_locked <> ...`), isliye dobara chalna khaali call hai.
 */
create or replace function public.downgrade_expired_plans(p_limit int default 500)
returns int language plpgsql security definer set search_path = public as $$
declare
  u   uuid;
  n   int := 0;
begin
  for u in
    select p.id
      from public.profiles p
     where p.plan = 'plus'
       and p.plan_expires_at is not null
       and p.plan_expires_at <= now()
       /*
        * Jinka kaam pehle se ho chuka hai unhe chhod do — warna ye har ghante
        * har purane Plus user par chalta rahega, hamesha ke liye.
        *
        * "Kaam ho chuka" ka matlab: ab koi aisi row bachi hi nahi jiska jhanda
        * free plan ke hisaab se galat ho.
        */
       and (
         exists (
           select 1 from public.documents d
            where d.user_id = p.id and not d.is_locked
            offset public.cfg_int('free_documents', 3)
         )
         or exists (
           select 1 from public.reminders r
            where r.user_id = p.id and not r.is_paused
            offset public.cfg_int('free_reminders', 5)
         )
       )
     limit p_limit
  loop
    perform public.enforce_plan_limits(u);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Sirf cron / service_role. App ka apna raasta `enforce_my_limits()` hai.
revoke all on function public.downgrade_expired_plans(int) from public, anon, authenticated;

/* ------------------------------------------------------------------ */
/*  2. Har ghante                                                      */
/* ------------------------------------------------------------------ */

/*
 * Har ghante, minute 5 par.
 *
 * Har minute chalane ka koi faayda nahi: plan ki expiry ghanton ke hisaab se
 * hoti hai, minute ke nahi. Aur app khud bhi khulte hi `enforce_my_limits()`
 * chalati hai, isliye jo user sach me app use kar raha hai uska downgrade
 * turant lagta hai — ye cron un logon ke liye hai jo app khole bina hi expire
 * ho gaye.
 */
select cron.unschedule('downgrade-expired-plans')
 where exists (select 1 from cron.job where jobname = 'downgrade-expired-plans');

select cron.schedule(
  'downgrade-expired-plans',
  '5 * * * *',
  $$ select public.downgrade_expired_plans(); $$
);

/* ------------------------------------------------------------------ */
/*  3. Jaanch                                                          */
/* ------------------------------------------------------------------ */

-- Abhi ek baar chala ke dekho (kitne users par kaam hua):
--   select public.downgrade_expired_plans();
-- Job list:
--   select jobname, schedule, active from cron.job;
-- Band karna ho to:
--   select cron.unschedule('downgrade-expired-plans');
