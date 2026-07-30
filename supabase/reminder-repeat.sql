-- Roz wala reminder — "gym jana subha 6 baje, 90 din tak".
--
-- Pehle har reminder ek hi baar bajta tha. User "90 din tak" bolta tha, Saathi
-- "theek hai" keh deta tha, aur agle din kuch nahi aata tha — yahi sabse badi
-- shikayat thi.
--
-- Ab teen nayi cheezein:
--
--   repeat_every_days  kitne din baad dobara (1 = roz, 7 = har hafte).
--                      null/0 = ek hi baar wala purana reminder.
--   repeat_until       aakhri din (90 din wali baat). null = jab tak user khud
--                      band na kare.
--   last_done_at       aaj ka "ho gaya".
--
-- ⚠️ `remind_at` ka matlab badal gaya hai: ab wo "AGLI baar kab" hai, "wo ek
-- baar kab" nahi. Har occurrence nikal jaane par (cron bhejne ke baad, ya user
-- ke "ho gaya" kehne par) wo aage sarak jaata hai. Isse pura ladder ek hi row me
-- chalta hai — 90 rows banane ki zaroorat nahi.
--
-- "Done" ek din ka hota hai, poori series ka nahi: aaj gym kar liya to sirf aaj
-- ka reminder chup hoga, kal subah 6 baje phir aayega. Yahi user ne maanga tha.

alter table public.reminders
  add column if not exists repeat_every_days int,
  add column if not exists repeat_until date,
  add column if not exists last_done_at timestamptz;

-- Purane one-shot reminders ko chhua nahi ja raha: unme repeat_every_days null
-- rehta hai, aur neeche ka har function null ko "ek baar" hi maanta hai.

/* ------------------------------------------------------------------ */
/*  Agli baar kab                                                      */
/* ------------------------------------------------------------------ */

-- Ek hi jagah ye hisaab, taaki app, cron aur "done" — teenon ek hi din nikalein.
-- Alag-alag jagah likha hota to ek jagah ka +1 din doosri jagah ke +1 din se
-- kabhi na kabhi hat jaata, aur reminder do baar (ya kabhi nahi) aata.
--
-- `p_after` ke BAAD ka pehla occurrence lautata hai. Series khatam ho gayi
-- (repeat_until nikal gaya) to null.
create or replace function public.reminder_next_at(
  p_from  timestamptz,   -- abhi ka remind_at
  p_every int,           -- kitne din baad
  p_until date,          -- aakhri din (null = koi limit nahi)
  p_after timestamptz default now()
)
returns timestamptz
language plpgsql
-- `stable` (immutable nahi): default argument `now()` par tikka hua hai, aur
-- stable planner ko wahi bharosa deta hai bina kisi surprise ke.
stable
as $$
declare
  v_next timestamptz := p_from;
  v_step interval;
begin
  if p_from is null or p_every is null or p_every < 1 then
    return null;                       -- ek baar wala reminder — koi agli baar nahi
  end if;

  v_step := make_interval(days => p_every);

  -- Aage badhte raho jab tak p_after se aage na nikal jao. Loop isliye (seedha
  -- ceil() se nahi) ki reminder kai din/hafte purana ho sakta hai — jaise user ne
  -- app 3 hafte na kholi ho, ya cron kuch din band raha ho. Dono soorat me agla
  -- occurrence sach me AAGE ka hona chahiye, peeche ka nahi.
  --
  -- 4000 ki chhat sirf ek safety hai (roz wala reminder ~11 saal): kharab data
  -- (jaise p_from 1970 ka) se ye loop kabhi hamesha ke liye na ghume.
  for i in 1..4000 loop
    exit when v_next > p_after;
    v_next := v_next + v_step;
  end loop;

  if v_next <= p_after then
    return null;                       -- itna purana ki bharosa nahi — band karo
  end if;

  -- repeat_until wale din TAK chalta hai (us din bhi bajta hai), uske baad nahi.
  if p_until is not null and v_next::date > p_until then
    return null;
  end if;

  return v_next;
end;
$$;

/* ------------------------------------------------------------------ */
/*  "Aaj ka ho gaya"                                                   */
/* ------------------------------------------------------------------ */

-- App se user ne kaha "ho gaya".
--
--   Roz wala   -> sirf AAJ ka chup; remind_at agle din pe sarak jaata hai aur
--                 notified_at saaf ho jaata hai (warna cron agli baar bhejta hi
--                 nahi — "ek baar bhej diya" samajh ke).
--   Ek baar wala -> poora reminder band (purana vyavhaar, waisa ka waisa).
--
-- Series ka aakhri din nikal gaya to `reminder_next_at` null deta hai, aur
-- reminder chup-chaap band ho jaata hai — user ko 91ve din kuch nahi aayega.
create or replace function public.complete_reminder(p_id uuid)
returns timestamptz            -- agli baar kab (null = series khatam / one-shot)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   public.reminders%rowtype;
  v_next  timestamptz;
begin
  select * into v_row
  from public.reminders
  where id = p_id and user_id = auth.uid();

  if not found then
    return null;
  end if;

  v_next := public.reminder_next_at(
    v_row.remind_at, v_row.repeat_every_days, v_row.repeat_until
  );

  update public.reminders
  set last_done_at = now(),
      remind_at    = coalesce(v_next, remind_at),
      -- Agla occurrence hai to "bhej diya" ka nishaan hatao, warna cron chup
      -- reh jaayega. Series khatam ho gayi to reminder hi off kar do.
      notified_at  = case when v_next is null then notified_at else null end,
      is_on        = case when v_next is null then false else is_on end
  where id = p_id;

  return v_next;
end;
$$;

revoke all on function public.complete_reminder(uuid) from public, anon;
grant execute on function public.complete_reminder(uuid) to authenticated, service_role;

/* ------------------------------------------------------------------ */
/*  Cron bhej chuka — ab agla occurrence                               */
/* ------------------------------------------------------------------ */

-- Email/WhatsApp bhejne ke baad cron isse call karta hai.
--
-- Ek baar wale reminder ke liye ye wahi purana kaam karta hai (notified_at bhar
-- do). Roz wale ke liye remind_at aage sarka deta hai — isi se kal subah 6 baje
-- wapas due ho jaata hai.
--
-- service_role only: user ke JWT se ye nahi chalti, warna koi apne reminder ko
-- "bhej diya" mark karke skip kara sakta tha.
create or replace function public.advance_reminder(p_id uuid, p_sent_at timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  public.reminders%rowtype;
  v_next timestamptz;
begin
  select * into v_row from public.reminders where id = p_id;
  if not found then
    return null;
  end if;

  v_next := public.reminder_next_at(
    v_row.remind_at, v_row.repeat_every_days, v_row.repeat_until, p_sent_at
  );

  update public.reminders
  set notified_at = case when v_next is null then p_sent_at else null end,
      remind_at   = coalesce(v_next, remind_at),
      is_on       = case when v_next is null and v_row.repeat_every_days >= 1
                         then false else is_on end
  where id = p_id;

  return v_next;
end;
$$;

revoke all on function public.advance_reminder(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.advance_reminder(uuid, timestamptz) to service_role;

/* ------------------------------------------------------------------ */
/*  Index                                                             */
/* ------------------------------------------------------------------ */

-- Cron har minute "kaun due hai" poochta hai. Roz wale reminders ke saath ye
-- query ab bahut zyada baar chalti hai, isliye uska apna index.
create index if not exists reminders_due_idx
  on public.reminders (remind_at)
  where is_on and not is_paused and notified_at is null;
