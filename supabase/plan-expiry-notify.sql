-- Plus khatam ho gaya — "user ko bataya ja chuka hai ya nahi" ka nishaan.
-- Supabase SQL Editor me Run karo. Dobara run safe hai.
-- Pehle chala lena: plans.sql, plan-limits.sql, cron-plan-expiry.sql
--
-- ── Ye kyun bana ───────────────────────────────────────────────────────
--
-- ⚠️ Downgrade ab apne aap ho jaata hai (`cron-plan-expiry.sql` har ghante
-- chalta hai): Plus khatam hote hi free hadd se aage ke documents lock ho jaate
-- hain aur aage ke reminders pause. Ye theek hai — par user ko iski KHABAR
-- kahin se nahi milti thi.
--
-- Uske liye ye bilkul aisa dikhta hai jaise app kharab ho gayi: "mere
-- documents kahan gaye", "reminder aana band kyun ho gaya". Wo support par
-- likhta hai, aur jawab dene wale ko bhi pehle khodna padta hai. Jabki hua kuch
-- galat nahi — bas plan khatam ho gaya, aur wo ek line kisi ne kahi hi nahi.
--
-- Ab admin > "Plus khatam" section se ek click par us user ko uski apni bhasha
-- me email aur notification chali jaati hai. Ye column sirf itna yaad rakhta hai
-- ki kise bataya ja chuka hai — taaki wahi baat dobara-dobara na jaye.

alter table public.profiles
  add column if not exists plan_expiry_notified_at timestamptz;

comment on column public.profiles.plan_expiry_notified_at is
  'Plus khatam hone ki khabar user ko kab bheji gayi (admin > Plus khatam). null = abhi tak nahi.';

/**
 * ⚠️ Nishaan tabhi kaam ka hai jab wo HAR NAYE Plus ke saath saaf ho jaye.
 *
 * Bina iske ek hi baar khabar ja paati: user ne Plus liya, phir wo khatam hua
 * (khabar gayi, nishaan lag gaya), phir usne Plus dobara liya aur wo phir khatam
 * hua — aur is doosri baar admin ko wo user "bataya ja chuka hai" wali list me
 * dikhta, yaani uski khabar kabhi jaati hi nahi.
 *
 * `plan_expires_at` aage sarakna hi "naya Plus" ka pakka nishaan hai — chahe wo
 * Play se aaya ho, referral se, ya admin ke `grant_plus_days` se. Isliye rok
 * yahin, ek trigger me, har raaste ke liye ek saath.
 */
create or replace function public.clear_plan_expiry_notice()
returns trigger
language plpgsql
as $$
begin
  if new.plan_expires_at is distinct from old.plan_expires_at
     and new.plan_expires_at is not null
     and (old.plan_expires_at is null or new.plan_expires_at > old.plan_expires_at)
  then
    new.plan_expiry_notified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clear_plan_expiry_notice on public.profiles;
create trigger trg_clear_plan_expiry_notice
  before update of plan_expires_at on public.profiles
  for each row
  execute function public.clear_plan_expiry_notice();

-- Admin ki list isi shart par banti hai (plan = 'plus' par expiry nikal chuki).
-- Users badhne par ye index usi list ko sasta rakhta hai.
create index if not exists profiles_plan_expired_idx
  on public.profiles (plan_expires_at desc)
  where plan = 'plus';
