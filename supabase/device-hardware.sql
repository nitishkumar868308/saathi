-- Apka Saathi — "Ek phone, ek reward" ab sach me (item 2)
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
-- NOTE: pehle devices-analytics.sql aur rewards-referrals.sql chala lena.
--
-- ⚠️ Ye file ek CHHED band karti hai jisse referral ka poora anti-fraud bekaar
-- ho jaata tha.
--
-- Ab tak "ek device" ki pehchaan client par bana ek UUID thi, jo SecureStore me
-- rehta hai. Wo logout/login aur app update se nahi jaata — par app UNINSTALL
-- karne se mit jaata hai. Yaani poora raasta khula tha:
--
--     app hatao → dobara download karo → nayi email se signup karo →
--     apna hi purana referral code daal do → 15 din phir mil gaye. Jitni baar
--     chaaho.
--
-- Server ko har baar ek BILKUL NAYA device dikhta tha. `devices.referral_
-- claimed_at` ki mohar lagti thi ek aisi ID par jo agli baar maujood hi nahi
-- hoti. `no_self_referral` bhi nahi bachata — referee ek NAYA user hota hai,
-- wahi purana nahi.
--
-- Ab do cheezein add ho rahi hain:
--
--   1. `devices.hardware_id` — is PHONE ka nishaan, jo app hatane se nahi jaata
--      (Android: ANDROID_ID, iOS: identifierForVendor). App usse SHA-256 hash
--      karke bhejti hai; asli ID yahan kabhi nahi aati. Reward ki mohar ab is
--      nishaan par bhi dekhi jaati hai, sirf install ke UUID par nahi.
--
--   2. `device_users` — is phone par kaun-kaun log in hua, poori list. Isse
--      "apne hi code se dobara reward" wala raasta seedha band ho jaata hai:
--      code apply hote hi hum poochh lete hain ki jisne code diya hai wo kabhi
--      ISI phone par tha kya.
--
-- Purani ID chhodi nahi ja rahi. Dono saath chalti hain: hardware id na mile
-- (emulator, purana OEM, iOS ka pehla boot) to install id wala raasta waise hi
-- kaam karta rehta hai.
--
-- ⚠️⚠️ CHALANE KA KRAM — ye padh lena, warna referral chup-chaap toot jaayega.
--
-- Ye file `rewards-referrals.sql` aur `devices-analytics.sql` ke purane function
-- DROP karke unki jagah naye (zyada parameter wale) banati hai. Un do files me
-- purane version abhi bhi likhe hue hain, isliye:
--
--     agar aap `rewards-referrals.sql` ya `devices-analytics.sql` DOBARA chalayen,
--     to uske BAAD ye file phir se chalani ZAROORI hai.
--
-- Warna purana aur naya version ek saath maujood ho jaate hain, aur Postgres
-- named-argument wali call ko "function is not unique" keh ke mana kar deta hai —
-- yaani app se referral code lagna hi band ho jaata hai. Ye SQL dobara chalana
-- hamesha surakshit hai.

/* ------------------------------------------------------------------ */
/* 1. Columns                                                          */
/* ------------------------------------------------------------------ */

alter table public.devices add column if not exists hardware_id text;

-- Har reward-check is column par ek exists() chalata hai — index zaroori hai.
create index if not exists devices_hardware_idx on public.devices(hardware_id);

/* ------------------------------------------------------------------ */
/* 2. Is phone par kaun-kaun tha                                       */
/* ------------------------------------------------------------------ */
--
-- ⚠️ `devices` me sirf `first_user_id` aur `last_user_id` hain. Teen log ek phone
-- par login karein to beech wala kahin darj hi nahi hota — aur referral fraud
-- theek wahi beech wala ho sakta hai. Isliye poori list alag rakhte hain.
--
-- Yahan hardware_id bhi copy hota hai: install ka UUID reinstall par badal jaata
-- hai, par is table ki purani rows apne hardware_id ke saath padi rehti hain, aur
-- unse "ye banda is phone par pehle tha" ka jawab mil jaata hai.

create table if not exists public.device_users (
  device_id text not null,
  user_id   uuid not null references auth.users(id) on delete cascade,
  hardware_id text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  primary key (device_id, user_id)
);

