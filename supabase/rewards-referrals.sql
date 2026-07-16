-- Apka Saathi — First-1000 reward + Referrals + Admin config
-- Supabase SQL Editor mein Run karo. (Dobara run safe hai.)
-- NOTE: pehle profiles.sql, schema.sql, plans.sql run kar lena.
--
-- Waitlist ki jagah: pehle N signups ko X mahine Plus.
-- Referral: 1 referral = Y din Plus DONO ko (referrer cap Z mahine),
-- reward tabhi jab naya user document upload + Saathi se chat kare.

/* ------------------------------------------------------------------ */
/* 1. Config (admin se editable)                                        */
/* ------------------------------------------------------------------ */

create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Launch offer (first_n_*) hata diya gaya — sirf referral config seed hota hai.
insert into public.app_config(key, value) values
  ('referrals_enabled',   'true'::jsonb),
  ('referral_days',       '15'::jsonb)
on conflict (key) do nothing;

alter table public.app_config enable row level security;
drop policy if exists "read config" on public.app_config;
create policy "read config" on public.app_config for select using (true);
-- writes: sirf service_role (admin API).

create or replace function public.cfg_int(k text, dflt int)
returns int language sql stable as $$
  select coalesce((select (value #>> '{}')::int from public.app_config where key = k), dflt);
$$;

create or replace function public.cfg_bool(k text, dflt boolean)
returns boolean language sql stable as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_config where key = k), dflt);
$$;

/* ------------------------------------------------------------------ */
/* 2. Profile + ownership columns                                       */
/* ------------------------------------------------------------------ */

alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists referred_by uuid references auth.users(id);
alter table public.profiles add column if not exists referral_days_earned int not null default 0;

-- Anti-fraud checks ke liye ownership chahiye.
alter table public.documents add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.messages  add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists documents_user_idx on public.documents(user_id);
create index if not exists messages_user_idx  on public.messages(user_id);

/* ------------------------------------------------------------------ */
/* 3. Referrals                                                         */
/* ------------------------------------------------------------------ */

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referee_id  uuid not null unique references auth.users(id) on delete cascade,
  code text not null,
  qualified_at timestamptz,
  rewarded_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint no_self_referral check (referrer_id <> referee_id)
);
create index if not exists referrals_referrer_idx on public.referrals(referrer_id);

-- Kitne din KIS WAQT diye the. Config kal badal sakta hai — reward ke waqt
-- ka number yahin likh dete hain, taki "kab kitna mila" hamesha sach rahe.
alter table public.referrals add column if not exists referrer_days int not null default 0;
alter table public.referrals add column if not exists referee_days  int not null default 0;
-- referrer cap (6 mahine) pe pahunch gaya tha, isliye usko din nahi mile
alter table public.referrals add column if not exists cap_skipped boolean not null default false;

alter table public.referrals enable row level security;
drop policy if exists "own referrals" on public.referrals;
create policy "own referrals" on public.referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referee_id);

/* ------------------------------------------------------------------ */
/* 4. Grant helper — din ADD karo (paid plan bhi extend hota hai)       */
/* ------------------------------------------------------------------ */

-- Din ADD karo. Kabhi kisi ka plan chhota mat karo.
--
-- ⚠️ Pehle yahan bug tha: paid user ka `plan_expires_at` null hota hai (matlab
-- "abhi active, expiry set nahi"). Purana code us null ko `now()` maan leta tha,
-- to referral ke 15 din milte hi uska Plus `now() + 15 din` ho jaata tha —
-- yaani paid plan CHHOTA ho jaata tha. Ab null wale ko null hi rehne dete hain.
-- Purana 2-arg version hata do, warna 3-arg add karne pe call ambiguous ho jaata hai.
drop function if exists public.grant_plus_days(uuid, int);

