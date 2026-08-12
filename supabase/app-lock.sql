-- Apka Saathi — App lock (PIN) ab ACCOUNT ka hissa hai, sirf phone ka nahi.
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
-- NOTE: pehle locations-billing.sql chala lena (`user_details` wahin banta hai).
--
-- ── Kyun ye badlaav ────────────────────────────────────────────────────────
--
-- Pehle PIN SIRF phone par tha (SecureStore). Wo ek soch thi — "lock ka kaam is
-- PHONE ko rokna hai, account ko nahi" — par wo asal me lock ko dikhawa bana
-- deti thi, aur teen alag raaste se:
--
--   1. App UNINSTALL karke dobara install karo — SecureStore saaf, lock gayab.
--      Usi account se login karo aur saare documents khule mil jaate hain.
--   2. Logout karke wapas login karo — wahi baat. PIN us phone ke us install ka
--      tha, user ka nahi.
--   3. Doosre phone par usi ID se login karo — wahan lock kabhi tha hi nahi.
--
-- Yaani jis cheez se bachne ke liye user ne PIN lagaya tha (koi aur uske
-- documents dekh le), wo teenon raaston se aaram se ho jaata tha.
--
-- Ab lock USER ke saath chalta hai. Jis user ne lock chalu kiya hai, uske
-- account me login karte hi — chahe phone naya ho, app abhi-abhi install hui ho,
-- ya logout karke dobara login kiya ho — PIN maanga jaayega.
--
-- ⚠️ PIN khud kabhi server par nahi jaata. Sirf uska hash (per-user salt ke
-- saath) jaata hai, bilkul waise hi jaise pehle phone par jaata tha. Server ke
-- paas se PIN nikaala nahi ja sakta, sirf milaaya ja sakta hai.

alter table public.user_details
  add column if not exists app_lock_hash text,
  add column if not exists app_lock_salt text,
  add column if not exists app_lock_at timestamptz,
  add column if not exists app_lock_biometric boolean not null default false;

/**
 * Apna lock padho.
 *
 * ⚠️ Hash aur salt DONO app ko wapas jaate hain, aur ye jaan-boojh ke hai.
 * Wajah: PIN ka milaan BINA NET ke bhi chalna chahiye. Flight mode me phone
 * uthate hi lock bekaar ho jaye (ya khul hi na paaye) — dono soorat buri hain.
 * Isliye app login ke baad hash+salt ek baar le ke SecureStore me rakh leti hai
 * aur milaan hamesha local karti hai.
 *
 * Isme koi nayi kamzori nahi hai: ye sirf USI user ko milta hai jiska session
 * pehle se hai, aur jiske paas session hai wo lock band bhi kar sakta hai. Jo
 * cheez rukni thi — "bina PIN jaane documents dekh lena" — wo ab bhi rukti hai,
 * kyunki 4 ank ka hash salt ke saath brute-force karna hi padega aur app usme
 * apni hi rok (5 koshish ke baad badhta intezaar) lagati hai.
 */
create or replace function public.get_app_lock()
returns table (enabled boolean, hash text, salt text, biometric boolean)
language sql security definer set search_path = public stable as $$
  select
    (d.app_lock_hash is not null and d.app_lock_salt is not null) as enabled,
    d.app_lock_hash,
    d.app_lock_salt,
    coalesce(d.app_lock_biometric, false)
  from public.user_details d
  where d.user_id = auth.uid();
$$;

revoke all on function public.get_app_lock() from public, anon;
grant execute on function public.get_app_lock() to authenticated;

/**
 * Lock chalu karo / PIN badlo.
 *
 * Row na ho to bana dete hain — naya user pehle kabhi `user_details` chhoo hi
 * nahi sakta (profile bhare bina PIN lagana bilkul aam hai).
 */
create or replace function public.set_app_lock(p_hash text, p_salt text, p_biometric boolean default false)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  -- Aadha lock (hash ho par salt na ho) kabhi na bane — us haalat me user apne
  -- hi sahi PIN se bahar reh jaata hai aur reset ke alawa koi raasta nahi bachta.
  if coalesce(trim(p_hash), '') = '' or coalesce(trim(p_salt), '') = '' then
    return false;
  end if;

  insert into public.user_details (user_id, app_lock_hash, app_lock_salt, app_lock_at, app_lock_biometric)
  values (auth.uid(), p_hash, p_salt, now(), coalesce(p_biometric, false))
  on conflict (user_id) do update
    set app_lock_hash = excluded.app_lock_hash,
        app_lock_salt = excluded.app_lock_salt,
        app_lock_at = now(),
        app_lock_biometric = excluded.app_lock_biometric,
        updated_at = now();
  return true;
end;
$$;

revoke all on function public.set_app_lock(text, text, boolean) from public, anon;
grant execute on function public.set_app_lock(text, text, boolean) to authenticated;

