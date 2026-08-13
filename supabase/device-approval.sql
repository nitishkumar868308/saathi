-- Apka Saathi — "Naya phone? Pehle email par code."
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
--
-- NOTE: pehle ye chala lena —
--   devices-analytics.sql   (`devices` table wahin banti hai)
--   device-tokens.sql       (`device_tokens` wahin banti hai)
--   profiles.sql
--
-- ── Ye kyun chahiye tha ────────────────────────────────────────────────────
--
-- `device-owner.sql` aur `device-multi-login.sql` ne ye baat KEH to di thi ki
-- "ek account, kai phone" me cheezein tootti hain — par unhone kuch THEEK nahi
-- kiya. Dono sirf chetavni hain. Aur teen cheezein aaj bhi chup-chaap tootti
-- hain, bina kisi error ke:
--
--   • Reminder ke alarm phone ke ANDAR lagte hain (notifee). Naye phone par wo
--     tab tak lagte hi nahi jab tak app khule; purane phone par purane alarm
--     bajte rehte hain. Ek reminder do phone par do alag waqt par baj sakta hai.
--   • FCM token phone ka hota hai, user ka nahi. Do phone logged-in rahen to
--     admin ka message dono par jaata hai.
--   • Purana phone bech diya gaya ho tab bhi uspar saare documents khule pade
--     rehte hain.
--
-- Ab ek waqt me EK phone "active" hota hai. Baaki phone par app chalti hai aur
-- data bhi dikhta hai — sirf notification aur alarm nahi lagte, aur app saaf
-- keh deti hai ki kyun.
--
-- ⚠️ Ye LOGIN ki rok NAHI hai, aur ye jaan-boojh ke hai. Login rok dene par
-- jiska email access chala gaya ho wo apne hi documents se hamesha ke liye bahar
-- ho jaata. Jo cheez sach me tootti hai (alarm/notification) sirf wahi ruki hai.

/* ================================================================== */
/*  1. devices — "ye phone kiske liye active hai"                     */
/* ================================================================== */

alter table public.devices
  add column if not exists approved_user_id uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  -- 'first' = pehla phone (apne aap), 'otp' = email code se, 'admin' = support ne kiya
  add column if not exists approved_via text;

/**
 * ⚠️ YE INDEX IS POORE FEATURE KI REEDH HAI.
 *
 * "Ek waqt me ek hi active phone" ka waada CODE se nibhana namumkin hai. Do
 * phone par ek saath OTP verify ho jaye (ya user do baar tap kar de) to do
 * parallel transaction dono ko active kar dengi — aur wo bug kabhi dobara
 * banaya nahi ja sakta, isliye kabhi pakda bhi nahi jaayega.
 *
 * Partial unique index se wo soorat BAN hi nahi sakti: doosri transaction DB par
 * hi fail ho jaati hai. Ise kabhi hataana mat.
 */
create unique index if not exists devices_one_active_per_user
  on public.devices (approved_user_id)
  where approved_user_id is not null;

/**
 * ── Purane users ke liye (ek baar chalta hai) ──────────────────────────────
 *
 * ⚠️ Ye is poori file ka sabse nazuk hissa hai. Iske BINA: jo log aaj chal rahe
 * hain unke kisi device par `approved_user_id` nahi hoga, yaani SAB ek saath
 * "inactive" ho jayenge aur SABKE reminder ek saath band ho jayenge. Wo is
 * feature ki sabse mehngi galti hoti.
 *
 * Isliye har user ka sabse HAAL me dikha device apne aap approve kar dete hain.
 * Unke liye kuch nahi badlega — koi patti nahi, koi code nahi.
 *
 * `not exists` wali shart isse dobara-run par surakshit banati hai: jiska ek
 * device pehle se approved hai, uspar ye kuch nahi karta.
 */
with latest as (
  select distinct on (last_user_id) id, last_user_id
    from public.devices
   where last_user_id is not null
   order by last_user_id, last_seen_at desc
)
update public.devices d
   set approved_user_id = l.last_user_id,
       approved_at      = now(),
       approved_via     = 'first'
  from latest l
 where d.id = l.id
   and d.approved_user_id is null
   and not exists (
     select 1 from public.devices x where x.approved_user_id = l.last_user_id
   );