create or replace function public.grant_plus_days(
  p_uid uuid, p_days int, p_source text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set plan = 'plus',
         plan_expires_at = case
           -- pehle se unlimited/active-bina-expiry: mat chhedo
           when plan = 'plus' and plan_expires_at is null then null
           else greatest(coalesce(plan_expires_at, now()), now())
                + make_interval(days => p_days)
         end,
         -- Paid source sabse upar — reward ke din add hone se "google_play"
         -- kabhi "referral" nahi ban jaana chahiye.
         plan_source = case
           when plan_source = 'google_play' then plan_source
           else coalesce(p_source, plan_source, 'reward')
         end
   where id = p_uid;
end;
$$;

/* ------------------------------------------------------------------ */
/* 5. Referral code — har user ko signup pe                             */
/* ------------------------------------------------------------------ */

create or replace function public.gen_referral_code()
returns text language sql volatile as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare c text;
begin
  loop
    c := public.gen_referral_code();
    exit when not exists (select 1 from public.profiles where referral_code = c);
  end loop;

  insert into public.profiles (id, email, full_name, referral_code)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    c
  )
  on conflict (id) do update set full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Purane users ko bhi code do
update public.profiles set referral_code = public.gen_referral_code()
where referral_code is null;

/* 6. (Launch offer hata diya gaya — pehle yahan claim_first_n_reward tha.)     */

/* ------------------------------------------------------------------ */
/* 7. Referral code apply (signup pe)                                   */
/* ------------------------------------------------------------------ */

