-- Apka Saathi — Free/Plus plan limits + expiry downgrade (spec items 1-14)
-- Supabase SQL Editor me Run karo. Dobara run safe hai.
-- Pehle chala lena: schema.sql, profiles.sql, plans.sql, rewards-referrals.sql
--
-- Free : 5 active reminders, 3 documents, AI locked, premium locked
-- Plus : sab unlimited (₹99/mahina, ₹999/saal)
-- Launch offer (first-1000) HATA diya — har naya user Free se shuru.
--
-- DATA KABHI DELETE NAHI HOTA. Plus expire hone pe sirf ACCESS badalta hai:
--   - pehle 5 reminders active rehte hain, baaki PAUSE (is_paused = true)
--   - pehle 3 documents khulte hain, baaki LOCK (is_locked = true)
-- Wapas Plus milte hi sab dobara active/unlock ho jaata hai — automatically.

/* ------------------------------------------------------------------ */
/* 1. Config — naye limits, launch offer band                          */
/* ------------------------------------------------------------------ */

insert into public.app_config(key, value) values
  ('free_reminders',      '5'::jsonb),
  ('free_documents',      '3'::jsonb),
  ('plus_price_monthly',  '99'::jsonb),
  ('plus_price_yearly',   '999'::jsonb)
on conflict (key) do nothing;

-- Launch offer poori tarah band. (Admin chaahe to dobara on kar sakta hai,
-- par default ab OFF hai — spec item 1.)
update public.app_config set value = 'false'::jsonb where key = 'first_n_enabled';

/* ------------------------------------------------------------------ */
/* 2. Naye columns — pause (reminders) aur lock (documents)            */
/* ------------------------------------------------------------------ */

alter table public.reminders add column if not exists is_paused boolean not null default false;
alter table public.documents add column if not exists is_locked boolean not null default false;

create index if not exists reminders_user_created_idx on public.reminders(user_id, created_at);
create index if not exists documents_user_created_idx on public.documents(user_id, created_at);

/* ------------------------------------------------------------------ */
/* 3. Plus abhi active hai ya nahi                                      */
/* ------------------------------------------------------------------ */
-- profiles.plan column expire hone ke baad bhi 'plus' reh sakta hai (history
-- ke liye). "Abhi active hai kya" hamesha isi function se poochho.
create or replace function public.is_plus_active(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select plan = 'plus' and (plan_expires_at is null or plan_expires_at > now())
       from public.profiles where id = p_uid),
    false);
$$;

/* ------------------------------------------------------------------ */
/* 4. enforce_plan_limits — access ko current plan ke hisaab se set karo */
/* ------------------------------------------------------------------ */
--
-- Plus active  -> sab unpause + unlock (kuch chhoota nahi).
-- Free         -> pehle N reminders active, baaki pause;
--                 pehle M documents khule, baaki lock.
-- created_at ke order pe — "no manual selection" (spec item 7, 8).
create or replace function public.enforce_plan_limits(p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  active   boolean := public.is_plus_active(p_uid);
  rem_lim  int := public.cfg_int('free_reminders', 5);
  doc_lim  int := public.cfg_int('free_documents', 3);
begin
  if p_uid is null then return; end if;

  if active then
    -- Plus: sab wapas chaalu
    update public.reminders set is_paused = false
      where user_id = p_uid and is_paused;
    update public.documents set is_locked = false
      where user_id = p_uid and is_locked;
    return;
  end if;

  -- Free: reminders — pehle rem_lim (created_at) active, baaki pause
  with ranked as (
    select id, row_number() over (order by created_at asc, id asc) as rn
    from public.reminders where user_id = p_uid
  )
  update public.reminders r
     set is_paused = (ranked.rn > rem_lim)
    from ranked
   where r.id = ranked.id
     and r.is_paused <> (ranked.rn > rem_lim);

  -- Free: documents — pehle doc_lim khule, baaki lock
  with ranked as (
    select id, row_number() over (order by created_at asc, id asc) as rn
    from public.documents where user_id = p_uid
  )
  update public.documents d
     set is_locked = (ranked.rn > doc_lim)
    from ranked
   where d.id = ranked.id
     and d.is_locked <> (ranked.rn > doc_lim);
end;
$$;

-- User apne liye khud chala sake (app session load pe call karta hai).
create or replace function public.enforce_my_limits()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  perform public.enforce_plan_limits(auth.uid());
end;
$$;

/* ------------------------------------------------------------------ */
/* 5. grant_plus_days ab grant ke baad access bhi khol de              */
/* ------------------------------------------------------------------ */
-- Referral/purchase/admin — kisi bhi tarah Plus milte hi paused reminders aur
-- locked documents turant wapas aa jaayein (spec item 12, 13).
create or replace function public.grant_plus_days(
  p_uid uuid, p_days int, p_source text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set plan = 'plus',
         plan_expires_at = case
           when plan = 'plus' and plan_expires_at is null then null
           else greatest(coalesce(plan_expires_at, now()), now())
                + make_interval(days => p_days)
         end,
         plan_source = case
           when plan_source = 'google_play' then plan_source
           else coalesce(p_source, plan_source, 'reward')
         end
   where id = p_uid;

  -- Plus mil gaya — sab wapas chaalu/unlock.
  perform public.enforce_plan_limits(p_uid);
end;
$$;

/* ------------------------------------------------------------------ */
/* 6. can_add — server-side limit check (app double-check karti hai)   */
/* ------------------------------------------------------------------ */
create or replace function public.can_add_reminder()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare cnt int;
begin
  if auth.uid() is null then return false; end if;
  if public.is_plus_active(auth.uid()) then return true; end if;
  select count(*) into cnt from public.reminders where user_id = auth.uid();
  return cnt < public.cfg_int('free_reminders', 5);
end;
$$;

create or replace function public.can_add_document()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare cnt int;
begin
  if auth.uid() is null then return false; end if;
  if public.is_plus_active(auth.uid()) then return true; end if;
  select count(*) into cnt from public.documents where user_id = auth.uid();
  return cnt < public.cfg_int('free_documents', 3);
end;
$$;

/* ------------------------------------------------------------------ */
/* 7. Security — grants                                                 */
/* ------------------------------------------------------------------ */
revoke all on function public.enforce_plan_limits(uuid) from public, anon, authenticated;
revoke all on function public.is_plus_active(uuid)      from public, anon, authenticated;
-- ye dono sirf server / doosri functions ke andar se.

revoke all on function public.enforce_my_limits() from public, anon;
revoke all on function public.can_add_reminder()  from public, anon;
revoke all on function public.can_add_document()  from public, anon;
grant execute on function public.enforce_my_limits() to authenticated;
grant execute on function public.can_add_reminder()  to authenticated;
grant execute on function public.can_add_document()  to authenticated;

-- grant_plus_days pehle jaisa hi — sirf service_role.
revoke all on function public.grant_plus_days(uuid, int, text) from public, anon, authenticated;

/* ------------------------------------------------------------------ */
/* 8. Ek baar sabke limits enforce kar do (backfill)                   */
/* ------------------------------------------------------------------ */
do $$
declare u uuid;
begin
  for u in select id from public.profiles loop
    perform public.enforce_plan_limits(u);
  end loop;
end $$;
