-- Apka Saathi — Devices registry + Analytics events
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
-- NOTE: pehle profiles.sql, schema.sql, rewards-referrals.sql chala lena.
--
-- Do kaam yahan se hote hain:
--
--   1. devices  — har install ka ek pehchaan-patra. Isse do cheezein milti hain:
--                 (a) app khulte hi pata chal jaata hai ki ye device pehle aa
--                     chuka hai (to language-select skip karke seedha login), aur
--                 (b) ek device sirf EK BAAR referral reward le sakta hai.
--                     Pehle koi bhi naya email banake, apna hi code daal ke,
--                     usi phone se baar-baar 15-15 din le sakta tha.
--
--   2. analytics_events — app aur web dono ka safar (screens, buttons, pages)
--                 ek hi table me. Admin panel wahi se "journey" banata hai.

/* ------------------------------------------------------------------ */
/* 1. Devices                                                           */
/* ------------------------------------------------------------------ */

create table if not exists public.devices (
  -- Client par bana UUID (SecureStore me rehta hai — logout/login se nahi jaata).
  id text primary key,
  -- brand/model/os ka hash. Sirf ek extra ishaara — akela bharosa nahi.
  fingerprint text,
  platform text,
  -- Is device par aakhri baar chuni gayi bhasha. Reinstall ke baad wahi lagti hai.
  language text,
  first_user_id uuid references auth.users(id) on delete set null,
  last_user_id  uuid references auth.users(id) on delete set null,
  -- Is device se referral reward kab mila. Null = abhi tak nahi mila.
  referral_claimed_at timestamptz,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists devices_fingerprint_idx on public.devices(fingerprint);
create index if not exists devices_last_user_idx on public.devices(last_user_id);

alter table public.devices enable row level security;
-- Koi direct select/insert nahi — sab kuch neeche wali RPC se (security definer).
drop policy if exists "no direct device access" on public.devices;

/**
 * Device ko register/refresh karo aur batao ki ye pehle dekha hua hai ya nahi.
 *
 * Login se PEHLE bhi call hoti hai (anon), isliye grant anon ko bhi hai. Row
 * sirf uske apne UUID se milti hai — bina UUID jaane kuch pata nahi chalta.
 */
create or replace function public.device_seen(
  p_id text,
  p_fingerprint text default null,
  p_platform text default null,
  p_language text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare existed boolean; row_lang text;
begin
  if p_id is null or length(trim(p_id)) < 8 then
    return jsonb_build_object('known', false, 'language', null);
  end if;

  select true, language into existed, row_lang
    from public.devices where id = p_id;

  insert into public.devices (id, fingerprint, platform, language, last_user_id, last_seen_at)
  values (p_id, p_fingerprint, p_platform, p_language, auth.uid(), now())
  on conflict (id) do update
    set last_seen_at = now(),
        fingerprint  = coalesce(excluded.fingerprint, public.devices.fingerprint),
        platform     = coalesce(excluded.platform, public.devices.platform),
        -- Bhasha tabhi badlo jab caller ne bheji ho (warna purani hi rehne do).
        language     = coalesce(excluded.language, public.devices.language),
        last_user_id = coalesce(auth.uid(), public.devices.last_user_id),
        first_user_id = coalesce(public.devices.first_user_id, auth.uid());

  return jsonb_build_object(
    'known', coalesce(existed, false),
    'language', coalesce(p_language, row_lang)
  );
end;
$$;

revoke all on function public.device_seen(text, text, text, text) from public;
grant execute on function public.device_seen(text, text, text, text) to anon, authenticated;

/* ------------------------------------------------------------------ */
/* 2. Referral: ek device = ek reward                                   */
/* ------------------------------------------------------------------ */
--
-- Purana `check_referral_qualification()` device nahi jaanta tha. Ab wo bhi
-- rehta hai (purane app builds ke liye), aur naya 1-arg version device dekhta
-- hai. Dono ek hi asli logic call karte hain.

create or replace function public.check_referral_qualification(p_device_id text)
returns text language plpgsql security definer set search_path = public as $$
declare r record; days int; earned int; dev_claimed timestamptz;
begin
  if auth.uid() is null then return 'no_auth'; end if;
  if not public.cfg_bool('referrals_enabled', true) then return 'disabled'; end if;

  select * into r from public.referrals
   where referee_id = auth.uid() and rewarded_at is null;
  if r is null then return 'no_referral'; end if;

  -- Anti-fraud 1: naye user ne ek document upload kiya AUR ek reminder set kiya.
  if not exists (select 1 from public.documents where user_id = auth.uid()) then
    return 'need_document';
  end if;
  if not exists (select 1 from public.reminders where user_id = auth.uid()) then
    return 'need_reminder';
  end if;

  -- Anti-fraud 2: is device se pehle hi reward liya ja chuka hai?
  -- (Naya email + wahi phone = ab kuch nahi milega.)
  if p_device_id is not null and length(trim(p_device_id)) >= 8 then
    select referral_claimed_at into dev_claimed
      from public.devices where id = p_device_id;
    if dev_claimed is not null then
      return 'device_already_rewarded';
    end if;
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

  -- Device par mohar lagao — ab isse dobara reward nahi milega.
  if p_device_id is not null and length(trim(p_device_id)) >= 8 then
    insert into public.devices (id, referral_claimed_at, last_user_id)
    values (p_device_id, now(), auth.uid())
    on conflict (id) do update
      set referral_claimed_at = coalesce(public.devices.referral_claimed_at, now()),
          last_user_id = auth.uid();
  end if;

  return 'rewarded';
end;
$$;

-- Purana 0-arg version ab naye wale ko null device ke saath call karta hai.
create or replace function public.check_referral_qualification()
returns text language plpgsql security definer set search_path = public as $$
begin
  return public.check_referral_qualification(null::text);
end;
$$;

revoke all on function public.check_referral_qualification(text) from public, anon;
grant execute on function public.check_referral_qualification(text) to authenticated;

/* ------------------------------------------------------------------ */
/* 3. Analytics events — app + web ka poora safar                       */
/* ------------------------------------------------------------------ */

create table if not exists public.analytics_events (
  id bigserial primary key,
  user_id    uuid references auth.users(id) on delete set null,
  device_id  text,
  -- Ek baithak (app open se band tak / ek browser tab). Journey isi se judta hai.
  session_id text,
  source     text not null default 'app',   -- 'app' | 'web'
  name       text not null,                  -- 'screen_view' | 'click' | 'page_view'
  -- screen/page ka naam ya path — journey ki har seedhi.
  target     text,
  props      jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ae_user_time_idx    on public.analytics_events(user_id, created_at desc);
create index if not exists ae_session_time_idx on public.analytics_events(session_id, created_at);
create index if not exists ae_time_idx         on public.analytics_events(created_at desc);
create index if not exists ae_device_idx       on public.analytics_events(device_id);

alter table public.analytics_events enable row level security;

-- Sirf likhne do (anon bhi — web visitor logged-in nahi hota). Padhna sirf
-- service_role (admin API) ka kaam hai, isliye koi select policy nahi.
drop policy if exists "insert own events" on public.analytics_events;
create policy "insert own events" on public.analytics_events for insert
  with check (user_id is null or user_id = auth.uid());

grant insert on public.analytics_events to anon, authenticated;
grant usage, select on sequence public.analytics_events_id_seq to anon, authenticated;

/* ------------------------------------------------------------------ */
/* 4. Admin: ek user ka poora safar                                     */
/* ------------------------------------------------------------------ */

create or replace function public.admin_user_journey(p_uid uuid, p_limit int default 300)
returns jsonb language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  select coalesce(jsonb_agg(e order by e.created_at desc), '[]'::jsonb) into res
  from (
    select id, session_id, source, name, target, props, created_at, device_id
    from public.analytics_events
    where user_id = p_uid
    order by created_at desc
    limit greatest(1, least(p_limit, 1000))
  ) e;
  return res;
end;
$$;

revoke all on function public.admin_user_journey(uuid, int) from public, anon, authenticated;
-- Sirf service_role (admin API).

/* ------------------------------------------------------------------ */
/* 5. Admin: rozana ka summary (dashboard ke liye)                      */
/* ------------------------------------------------------------------ */

create or replace function public.admin_analytics_summary(p_days int default 14)
returns jsonb language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  select jsonb_build_object(
    'daily', coalesce((
      select jsonb_agg(d order by d.day)
      from (
        select date_trunc('day', created_at)::date as day,
               count(*)                                as events,
               count(distinct session_id)              as sessions,
               count(distinct user_id)                 as users,
               count(*) filter (where source = 'web')  as web,
               count(*) filter (where source = 'app')  as app
        from public.analytics_events
        where created_at >= now() - make_interval(days => greatest(1, least(p_days, 90)))
        group by 1
      ) d
    ), '[]'::jsonb),
    'top', coalesce((
      select jsonb_agg(t order by t.hits desc)
      from (
        select source, name, target, count(*) as hits
        from public.analytics_events
        where created_at >= now() - make_interval(days => greatest(1, least(p_days, 90)))
          and target is not null
        group by 1, 2, 3
        order by hits desc
        limit 30
      ) t
    ), '[]'::jsonb)
  ) into res;
  return res;
end;
$$;

revoke all on function public.admin_analytics_summary(int) from public, anon, authenticated;