create or replace function public.apply_referral_code(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare ref_id uuid;
begin
  if auth.uid() is null then return 'no_auth'; end if;
  if not public.cfg_bool('referrals_enabled', true) then return 'disabled'; end if;
  if exists (select 1 from public.referrals where referee_id = auth.uid()) then
    return 'already_referred';
  end if;

  select id into ref_id from public.profiles
   where upper(referral_code) = upper(trim(p_code));
  if ref_id is null then return 'invalid_code'; end if;
  if ref_id = auth.uid() then return 'self'; end if;

  insert into public.referrals (referrer_id, referee_id, code)
  values (ref_id, auth.uid(), upper(trim(p_code)));
  update public.profiles set referred_by = ref_id where id = auth.uid();
  return 'applied';
end;
$$;
grant execute on function public.apply_referral_code(text) to authenticated;

/* ------------------------------------------------------------------ */
/* 8. Qualification + reward (document upload + chat, dono)             */
/* ------------------------------------------------------------------ */

create or replace function public.check_referral_qualification()
returns text language plpgsql security definer set search_path = public as $$
declare r record; days int; earned int;
begin
  if auth.uid() is null then return 'no_auth'; end if;
  if not public.cfg_bool('referrals_enabled', true) then return 'disabled'; end if;

  select * into r from public.referrals
   where referee_id = auth.uid() and rewarded_at is null;
  if r is null then return 'no_referral'; end if;

  -- Anti-fraud: naya user ne document upload kiya AUR Saathi se chat kiya
  if not exists (select 1 from public.documents where user_id = auth.uid()) then
    return 'need_document';
  end if;
  if not exists (select 1 from public.messages
                  where user_id = auth.uid() and role = 'user') then
    return 'need_chat';
  end if;

  days := public.cfg_int('referral_days', 15);

  -- Koi cap nahi — jitne referrals, utne din. Referrer ko hamesha milte hain.
  select referral_days_earned into earned from public.profiles where id = r.referrer_id;
  perform public.grant_plus_days(r.referrer_id, days, 'referral');
  update public.profiles set referral_days_earned = coalesce(earned, 0) + days
   where id = r.referrer_id;

  -- Naye user ko bhi (uska ek-baar ka reward)
  perform public.grant_plus_days(auth.uid(), days, 'referral');

  -- Aaj ke din ke din yahin freeze — kal admin 15 ko 30 kar de to bhi ye 15 hi rahe.
  update public.referrals
     set qualified_at  = coalesce(qualified_at, now()),
         rewarded_at   = now(),
         referrer_days = days,
         referee_days  = days
   where id = r.id;
  return 'rewarded';
end;
$$;
grant execute on function public.check_referral_qualification() to authenticated;

/* ------------------------------------------------------------------ */
/* 9. Admin manual grant — sirf service_role (admin API) call kare      */
/* ------------------------------------------------------------------ */

create or replace function public.admin_grant_days(p_email text, p_days int)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select id into uid from public.profiles where lower(email) = lower(trim(p_email));
  if uid is null then return 'user_not_found'; end if;
  perform public.grant_plus_days(uid, p_days, 'admin');
  return 'granted';
end;
$$;

/* ------------------------------------------------------------------ */
/* 9b. Email masking — referrer ko referee ka poora email na dikhe      */
/* ------------------------------------------------------------------ */

create or replace function public.mask_email(e text)
returns text language sql immutable as $$
  select case
    when e is null or position('@' in e) = 0 then null
    else left(split_part(e, '@', 1), 2) || '••••@' || split_part(e, '@', 2)
  end;
$$;

/* ------------------------------------------------------------------ */
/* 9c. my_rewards() — app ki "Meri membership" screen ka poora data     */
/* ------------------------------------------------------------------ */
--
-- Ek hi call me: kab aaye, plan kya hai, kab tak, kis wajah se, first-N se
-- kitne din, referral se kitne din, aur kis-kis ko refer kiya (kisse mila,
-- kisse abhi nahi mila).
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
    -- live config (badal sakta hai)
    'referral_days_now',    public.cfg_int('referral_days', 15),
    'referrals_enabled',    public.cfg_bool('referrals_enabled', true),
    'referrals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',           r.id,
        'name',         rp.full_name,
        'email',        public.mask_email(rp.email),
        'joined_at',    r.created_at,
        'qualified_at', r.qualified_at,
        'rewarded_at',  r.rewarded_at,
        'days',         r.referrer_days
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
/* 9d. admin_user_detail() — sirf service_role. Poore email dikhte hain */
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
    'referrals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',           r.id,
        'email',        rp.email,
        'name',         rp.full_name,
        'joined_at',    r.created_at,
        'qualified_at', r.qualified_at,
        'rewarded_at',  r.rewarded_at,
        'days',         r.referrer_days
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
/* 10. SECURITY — ye hissa bahut zaroori hai                            */
/* ------------------------------------------------------------------ */
--
-- Postgres har nayi function pe PUBLIC ko EXECUTE apne aap de deta hai.
-- `grant_plus_days` aur `admin_grant_days` SECURITY DEFINER hain — inke bina
-- revoke ke koi bhi logged-in user `/rest/v1/rpc/grant_plus_days` call karke
-- khud ko unlimited Plus de sakta tha. Isliye pehle sab se chheeno, phir
-- sirf jo chahiye wahi do.

revoke all on function public.grant_plus_days(uuid, int, text) from public, anon, authenticated;
revoke all on function public.admin_grant_days(text, int)      from public, anon, authenticated;
revoke all on function public.admin_user_detail(uuid)          from public, anon, authenticated;
-- Ye teeno ab sirf service_role (admin API) se chalti hain.

-- User-facing RPCs: anon se chheeno, sirf logged-in user ko do.
revoke all on function public.apply_referral_code(text) from public, anon;
revoke all on function public.check_referral_qualification() from public, anon;
revoke all on function public.my_rewards() from public, anon;

grant execute on function public.apply_referral_code(text) to authenticated;
grant execute on function public.check_referral_qualification() to authenticated;
grant execute on function public.my_rewards() to authenticated;

/* ------------------------------------------------------------------ */
/* 11. Backfill — purane rewarded referrals ke din bhar do             */
/* ------------------------------------------------------------------ */
-- Naye columns default 0 hain. Jo referral pehle se rewarded hai uske liye
-- abhi ka config hi sabse achha andaaza hai. (Sirf ek baar chalega — jinke
-- din 0 hain unhi pe.)
update public.referrals
   set referrer_days = public.cfg_int('referral_days', 15),
       referee_days  = public.cfg_int('referral_days', 15)
 where rewarded_at is not null and referrer_days = 0 and referee_days = 0;