/* ================================================================== */
/*  2. device_tokens ko device se jodo                                */
/* ================================================================== */

/**
 * ⚠️ Bina iske poora feature adhoora hai.
 *
 * `device_tokens` ab tak sirf `token` aur `user_id` rakhti thi. Iska matlab tha
 * ki "purane phone ka token hata do" karna NAMUMKIN tha — kisi ko pata hi nahi
 * chalta ki kaun sa token kis phone ka hai. Yaani naya phone active karne ke
 * baad bhi purane phone par notification aati rehti.
 */
alter table public.device_tokens
  add column if not exists device_id text;

create index if not exists device_tokens_device_idx
  on public.device_tokens (user_id, device_id);

/**
 * Token upsert — ab device id ke saath.
 *
 * ⚠️ Purana 2-parameter wala version DROP karna zaroori hai. Sirf naya banane
 * par Postgres do overload dekhta hai aur 2-argument wali call par
 * "function is not unique" keh ke mana kar deta — yaani har purane app build ka
 * token save hona BAND ho jaata.
 *
 * `p_device_id` ka default null isliye hai ki purane app build (jo teesra
 * parameter bhejte hi nahi) chalte rahen. PostgREST naam se parameter bhejta
 * hai, isliye 2-key wala body is function par theek resolve hota hai.
 */
drop function if exists public.save_device_token(text, text);

create or replace function public.save_device_token(
  p_token text,
  p_platform text,
  p_device_id text default null
)
returns void language sql security definer set search_path = public as $$
  insert into public.device_tokens (token, user_id, platform, device_id, updated_at)
  values (p_token, auth.uid(), p_platform, p_device_id, now())
  on conflict (token) do update
    set user_id    = auth.uid(),
        platform   = excluded.platform,
        -- Purane build null bhejte hain — us par pehle se likhi hui device id
        -- mitani nahi chahiye.
        device_id  = coalesce(excluded.device_id, public.device_tokens.device_id),
        updated_at = now();
$$;

revoke all on function public.save_device_token(text, text, text) from public, anon;
grant execute on function public.save_device_token(text, text, text) to authenticated;

/**
 * Logout par apne is phone ka token hata do.
 *
 * ⚠️ Ye audit me pakda gaya tha aur akela bhi ek asli bug hai: `signOut()` ab
 * tak sirf local lock bhoolta tha aur session hataata tha. Token ki row par
 * purana `user_id` pada rehta tha — yaani LOGOUT KE BAAD BHI us phone par us
 * user ke reminder aur admin ke message aate rehte the. Bech diya hua ya udhaar
 * diya hua phone iska sabse bura roop hai.
 */
create or replace function public.forget_my_device_tokens(p_device_id text)
returns void language sql security definer set search_path = public as $$
  delete from public.device_tokens
   where user_id = auth.uid()
     and p_device_id is not null
     and device_id = p_device_id;
$$;

revoke all on function public.forget_my_device_tokens(text) from public, anon;
grant execute on function public.forget_my_device_tokens(text) to authenticated;

/* ================================================================== */
/*  3. Email code ka khaata                                           */
/* ================================================================== */

/**
 * Bilkul `app_lock_reset` (app-lock.sql) ka dhaancha — jaan-boojh ke.
 *
 * Wo pehle se chal raha hai aur uske cooldown / per-hour / per-day / tries sab
 * asli use me tay ho chuke hain. Yahan naya hisaab banana matlab wahi saari
 * galtiyan dobara karna.
 */
create table if not exists public.device_approval (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Kis device ke liye code maanga gaya. Code sirf USI device par chalega.
  device_id text not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  tries int not null default 0,
  used_at timestamptz,
  ip text
);

create index if not exists device_approval_user_idx
  on public.device_approval (user_id, created_at desc);

alter table public.device_approval enable row level security;
-- Koi policy nahi = app se bilkul nahi padha/likha ja sakta. Sirf service_role
-- (web ka API route). App apna hi code hash padh sake to poora OTP dikhawa hai.

