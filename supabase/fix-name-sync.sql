-- ============================================================================
-- Naam (full_name) fix — DB me sahi save ho + admin me dikhe
--
-- Problem tha:
--   • Signup ka naam profiles.full_name me jaata hai (on_auth_user_created trigger).
--   • Par app me user "profile-details" se naam edit kare to wo alag table
--     user_details.full_name me jaata hai — profiles.full_name purana/khaali reh jaata.
--   • Admin dashboard SIRF profiles.full_name padhta hai → naam blank dikhta tha.
--   • Upar se purana trigger `on conflict do update set full_name = excluded.full_name`
--     naam ko NULL se bhi overwrite kar deta tha (Google login bina naam ke, etc.).
--
-- Ye file:
--   1) new-user trigger robust — naam kabhi NULL/khaali se overwrite na ho.
--   2) Purane users ka naam backfill — auth metadata + user_details dono se.
--   3) user_details me naam badle to profiles.full_name auto-sync ho jaye.
--
-- Supabase SQL Editor me poori file Run karo. Dobara chalana safe hai (idempotent).
-- Prereq: profiles.sql, locations-billing.sql, rewards-referrals.sql pehle chal chuke hon.
-- ============================================================================

-- 1) New-user trigger — naam kabhi NULL/khaali se overwrite na ho -------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare c text;
begin
  -- unique referral code
  loop
    c := public.gen_referral_code();
    exit when not exists (select 1 from public.profiles where referral_code = c);
  end loop;

  insert into public.profiles (id, email, full_name, referral_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    c
  )
  on conflict (id) do update set
    email     = coalesce(excluded.email, public.profiles.email),
    -- naya naam mile tabhi badlo; warna purana rakho (NULL se overwrite mat karo)
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2a) Backfill: auth.users metadata se (purane email/Google users) ------------
update public.profiles p
set full_name = coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')
from auth.users u
where u.id = p.id
  and (p.full_name is null or p.full_name = '')
  and coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name') is not null;

-- 2b) Backfill: user_details se (jinhone app me naam bhara par profiles khaali) -
update public.profiles p
set full_name = ud.full_name
from public.user_details ud
where ud.user_id = p.id
  and (p.full_name is null or p.full_name = '')
  and ud.full_name is not null and ud.full_name <> '';

-- 3) Aage se: user_details me naam badle to profiles.full_name bhi update ho ---
create or replace function public.sync_full_name_from_details()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.full_name is not null and new.full_name <> '' then
    update public.profiles
      set full_name = new.full_name
      where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_user_details_name on public.user_details;
create trigger on_user_details_name
  after insert or update of full_name on public.user_details
  for each row execute function public.sync_full_name_from_details();

-- Check (optional): kitne profiles me abhi bhi naam nahi
-- select count(*) filter (where full_name is null or full_name = '') as bina_naam,
--        count(*) as total
-- from public.profiles;