create index if not exists device_users_user_idx on public.device_users(user_id);
create index if not exists device_users_hw_idx   on public.device_users(hardware_id);

alter table public.device_users enable row level security;
-- Koi direct access nahi — sirf neeche wali security-definer functions.

/* ------------------------------------------------------------------ */
/* 3. device_seen — ab hardware_id bhi                                 */
/* ------------------------------------------------------------------ */
--
-- ⚠️ Purana 4-arg version DROP karna zaroori hai. Naya 5-arg version ka aakhri
-- parameter default rakhta hai, aur dono ek saath rehne par 4 named argument
-- wali call AMBIGUOUS ho jaati hai — Postgres saaf mana kar deta hai. Wahi galti
-- `grant_plus_days` me pehle ho chuki hai.
--
-- Purane app builds (jo 4 argument bhejte hain) is naye version par apne aap
-- chali jaati hain, p_hardware_id null ke saath.
drop function if exists public.device_seen(text, text, text, text);

create or replace function public.device_seen(
  p_id text,
  p_fingerprint text default null,
  p_platform text default null,
  p_language text default null,
  p_hardware_id text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare existed boolean; row_lang text; hw text;
begin
  if p_id is null or length(trim(p_id)) < 8 then
    return jsonb_build_object('known', false, 'language', null);
  end if;

  -- Khaali string ko ID mat maano — warna sab khaali wale ek hi phone lagte.
  hw := nullif(trim(coalesce(p_hardware_id, '')), '');

  select true, language into existed, row_lang
    from public.devices where id = p_id;

  /**
   * "Pehle dekha hua hai kya" — ab do tarah se.
   *
   * ⚠️ Sirf install-id se poochna hi wo cheez thi jiske kaaron reinstall ke baad
   * app khud ko naya phone samajh leti thi (aur language-select dobara dikhata
   * tha). Hardware ka nishaan mil jaye to wo bhi "haan, dekha hua hai" hai.
   */
  if not coalesce(existed, false) and hw is not null then
    select true, d.language into existed, row_lang
      from public.devices d
     where d.hardware_id = hw
     order by d.last_seen_at desc
     limit 1;
  end if;

  insert into public.devices (
    id, fingerprint, platform, language, hardware_id, last_user_id, last_seen_at
  )
  values (p_id, p_fingerprint, p_platform, p_language, hw, auth.uid(), now())
  on conflict (id) do update
    set last_seen_at = now(),
        fingerprint  = coalesce(excluded.fingerprint, public.devices.fingerprint),
        platform     = coalesce(excluded.platform, public.devices.platform),
        -- Bhasha tabhi badlo jab caller ne bheji ho (warna purani hi rehne do).
        language     = coalesce(excluded.language, public.devices.language),
        -- Ek baar mila hardware nishaan mat mitao: agli call kisi purane app
        -- build se aa sakti hai jo use bhejti hi nahi.
        hardware_id  = coalesce(excluded.hardware_id, public.devices.hardware_id),
        last_user_id = coalesce(auth.uid(), public.devices.last_user_id),
        first_user_id = coalesce(public.devices.first_user_id, auth.uid());

  -- Login ho chuka hai to is phone ki "kaun-kaun tha" list me naam likh do.
  if auth.uid() is not null then
    insert into public.device_users (device_id, user_id, hardware_id)
    values (p_id, auth.uid(), hw)
    on conflict (device_id, user_id) do update
      set last_seen_at = now(),
          hardware_id  = coalesce(excluded.hardware_id, public.device_users.hardware_id);
  end if;

  return jsonb_build_object(
    'known', coalesce(existed, false),
    'language', coalesce(p_language, row_lang)
  );
end;
$$;

revoke all on function public.device_seen(text, text, text, text, text) from public;
grant execute on function public.device_seen(text, text, text, text, text) to anon, authenticated;

/* ------------------------------------------------------------------ */
/* 4. Ye banda pehle bhi is phone par tha?                             */
/* ------------------------------------------------------------------ */
/**
 * Referral fraud ka asli sawaal, ek jagah.
 *
 * `p_uid` (jisne code diya) kabhi is phone par login hua tha? Teen jagah
 * dekhte hain, kyunki teenon me se koi ek hi bach jaana kaafi hai:
 *
 *   • device_users — poori list (sabse bharosemand)
 *   • devices.first_user_id / last_user_id — purana data, jab device_users nahi
 *     tha. Iske bina wo saare phone chhoot jaate jo is SQL se pehle ke hain.
 *
 * Aur "is phone" ka matlab dono ID se: install ka UUID AUR hardware ka nishaan.
 */
create or replace function public.user_seen_on_device(
  p_uid uuid,
  p_device_id text,
  p_hardware_id text
)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.device_users du
     where du.user_id = p_uid
       and (
         (p_device_id is not null and du.device_id = p_device_id)
         or (p_hardware_id is not null and du.hardware_id = p_hardware_id)
       )
  ) or exists (
    select 1 from public.devices d
     where (d.first_user_id = p_uid or d.last_user_id = p_uid)
       and (
         (p_device_id is not null and d.id = p_device_id)
         or (p_hardware_id is not null and d.hardware_id = p_hardware_id)
       )
  );