/* ================================================================== */
/* 4. Active karne ka ek hi raasta                                    */
/* ================================================================== */

/**
 * Ek device active karo, baaki sab utaar do.
 *
 * ⚠️ Teen kaam EK saath hone chahiye, warna beech ki haalat sabse buri hoti hai:
 * purana phone bhi active aur naya bhi (do jagah notification), ya dono inactive
 * (kahin notification nahi). Isliye ek hi function, ek hi transaction.
 *
 * ⚠️ Purane device ka FCM token DELETE hota hai, sirf inactive nishaan nahi.
 * Wajah: token zinda rahe to admin ka broadcast (jo seedha `device_tokens` se
 * bhejta hai) usi phone par jaata rahega, chahe hum kitne bhi flag laga dein.
 *
 * `security definer` + sirf service_role/andar se — app ise seedha nahi bula
 * sakti, warna koi bhi apna device active kar leta bina code ke.
 */
create or replace function public.activate_device(
  p_user uuid,
  p_device text,
  p_via text
)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or coalesce(trim(p_device), '') = '' then
    return false;
  end if;

  -- 1. Baaki sab phone utaar do (ye pehle — warna unique index takra jaayega).
  update public.devices
     set approved_user_id = null,
         approved_via     = null
   where approved_user_id = p_user
     and id is distinct from p_device;

  /**
   * 2. Un utare hue phones ke notification token hata do.
   *
   * ⚠️ `device_id is null` wale bhi jaate hain, aur ye soch-samajh kar hai. Wo
   * purane app build ke token hain jo device id bhejte hi nahi the — yaani hum
   * SAABIT nahi kar sakte ki wo is naye phone ke hain. Do me se ek galti chunni
   * thi:
   *
   *   • rakh lo  → purana phone (jo shayad bech diya gaya hai) notification
   *                paata rahega. Yahi wo bug hai jiske liye ye poori file hai.
   *   • hata do  → agar wo token sach me isi phone ka tha, to notification tab
   *                tak band jab tak app dobara na khule.
   *
   * Doosri galti apne aap theek ho jaati hai (`push.ts` har app-open par token
   * dobara save karta hai), pehli kabhi nahi. Isliye hata dete hain.
   */
  delete from public.device_tokens
   where user_id = p_user
     and (device_id is null or device_id is distinct from p_device);

  -- 3. Ab ye wala chadha do.
  update public.devices
     set approved_user_id = p_user,
         approved_at      = now(),
         approved_via     = coalesce(p_via, 'otp')
   where id = p_device;

  return found;
end;
$$;

revoke all on function public.activate_device(uuid, text, text)
  from public, anon, authenticated;


/* ================================================================== */
/* 5. App ke liye (authenticated)                                     */
/* ================================================================== */

/**
 * "Mera ye phone active hai?"
 *
 * Lautata hai:
 *   active          — is phone par notification/alarm chalne chahiye
 *   needs_approval  — user ka koi DOOSRA phone active hai, ye nahi
 *   other           — us doosre phone ki jhalak (platform + kab dikha). Koi id
 *                     nahi — wahi ek cheez hai jisse doosre phone ko pehchana
 *                     ja sake.
 *
 * ⚠️ Dono false ho sakte hain: user ka koi bhi device active na ho (naya
 * signup, ya migration se pehle). Us soorat me app `claim_device_if_free`
 * chalati hai aur ye phone apne aap active ho jaata hai.
 */