/** Biometric ka toggle alag — PIN chhuye bina on/off ho sake. */
create or replace function public.set_app_lock_biometric(p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  update public.user_details
     set app_lock_biometric = coalesce(p_on, false),
         updated_at = now()
   where user_id = auth.uid();
  return true;
end;
$$;

revoke all on function public.set_app_lock_biometric(boolean) from public, anon;
grant execute on function public.set_app_lock_biometric(boolean) to authenticated;

/**
 * Lock band karo.
 *
 * ⚠️ Ye sirf tab bulaya jaana chahiye jab user ne app ke ANDAR (lock khulne ke
 * baad) khud band kiya ho. Lock screen se ise bulane ka koi raasta nahi hona
 * chahiye — warna lock ka matlab hi khatam: jiske haath phone lage wo bas wahi
 * button dabata.
 */
create or replace function public.clear_app_lock()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  update public.user_details
     set app_lock_hash = null,
         app_lock_salt = null,
         app_lock_at = null,
         app_lock_biometric = false,
         updated_at = now()
   where user_id = auth.uid();
  return true;
end;
$$;

revoke all on function public.clear_app_lock() from public, anon;
grant execute on function public.clear_app_lock() to authenticated;

/* ─────────────────── PIN bhool gaye — email ka OTP ─────────────────── */

/**
 * PIN reset ka code.
 *
 * ⚠️ Ye alag table hai, `phone_otp` ka dobara istemaal NAHI. Wajah: wahan ki
 * ginti/hadd phone number par bandhi hai (`p_phone` har jagah zaroori hai) aur
 * uska poora matlab "ye number is user ka hai kya" hai. Yahan sawaal doosra hai
 * — "is account ke email tak iski pahunch hai kya". Do alag sawaal ek hi table
 * me daalne se dono ki hadd ek doosre ko kaat-ti hai: phone verify karne wale ko
 * PIN reset rok deta, aur ulta bhi.
 *
 * Code ka sirf HASH rakha jaata hai (pepper ke saath, server par) — bilkul
 * phone wale OTP ki tarah.
 */
create table if not exists public.app_lock_reset (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  tries int not null default 0,
  used_at timestamptz,
  ip text
);

create index if not exists app_lock_reset_user_idx
  on public.app_lock_reset (user_id, created_at desc);

alter table public.app_lock_reset enable row level security;
-- Koi policy nahi = app se bilkul nahi padha/likha ja sakta. Sirf service_role
-- (web ka API route) ise chhoota hai. Ye jaan-boojh ke hai: app apna hi hash
-- padh sake to reset ka koi matlab hi nahi bachta.

/** Har ghante/din ki hadd — ek account par. */
create or replace function public.app_lock_reset_issue(
  p_user uuid,
  p_hash text,
  p_ip text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_last timestamptz;
  v_hour int;
  v_day int;
  v_ttl int := 600;         -- 10 minute
  v_cooldown int := 60;     -- ek code ke baad agla itni der baad
begin
  if p_user is null or coalesce(trim(p_hash), '') = '' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select max(created_at) into v_last
    from public.app_lock_reset where user_id = p_user;

  if v_last is not null and now() - v_last < make_interval(secs => v_cooldown) then
    return jsonb_build_object(
      'status', 'cooldown',
      'retry_after', ceil(extract(epoch from (v_last + make_interval(secs => v_cooldown)) - now()))::int
    );
  end if;

  select count(*) into v_hour from public.app_lock_reset
   where user_id = p_user and created_at > now() - interval '1 hour';
  select count(*) into v_day from public.app_lock_reset
   where user_id = p_user and created_at > now() - interval '1 day';

  -- 3/ghanta aur 8/din. Asli user ko ye kabhi nahi chhoota (wo ek-do code me
  -- kaam nikal leta hai); baar-baar code mangwana hamesha ya to galti hai ya
  -- koshish — aur har code ek email hai, yaani kharcha bhi.
  if v_hour >= 3 or v_day >= 8 then
    return jsonb_build_object('status', 'too_many', 'retry_after', 3600);
  end if;

  -- Purane zinda code bekaar kar do — ek waqt me ek hi code chalna chahiye,
  -- warna user pehla wala daal deta hai aur wo bhi chal jaata hai (jo uljhan
  -- badhata hai aur brute-force ki khidki chaudi karta hai).
  update public.app_lock_reset
     set used_at = now()
   where user_id = p_user and used_at is null;

  insert into public.app_lock_reset (user_id, code_hash, expires_at, ip)
  values (p_user, p_hash, now() + make_interval(secs => v_ttl), p_ip);

  return jsonb_build_object('status', 'ok', 'ttl', v_ttl);
end;
$$;

revoke all on function public.app_lock_reset_issue(uuid, text, text) from public, anon, authenticated;

/**
 * Code jaancho. 'ok' | 'wrong' | 'expired' | 'locked' | 'none'
 *
 * Sahi nikla to wo code wahin khatam ho jaata hai (`used_at`) — ek code, ek
 * baar. Iske bina wahi code 10 minute tak baar-baar chalta rehta.
 */
create or replace function public.app_lock_reset_check(p_user uuid, p_hash text)
returns text language plpgsql security definer set search_path = public as $$
declare
  r public.app_lock_reset%rowtype;
begin
  select * into r from public.app_lock_reset
   where user_id = p_user and used_at is null
   order by created_at desc limit 1;

  if not found then return 'none'; end if;
  if r.expires_at < now() then return 'expired'; end if;
  -- 5 galat koshish ke baad wo code mar jaata hai. 6 ank ko bina is rok ke
  -- 10 minute me poora try kiya ja sakta hai.
  if r.tries >= 5 then return 'locked'; end if;

  if r.code_hash = p_hash then
    update public.app_lock_reset set used_at = now() where id = r.id;
    return 'ok';
  end if;

  update public.app_lock_reset set tries = r.tries + 1 where id = r.id;
  return 'wrong';
end;
$$;

revoke all on function public.app_lock_reset_check(uuid, text) from public, anon, authenticated;

/**
 * Reset ke baad naya PIN — SERVER se likha jaata hai, app se nahi.
 *
 * ⚠️ Yahan `set_app_lock` (jo app ke paas hai) use karna galat hota. Wo
 * `auth.uid()` par chalta hai aur uske liye session chahiye — aur PIN bhoolne
 * wale ke paas session to hai hi (wo lock screen par khada hai). Yaani agar
 * reset ka raasta bhi wahi RPC hota, to app bina koi code verify kiye seedha
 * naya PIN likh sakti thi. Poora email-OTP dikhawa ban jaata.
 *
 * Isliye naya PIN sirf service_role likh sakta hai — yaani sirf wo route jo
 * abhi-abhi `app_lock_reset_check` se 'ok' sun chuka hai.
 */
create or replace function public.admin_set_app_lock(p_user uuid, p_hash text, p_salt text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or coalesce(trim(p_hash), '') = '' or coalesce(trim(p_salt), '') = '' then
    return false;
  end if;
  insert into public.user_details (user_id, app_lock_hash, app_lock_salt, app_lock_at)
  values (p_user, p_hash, p_salt, now())
  on conflict (user_id) do update
    set app_lock_hash = excluded.app_lock_hash,
        app_lock_salt = excluded.app_lock_salt,
        app_lock_at = now(),
        updated_at = now();
  return true;
end;
$$;

revoke all on function public.admin_set_app_lock(uuid, text, text) from public, anon, authenticated;

/* ─────────────────────────── admin ka nazaria ─────────────────────────── */

/**
 * Admin panel ke liye — kis user ne lock lagaya hai.
 *
 * ⚠️ Hash/salt yahan JAAN-BOOJH KE nahi hain. Admin ko ye jaanna chahiye ki
 * lock laga hai ya nahi (support par "main apna PIN bhool gaya" wali call isi se
 * samajh aati hai), par PIN ka hash dekhne ki uski koi zaroorat nahi — aur jo
 * cheez dikhti hai wo kabhi na kabhi leak hoti hai.
 */
create or replace view public.admin_app_locks as
  select
    d.user_id,
    (d.app_lock_hash is not null) as lock_on,
    coalesce(d.app_lock_biometric, false) as biometric_on,
    d.app_lock_at
  from public.user_details d;

revoke all on public.admin_app_locks from public, anon, authenticated;

/**
 * `admin_user_detail` me lock ki haalat bhi.
 *
 * ⚠️ Poora function dobara likha ja raha hai — Postgres me ek jsonb field jodne
 * ka koi "alter" nahi hota. Ye is repo ka pehle se chalta hua tarika hai
 * (`remove-launch-offer.sql` bhi isi ko dobara likhta hai). Kal ko koi aur field
 * jodni ho to poora block yahan se copy karna, warna neeche wali koi cheez
 * chup-chaap gir jaayegi.
 */
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
    -- App lock: sirf HAALAT, hash/salt kabhi nahi (upar `admin_app_locks` par
    -- poori wajah likhi hai).
    'app_lock', (
      select jsonb_build_object(
        'on',        (d.app_lock_hash is not null),
        'biometric', coalesce(d.app_lock_biometric, false),
        'at',        d.app_lock_at
      )
      from public.user_details d where d.user_id = p.id
    ),
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
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',          d.id,
        'name',        d.name,
        'type',        d.type,
        'expiry',      d.expiry,
        'file_size',   d.file_size,
        'in_storage',  (d.file_path is not null),
        'file_path',   d.file_path,
        'mime_type',   d.mime_type,
        'created_at',  d.created_at
      ) order by d.created_at desc)
      from public.documents d where d.user_id = p.id
    ), '[]'::jsonb),
    'documents_count', (select count(*) from public.documents d where d.user_id = p.id),
    'storage_bytes',   (select coalesce(sum(d.file_size), 0) from public.documents d where d.user_id = p.id)
  ) into res
  from public.profiles p where p.id = p_uid;

  return res;
end;
$$;