$$;

revoke all on function public.user_seen_on_device(uuid, text, text) from public, anon, authenticated;
-- Sirf neeche wali functions ke andar se (security definer chain).

/* ------------------------------------------------------------------ */
/* 5. apply_referral_code — apne hi code par rok                        */
/* ------------------------------------------------------------------ */
--
-- ⚠️ Yahi wo jagah hai jahan fraud ko ROKNA chahiye, reward ke waqt nahi. Reward
-- to bahut baad me milta hai (document + reminder ke baad), aur tab tak user ko
-- lagta rehta hai ki uska 15 din pakka hai. "Ye code isi phone ka hai" wali baat
-- code daalte hi keh dena imaandaar bhi hai aur saaf bhi.
--
-- Purana 1-arg version drop — warna naye 3-arg (2 default wale) ke saath
-- `apply_referral_code(p_code => '...')` ambiguous ho jaata. Purane app builds
-- naye version par apne aap chale jaate hain.
drop function if exists public.apply_referral_code(text);

create or replace function public.apply_referral_code(
  p_code text,
  p_device_id text default null,
  p_hardware_id text default null
)
returns text language plpgsql security definer set search_path = public as $$
declare ref_id uuid; dev text; hw text;
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

  dev := nullif(trim(coalesce(p_device_id, '')), '');
  hw  := nullif(trim(coalesce(p_hardware_id, '')), '');

  /**
   * Jisne code diya hai wo ISI phone par tha — matlab ye "kisi dost ko bulana"
   * nahi, ek hi aadmi do account chala raha hai.
   *
   * Ye check `no_self_referral` se poori tarah alag hai. Wo sirf "same user id"
   * pakadta hai, aur is fraud me referee ek BILKUL NAYA user hota hai — wahi
   * poora point hai. Pehchaan phone se hoti hai, account se nahi.
   */
  if (dev is not null or hw is not null)
     and public.user_seen_on_device(ref_id, dev, hw) then
    return 'same_device';
  end if;

  insert into public.referrals (referrer_id, referee_id, code)
  values (ref_id, auth.uid(), upper(trim(p_code)));
  update public.profiles set referred_by = ref_id where id = auth.uid();
  return 'applied';
end;
$$;

revoke all on function public.apply_referral_code(text, text, text) from public, anon;
grant execute on function public.apply_referral_code(text, text, text) to authenticated;

/* ------------------------------------------------------------------ */
/* 6. check_referral_qualification — mohar ab phone par                */
/* ------------------------------------------------------------------ */
--
-- Purana 1-arg version drop (wahi ambiguity ki wajah). 0-arg version rehta hai
-- aur wo bilkul purane app builds ke liye hai; usme device ka koi check nahi hota,
-- isliye wo raasta ab bhi kamzor hai — par wo build ab kuch bhej hi nahi sakta.
drop function if exists public.check_referral_qualification(text);