create or replace function public.my_device_state(p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_active_id text;
  v_other jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('active', false, 'needs_approval', false);
  end if;

  select id into v_active_id
    from public.devices where approved_user_id = auth.uid();

  if v_active_id is not null and v_active_id = p_id then
    return jsonb_build_object('active', true, 'needs_approval', false);
  end if;

  if v_active_id is null then
    -- Koi bhi phone active nahi — ye rok ka mamla hai hi nahi.
    return jsonb_build_object('active', false, 'needs_approval', false);
  end if;

  select jsonb_build_object('platform', platform, 'last_seen_at', last_seen_at)
    into v_other
    from public.devices where id = v_active_id;

  return jsonb_build_object('active', false, 'needs_approval', true, 'other', v_other);
end;
$$;

revoke all on function public.my_device_state(text) from public, anon;
grant execute on function public.my_device_state(text) to authenticated;

/**
 * "Kisi ka ghar khaali hai to isme rehne do."
 *
 * User ka koi bhi active device na ho to ye wala apne aap active ho jaata hai —
 * bina kisi code ke. Yahi wo raasta hai jisse naya user pehle din email-OTP ki
 * deewar se nahi takraata.
 *
 * ⚠️ `on conflict do nothing` par bharosa nahi kar sakte (ye update hai, insert
 * nahi), isliye race ko `exception` se pakadte hain: do phone ek saath ye chala
 * dein to unique index doosre ko rok dega, aur wo `false` sun ke aage OTP wale
 * raaste par chala jaayega — jo bilkul sahi vyavhaar hai.
 */
create or replace function public.claim_device_if_free(p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce(trim(p_id), '') = '' then
    return false;
  end if;

  -- Mera pehle se koi active phone hai? Tab ye OTP wala mamla hai, ye nahi.
  if exists (select 1 from public.devices where approved_user_id = auth.uid()) then
    return false;
  end if;

  -- Device row honi chahiye (`device_seen` banata hai, login se pehle hi).
  if not exists (select 1 from public.devices where id = p_id) then
    return false;
  end if;

  /**
   * ⚠️ Yahan pehle `and approved_user_id is null` wali shart thi, aur wo ek
   * chup-chaap fail thi — is poore feature ki sabse buri soorat.
   *
   * Soch ye thi ki "khaali ghar hi lo". Par ek bahut aam soorat me wo ghar
   * khaali nahi hota: EK HI PHONE par pehle koi aur tha. A ne login kiya (row
   * A ke naam ho gayi), A logout hua, ab B login karta hai. B ka apna koi active
   * phone nahi hai, isliye `my_device_state` `needs_approval: false` kehta hai —
   * yaani B ko patti bhi nahi dikhti. Aur update `approved_user_id is null` par
   * atak jaata tha, isliye B kabhi active bhi nahi hota.
   *
   * Natija: B ke reminder chup, koi alarm nahi, koi notification nahi, aur
   * screen par ek shabd bhi nahi. Bilkul wahi bug jiske liye ye file likhi gayi.
   *
   * Ab `activate_device` chalta hai, jo takeover sambhalta hai. Ye surakshit
   * hai: rok "ek USER ka ek phone" hai, "ek phone ka ek user" nahi. Aur jo phone
   * physically B ke haath me hai aur jispar B logged in hai, uske notification
   * B ke paas hi jaane chahiye — A ke paas ab wo phone hai hi nahi.
   *
   * Bonus: `activate_device` A ke purane token bhi is phone se hata deta hai.
   */
  return public.activate_device(auth.uid(), p_id, 'first');
exception
  when unique_violation then
    -- Doosra phone ek pal pehle jeet gaya. Ye sahi hai, error nahi.
    return false;
end;
$$;

revoke all on function public.claim_device_if_free(text) from public, anon;
grant execute on function public.claim_device_if_free(text) to authenticated;

/* ================================================================== */
/* 6. Server ke liye (service_role) — code ka lena-dena               */
/* ================================================================== */

/** Har ghante/din ki hadd — ek account par. app_lock_reset_issue ka jodidaar. */
create or replace function public.device_approval_issue(
  p_user uuid,
  p_device text,
  p_hash text,
  p_ip text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_last timestamptz;
  v_hour int;
  v_day int;
  v_ttl int := 600;         -- 10 minute
  v_cooldown int := 60;
begin
  if p_user is null
     or coalesce(trim(p_device), '') = ''
     or coalesce(trim(p_hash), '') = '' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select max(created_at) into v_last
    from public.device_approval where user_id = p_user;

  if v_last is not null and now() - v_last < make_interval(secs => v_cooldown) then
    return jsonb_build_object(
      'status', 'cooldown',
      'retry_after', ceil(extract(epoch from (v_last + make_interval(secs => v_cooldown)) - now()))::int
    );
  end if;

  select count(*) into v_hour from public.device_approval
   where user_id = p_user and created_at > now() - interval '1 hour';
  select count(*) into v_day from public.device_approval
   where user_id = p_user and created_at > now() - interval '1 day';

  -- 3/ghanta, 8/din — wahi hadd jo PIN reset par hai. Asli user ko ye kabhi
  -- nahi chhoota; har code ek email hai, yaani kharcha bhi.
  if v_hour >= 3 or v_day >= 8 then
    return jsonb_build_object('status', 'too_many', 'retry_after', 3600);
  end if;

  -- Ek waqt me ek hi zinda code.
  update public.device_approval
     set used_at = now()
   where user_id = p_user and used_at is null;

  insert into public.device_approval (user_id, device_id, code_hash, expires_at, ip)
  values (p_user, p_device, p_hash, now() + make_interval(secs => v_ttl), p_ip);

  return jsonb_build_object('status', 'ok', 'ttl', v_ttl);
end;
$$;

revoke all on function public.device_approval_issue(uuid, text, text, text)
  from public, anon, authenticated;

/**
 * Code jaancho AUR usi call me device active kar do.
 *
 * ⚠️ Ye do call me BAANTNA mat. Doosri call ke paas apna koi saboot nahi hota ki
 * code verify ho chuka tha — app seedha doosri maar ke bina kisi code ke apna
 * device active kar leti, aur poora email-OTP ek dikhawa reh jaata. Yahi galti
 * `app-lock-reset.ts` me pehle pakdi ja chuki hai; wahan bhi jaanch aur likhna
 * ek hi call me hai.
 *
 * Lautata hai: 'ok' | 'wrong' | 'expired' | 'locked' | 'none' | 'other_device'
 *
 * 'other_device' = code kisi aur phone ke liye maanga gaya tha. Bina is jaanch
 * ke ek phone par maanga hua code doosre phone par chal jaata.
 */
create or replace function public.device_approval_check(
  p_user uuid,
  p_device text,
  p_hash text
)
returns text language plpgsql security definer set search_path = public as $$
declare
  r public.device_approval%rowtype;
begin
  select * into r from public.device_approval
   where user_id = p_user and used_at is null
   order by created_at desc limit 1;

  if not found then return 'none'; end if;
  if r.expires_at < now() then return 'expired'; end if;
  -- 5 galat koshish ke baad wo code mar jaata hai. 6 ank bina is rok ke 10
  -- minute me poore try kiye ja sakte hain.
  if r.tries >= 5 then return 'locked'; end if;
  if r.device_id is distinct from p_device then return 'other_device'; end if;

  if r.code_hash is distinct from p_hash then
    update public.device_approval set tries = r.tries + 1 where id = r.id;
    return 'wrong';
  end if;

  update public.device_approval set used_at = now() where id = r.id;
  perform public.activate_device(p_user, p_device, 'otp');
  return 'ok';
end;
$$;

revoke all on function public.device_approval_check(uuid, text, text)
  from public, anon, authenticated;

/* ================================================================== */
/*  7. Admin panel                                                    */
/* ================================================================== */

/**
 * Ek user ke saare phone.
 *
 * ⚠️ Hardware id yahan NAHI hai aur ho bhi nahi sakti — wo asli id kabhi server
 * par jaati hi nahi (sirf uska salted hash), aur wo hash bhi admin ke kaam ka
 * nahi. Admin ko support par ye chahiye hota hai: kitne phone hain, kis tarah ke
 * hain, kab se hain — utna hi yahan hai.
 */
create or replace function public.admin_device_list(
  p_uid uuid default null,
  p_q text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  v_rows jsonb;
  v_total int;
  v_q text := nullif(trim(coalesce(p_q, '')), '');
  v_lim int := greatest(1, least(coalesce(p_limit, 50), 200));
begin
  /**
   * Device ka "maalik" = wo user jo abhi ise chala raha hai (`last_user_id`).
   * `first_user_id` alag column hai (kisne SABSE PEHLE is phone par login kiya)
   * aur wo bhi dikhta hai — support par yahi do milke poori kahani batate hain:
   * "ye phone pehle Ramesh ka tha, ab Suresh chala raha hai".
   */
  with base as (
    select d.*,
           coalesce(d.last_user_id, d.approved_user_id, d.first_user_id) as owner_id
      from public.devices d
     where (p_uid is null
            or d.last_user_id = p_uid
            or d.first_user_id = p_uid
            or d.approved_user_id = p_uid)
  ),
  joined as (
    select b.*, p.full_name, p.email
      from base b
      left join public.profiles p on p.id = b.owner_id
     where v_q is null
        or p.email ilike '%' || v_q || '%'
        or p.full_name ilike '%' || v_q || '%'
        or b.id ilike '%' || v_q || '%'
        or b.fingerprint ilike '%' || v_q || '%'
  )
  /**
   * ⚠️ `total` `joined` se aata hai, LIMIT wale hisse se NAHI.
   *
   * Ek hi query me dono nikalne ki koshish me ye galti bahut aasaani se ho jaati
   * hai: `count(*)` limit ke BAAD chalta hai, aur tab total kabhi bhi page size
   * se zyada nahi aata. Admin ko "50 devices" dikhta rehta chahe 4000 hon, aur
   * pagination pehle page ke baad ruk jaati. Isliye do alag sub-query, dono usi
   * CTE par.
   */
  select
    (select count(*)::int from joined),
    coalesce(
      (select jsonb_agg(t.x order by t.ls desc)
         from (
           select jsonb_build_object(
                    'id', j.id,
                    'user_id', j.owner_id,
                    'name', j.full_name,
                    'email', j.email,
                    'platform', j.platform,
                    -- brand|model|os — device.ts ka `fingerprint()`.
                    -- Hardware id NAHI (wo server par aati hi nahi).
                    'fingerprint', j.fingerprint,
                    'language', j.language,
                    'first_seen_at', j.created_at,
                    'last_seen_at', j.last_seen_at,
                    'is_active', (j.approved_user_id is not null
                                  and j.approved_user_id = j.owner_id),
                    'approved_at', j.approved_at,
                    'approved_via', j.approved_via,
                    'is_first_owner', (j.first_user_id = j.owner_id)
                  ) as x,
                  j.last_seen_at as ls
             from joined j
            order by j.last_seen_at desc
            limit v_lim offset greatest(0, coalesce(p_offset, 0))
         ) t),
      '[]'::jsonb)
    into v_total, v_rows;

  return jsonb_build_object('rows', v_rows, 'total', v_total);
end;
$$;

revoke all on function public.admin_device_list(uuid, text, int, int)
  from public, anon, authenticated;

/**
 * Support ka raasta — "user sahi hai, isko chalne do".
 *
 * Jinke paas email ka access hi nahi bacha (purana email, spam me code) unke
 * liye yahi ek raasta hai. Isliye ye zaroori hai — par ye ek AADMI ka faisla
 * hai, isliye admin panel me hi rehna chahiye, app me kabhi nahi.
 */
create or replace function public.admin_device_approve(p_uid uuid, p_id text)
returns boolean language sql security definer set search_path = public as $$
  select public.activate_device(p_uid, p_id, 'admin');
$$;

revoke all on function public.admin_device_approve(uuid, text)
  from public, anon, authenticated;

/* ------------------------------------------------------------------ */
/*  Jaanchne ke liye                                                   */
/* ------------------------------------------------------------------ */
-- Har user ka ek hi active device hona chahiye (ye khaali aana chahiye):
--   select approved_user_id, count(*) from public.devices
--    where approved_user_id is not null group by 1 having count(*) > 1;
--
-- Kitne users ka koi active device nahi (migration ke baad ~0 hona chahiye):
--   select count(distinct last_user_id) from public.devices d
--    where last_user_id is not null
--      and not exists (select 1 from public.devices x
--                       where x.approved_user_id = d.last_user_id);
