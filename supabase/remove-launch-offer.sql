-- Apka Saathi — Launch offer (first-1000 / X mahine free) POORI TARAH hatao.
-- Supabase SQL Editor me Run karo. Sirf launch offer jaata hai — REFERRAL sab
-- waise ka waise chalta rehta hai. Koi user data delete nahi hota.
--
-- Order zaroori hai: pehle RPCs ko first_n ke bina banate hain, phir columns
-- drop karte hain (warna RPC missing column pe fail karti).

/* ------------------------------------------------------------------ */
/* 1. my_rewards() — first_n fields ke bina                            */
/* ------------------------------------------------------------------ */
create or replace function public.my_rewards()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); res jsonb;
begin
  if uid is null then return null; end if;

  select jsonb_build_object(
    'joined_at',            p.created_at,
    'plan',                 p.plan,
    'plan_expires_at',      p.plan_expires_at,
    'plan_source',          p.plan_source,
    'referral_code',        p.referral_code,
    'referral_days_earned', p.referral_days_earned,
    'referred_by_code',     (select referral_code from public.profiles where id = p.referred_by),
    'referral_days_now',    public.cfg_int('referral_days', 15),
    'cap_days',             public.cfg_int('referral_cap_months', 6) * 30,
    'referrals_enabled',    public.cfg_bool('referrals_enabled', true),
    'referrals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',           r.id,
        'name',         rp.full_name,
        'email',        public.mask_email(rp.email),
        'joined_at',    r.created_at,
        'qualified_at', r.qualified_at,
        'rewarded_at',  r.rewarded_at,
        'days',         r.referrer_days,
        'cap_skipped',  r.cap_skipped
      ) order by r.created_at desc)
      from public.referrals r
      left join public.profiles rp on rp.id = r.referee_id
      where r.referrer_id = uid
    ), '[]'::jsonb)
  ) into res
  from public.profiles p where p.id = uid;

  return res;
end;
$$;

/* ------------------------------------------------------------------ */
/* 2. admin_user_detail() — first_n fields ke bina                     */
/* ------------------------------------------------------------------ */
create or replace function public.admin_user_detail(p_uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  select jsonb_build_object(
    'id',                   p.id,
    'email',                p.email,
    'full_name',            p.full_name,
    'joined_at',            p.created_at,
    'plan',                 p.plan,
    'plan_expires_at',      p.plan_expires_at,
    'plan_source',          p.plan_source,
    'referral_code',        p.referral_code,
    'referral_days_earned', p.referral_days_earned,
    'referred_by', (
      select jsonb_build_object('email', rb.email, 'code', rb.referral_code)
      from public.profiles rb where rb.id = p.referred_by
    ),
    'cap_days', public.cfg_int('referral_cap_months', 6) * 30,
    'referrals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',           r.id,
        'email',        rp.email,
        'name',         rp.full_name,
        'joined_at',    r.created_at,
        'qualified_at', r.qualified_at,
        'rewarded_at',  r.rewarded_at,
        'days',         r.referrer_days,
        'cap_skipped',  r.cap_skipped
      ) order by r.created_at desc)
      from public.referrals r
      left join public.profiles rp on rp.id = r.referee_id
      where r.referrer_id = p.id
    ), '[]'::jsonb)
  ) into res
  from public.profiles p where p.id = p_uid;

  return res;
end;
$$;

/* ------------------------------------------------------------------ */
/* 3. claim_first_n_reward() function poori tarah hatao                */
/* ------------------------------------------------------------------ */
drop function if exists public.claim_first_n_reward();

/* ------------------------------------------------------------------ */
/* 4. Config se launch-offer keys delete                               */
/* ------------------------------------------------------------------ */
delete from public.app_config
 where key in ('first_n_enabled', 'first_n_users', 'first_n_free_months');

/* ------------------------------------------------------------------ */
/* 5. profiles se first_n columns drop (ab kahin use nahi hote)        */
/* ------------------------------------------------------------------ */
alter table public.profiles drop column if exists first_n_granted;
alter table public.profiles drop column if exists first_n_rank;
alter table public.profiles drop column if exists first_n_days;
alter table public.profiles drop column if exists first_n_granted_at;

-- REFERRAL kuch nahi badla — referrals table, apply_referral_code,
-- check_referral_qualification, grant_plus_days sab waise hi chalte hain.