create or replace function public.check_referral_qualification(
  p_device_id text,
  p_hardware_id text default null
)
returns text language plpgsql security definer set search_path = public as $$
declare r record; days int; earned int; dev text; hw text;
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

  dev := nullif(trim(coalesce(p_device_id, '')), '');
  hw  := nullif(trim(coalesce(p_hardware_id, '')), '');
  if dev is not null and length(dev) < 8 then dev := null; end if;

  /**
   * Anti-fraud 2: jisne code diya wo isi phone par tha?
   *
   * Ye check `apply_referral_code` me pehle hi lag chuka hai, par wahan wo tabhi
   * lagta hai jab code NAYE app se daala gaya ho. Purana build (ya koi seedha
   * REST call) bina device bheje code apply kar sakta hai — aur paisa yahan
   * banta hai, isliye darwaza yahan bhi band hona chahiye. Ek hi jagah ka check
   * kabhi kaafi nahi hota jab doosri jagah se skip kiya ja sake.
   */
  if (dev is not null or hw is not null)
     and public.user_seen_on_device(r.referrer_id, dev, hw) then
    return 'same_device';
  end if;

  /**
   * Anti-fraud 3: is PHONE se pehle hi reward liya ja chuka hai?
   *
   * ⚠️ Yahi wo check tha jo pehle sirf install-id par lagta tha — aur isliye
   * bekaar tha. Uninstall ke baad install id nayi ban jaati hai, to purani mohar
   * kisi aisi row par padi reh jaati thi jo dobara kabhi dekhi hi nahi jaati.
   * Hardware ka nishaan uninstall se nahi badalta, isliye ab mohar sach me phone
   * par lagti hai.
   */
  if hw is not null and exists (
    select 1 from public.devices
     where hardware_id = hw and referral_claimed_at is not null
  ) then
    return 'device_already_rewarded';
  end if;

  if dev is not null and exists (
    select 1 from public.devices
     where id = dev and referral_claimed_at is not null
  ) then
    return 'device_already_rewarded';
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

  -- Device par mohar lagao — ab isse dobara reward nahi milega. hardware_id bhi
  -- likhte hain, warna reinstall ke baad ye row hardware se dhoondhi hi na jaaye.
  if dev is not null then
    insert into public.devices (id, hardware_id, referral_claimed_at, last_user_id)
    values (dev, hw, now(), auth.uid())
    on conflict (id) do update
      set referral_claimed_at = coalesce(public.devices.referral_claimed_at, now()),
          hardware_id = coalesce(excluded.hardware_id, public.devices.hardware_id),
          last_user_id = auth.uid();
  elsif hw is not null then
    -- Install id na mile (bahut kam hota hai) to bhi mohar kahin lagni chahiye.
    update public.devices set referral_claimed_at = coalesce(referral_claimed_at, now())
     where hardware_id = hw;
  end if;

  return 'rewarded';
end;
$$;

-- Purana 0-arg version naye wale ko null device ke saath call karta hai.
create or replace function public.check_referral_qualification()
returns text language plpgsql security definer set search_path = public as $$
begin
  return public.check_referral_qualification(null::text, null::text);
end;
$$;

revoke all on function public.check_referral_qualification(text, text) from public, anon;
grant execute on function public.check_referral_qualification(text, text) to authenticated;
revoke all on function public.check_referral_qualification() from public, anon;
grant execute on function public.check_referral_qualification() to authenticated;

/* ------------------------------------------------------------------ */
/* 7. Backfill — purane phone bhi list me aa jayein                    */
/* ------------------------------------------------------------------ */
--
-- `device_users` aaj bana hai, par `devices` me pehle se do naam pade hain
-- (first_user_id / last_user_id). Unhe list me daal dete hain, warna is SQL se
-- pehle ka koi bhi phone "kaun-kaun tha" wale check me kabhi nahi milega.
insert into public.device_users (device_id, user_id, hardware_id, first_seen_at, last_seen_at)
select d.id, u.uid, d.hardware_id, d.created_at, d.last_seen_at
  from public.devices d
  cross join lateral (
    select d.first_user_id as uid where d.first_user_id is not null
    union
    select d.last_user_id  as uid where d.last_user_id  is not null
  ) u
on conflict (device_id, user_id) do nothing;
