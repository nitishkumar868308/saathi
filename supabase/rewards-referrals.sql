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

insert into public.app_config(key, value) values
  ('first_n_enabled',     'true'::jsonb),
  ('first_n_users',       '1000'::jsonb),
  ('first_n_free_months', '3'::jsonb),
  ('referrals_enabled',   'true'::jsonb),
  ('referral_days',       '15'::jsonb),
  ('referral_cap_months', '6'::jsonb)
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
alter table public.profiles add column if not exists first_n_granted boolean not null default false;

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

alter table public.referrals enable row level security;
drop policy if exists "own referrals" on public.referrals;
create policy "own referrals" on public.referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referee_id);

/* ------------------------------------------------------------------ */
/* 4. Grant helper — din ADD karo (paid plan bhi extend hota hai)       */
/* ------------------------------------------------------------------ */

create or replace function public.grant_plus_days(p_uid uuid, p_days int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set plan = 'plus',
         plan_expires_at = greatest(coalesce(plan_expires_at, now()), now())
                           + make_interval(days => p_days),
         plan_source = coalesce(plan_source, 'reward')
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

/* ------------------------------------------------------------------ */
/* 6. First-N reward (waitlist ki jagah)                                */
/* ------------------------------------------------------------------ */

create or replace function public.claim_first_n_reward()
returns text language plpgsql security definer set search_path = public as $$
declare urank int; months int;
begin
  if auth.uid() is null then return 'no_auth'; end if;
  if not public.cfg_bool('first_n_enabled', true) then return 'disabled'; end if;
  if (select first_n_granted from public.profiles where id = auth.uid()) then
    return 'already';
  end if;

  select rnk into urank from (
    select id, row_number() over (order by created_at asc) as rnk
    from public.profiles
  ) t where t.id = auth.uid();

  if urank is null or urank > public.cfg_int('first_n_users', 1000) then
    return 'not_eligible';
  end if;

  months := public.cfg_int('first_n_free_months', 3);
  perform public.grant_plus_days(auth.uid(), months * 30);
  update public.profiles set first_n_granted = true where id = auth.uid();
  return 'granted';
end;
$$;
grant execute on function public.claim_first_n_reward() to authenticated;

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
declare r record; days int; cap_days int; earned int;
begin
  if auth.uid() is null then return 'no_auth'; end if;

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

  days     := public.cfg_int('referral_days', 15);
  cap_days := public.cfg_int('referral_cap_months', 6) * 30;

  select referral_days_earned into earned from public.profiles where id = r.referrer_id;
  if coalesce(earned, 0) + days <= cap_days then
    perform public.grant_plus_days(r.referrer_id, days);
    update public.profiles set referral_days_earned = coalesce(earned, 0) + days
     where id = r.referrer_id;
  end if;

  -- Naye user ko hamesha (uska ek-baar ka reward)
  perform public.grant_plus_days(auth.uid(), days);

  update public.referrals
     set qualified_at = coalesce(qualified_at, now()), rewarded_at = now()
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
  perform public.grant_plus_days(uid, p_days);
  return 'granted';
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

revoke all on function public.grant_plus_days(uuid, int) from public, anon, authenticated;
revoke all on function public.admin_grant_days(text, int) from public, anon, authenticated;
-- Ye dono ab sirf service_role (admin API) se chalti hain.

-- User-facing RPCs: anon se chheeno, sirf logged-in user ko do.
revoke all on function public.claim_first_n_reward() from public, anon;
revoke all on function public.apply_referral_code(text) from public, anon;
revoke all on function public.check_referral_qualification() from public, anon;

grant execute on function public.claim_first_n_reward() to authenticated;
grant execute on function public.apply_referral_code(text) to authenticated;
grant execute on function public.check_referral_qualification() to authenticated;
