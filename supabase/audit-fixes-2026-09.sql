-- ============================================================================
-- Apka Saathi — Audit fixes (September 2026)
--
-- ⚠️⚠️ CHALANE KA KRAM — ye file SABSE AAKHIR me chalni hai.
--
-- Ye file in purani files ke functions ko dobara likhti hai (unka AAKHRI
-- version dekh ke, uska poora bartaav rakhte hue):
--
--   device-hardware.sql     → check_referral_qualification (2-arg + 0-arg),
--                             apply_referral_code
--   plan-limits.sql         → enforce_plan_limits, can_add_reminder
--   cron-plan-expiry.sql    → downgrade_expired_plans
--   device-approval.sql     → device_approval_check
--   app-lock.sql            → app_lock_reset_check
--   language-column.sql     → handle_new_user (+ fix-name-sync.sql,
--                             rewards-referrals.sql ka hissa bhi)
--   error-logs.sql          → log_app_error
--   delivery-log.sql        → log_notification
--   phone-otp.sql           → otp_issue
--
-- Yaani upar wali KOI bhi file baad me dobara chalayi, to uske BAAD ye file
-- phir se chalana ZAROORI hai — warna purana (kamzor) version wapas aa jaata
-- hai aur koi error bhi nahi dikhta. Ye file dobara chalana hamesha surakshit
-- hai (idempotent).
--
-- ── Kaise chalana hai ─────────────────────────────────────────────────────
--
--   1. Pehle `supabase functions deploy ai` (naya index.ts). Wo is file ke
--      bina bhi chalta hai — `ai_usage_bump` na mile to rate-limit chup-chaap
--      band rehti hai (fail open), AI nahi rukta.
--   2. Supabase SQL Editor me POORI file ek saath Run karo. Sab kuch ek hi
--      transaction (begin … commit) me hai: beech me kuch bhi fail hua to
--      KUCH bhi nahi badlega. Adha-adhoora state nahi banega.
--   3. Aakhir wala "Jaanch" hissa alag se chala ke dekh lo.
--   4. Edge function secret: `AI_HEALTH_SECRET` set karo (health ke liye).
--      Optional: `AI_DAILY_LIMITS` (JSON, jaise {"chat":300,"scan":80}).
--
-- ⚠️ Pehle chal chuki honi chahiye: saari purani files, khaaskar
--    locations-billing.sql, storage.sql, phone-verify.sql, app-lock.sql,
--    plan-limits.sql, rewards-referrals.sql, devices-analytics.sql,
--    device-hardware.sql, device-approval.sql, phone-otp.sql, error-logs.sql,
--    delivery-log.sql, language-column.sql, service-usage.sql.
--
-- ── Rollback (har hisse ka) ────────────────────────────────────────────────
--
-- Har hisse ke upar uska apna ROLLBACK comment me likha hai. Aam niyam: jis
-- purani file ka function yahan badla hai, wahi purani file dobara chala do —
-- wo apna purana version wapas likh degi. Triggers/grants ke liye seedhe
-- statement diye gaye hain.
-- ============================================================================

begin;

/* ========================================================================== */
/*  0. "Ye likhne wala app hai ya server?" — ek hi niyam, poori file me       */
/* ========================================================================== */
--
-- ⚠️ Is file ke saare triggers `current_user` dekhte hain — `auth.role()` ya
-- `current_setting('request.jwt.claim.role')` NAHI. Wajah soch-samajh ke hai:
--
--   • PostgREST har request par `set local role authenticated` (ya anon) karta
--     hai. Isliye app/website ka seedha insert/update `current_user =
--     'authenticated'` ke saath aata hai.
--   • Par SECURITY DEFINER function (jaise `set_app_lock`, `mark_phone_verified`)
--     ke andar `current_user` us function ka MAALIK (postgres) ban jaata hai —
--     aur uske andar se chalne wale triggers bhi wahi dekhte hain.
--   • JWT wala `role` claim us definer function ke andar bhi 'authenticated'
--     hi rehta hai. Agar trigger usse poochta, to `set_app_lock` ka apna insert
--     "app ka insert" gina jaata aur trigger PIN ka hash hi mita deta — lock
--     lagta hi nahi, aur koi error bhi nahi aata.
--   • (Aur is project me `request.jwt.claim.role` purana naam hai — naye
--     PostgREST me `request.jwt.claims` JSON aata hai. Us par tikna ek aur
--     chup-chaap tootne wali jagah hoti.)
--
-- service_role (webhook, cron, admin API) aur SQL editor/pg_cron (postgres)
-- in rokon se bahar hain — unka `current_user` 'authenticated'/'anon' hota hi
-- nahi.


/* ========================================================================== */
/*  1. user_details — phone verification aur app-lock ab app nahi likh sakti  */
/* ========================================================================== */
--
-- ⚠️ Ye asli, chalta hua chhed tha. `account-delete-requests.sql` ki policy
-- "own details" FOR ALL hai aur `user_details` par koi column grant nahi tha.
-- Yaani koi bhi logged-in user anon key se seedha ye bhej sakta tha:
--
--     PATCH /rest/v1/user_details?user_id=eq.<apni uid>
--     { "phone": "+91<kisi ka bhi number>", "phone_verified_at": "2026-01-01" }
--
-- …aur bina OTP ke "verified" ban jaata. Wahi number reminder ke WhatsApp ka
-- raasta hai, aur unique index (`user_details_verified_phone_uniq`) asli
-- maalik ko hi "number kisi aur ka hai" keh ke bahar kar deta. Isi tarah
-- `app_lock_*` bhi likhe ja sakte the (kisi aur ka hash chipka dena).
--
-- ⚠️ Ilaaj COLUMN GRANT se NAHI — sirf trigger se. Ye jaan-boojh ka faisla hai.
--
-- `column-grants.sql` wala tareeka (poora insert/update chheeno, kuch column
-- wapas do) yahan LIVE users ka profile save tod deta. App `user_details` ko
-- `select("*")` se padhti hai aur save par wahi object (lagbhag poora) upsert
-- karti hai — yaani `app_lock_hash`, `app_lock_at` jaise column bhi payload me
-- jaate hain. Column grant lagte hi har PURANI build (jo Play Store par abhi
-- chal rahi hai) ka profile save "permission denied" se girta, jab tak har user
-- app update na kare. Naye app me payload ab sirf profile ke column bhejta hai,
-- par purani build ko hum badal nahi sakte.
--
-- Trigger wahi suraksha deta hai bina kisi ko tode: app/website ka likha
-- `phone_verified_at` aur `app_lock_*` chup-chaap anadekha hota hai (insert par
-- khaali, update par purani value) — payload me aayein to bhi. Unke asli likhne
-- wale sab SECURITY DEFINER hain (`mark_phone_verified`, `set_app_lock`,
-- `set_app_lock_biometric`, `clear_app_lock`, `admin_set_app_lock`), jinke andar
-- `current_user` maalik hota hai — trigger unhe nahi rokta.
--
-- ROLLBACK:
--   drop trigger if exists user_details_guard_server_columns on public.user_details;

/**
 * Trigger — app/website ke haath se server wale column bachao.
 *
 * Naam jaan-boojh ke `user_details_guard_…` hai: BEFORE triggers naam ke ABC
 * kram me chalte hain, aur ise `user_details_phone_changed` (phone-verify.sql)
 * se PEHLE chalna hai. Pehle ye purani verification wapas rakhta hai, phir wo
 * number badla ho to use null karta hai — ulta kram hota to number badalne ke
 * baad bhi purana "verified" chipak jaata.
 */
create or replace function public.user_details_guard_server_columns()
returns trigger language plpgsql as $$
begin
  -- Server / definer function — unka likha hua hi sach hai.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.phone_verified_at  := null;
    new.app_lock_hash      := null;
    new.app_lock_salt      := null;
    new.app_lock_at        := null;
    new.app_lock_biometric := false;
  else
    new.phone_verified_at  := old.phone_verified_at;
    new.app_lock_hash      := old.app_lock_hash;
    new.app_lock_salt      := old.app_lock_salt;
    new.app_lock_at        := old.app_lock_at;
    new.app_lock_biometric := old.app_lock_biometric;
  end if;
  return new;
end;
$$;

drop trigger if exists user_details_guard_server_columns on public.user_details;
create trigger user_details_guard_server_columns
  before insert or update on public.user_details
  for each row execute function public.user_details_guard_server_columns();


/* ========================================================================== */
/*  2. Referral farming                                                        */
/* ========================================================================== */
--
-- Teen chhed the (device-hardware.sql me):
--
--   (a) 0-arg `check_referral_qualification()` naye wale ko null device ke saath
--       bulata tha — aur null par saare device-check SKIP ho jaate the. Yaani
--       koi bhi seedha `/rpc/check_referral_qualification` maar ke "same
--       device" aur "device already rewarded" dono se bach nikalta tha.
--   (b) Qualification sirf `documents` ki ek ROW maangti thi. Row ek REST call
--       se ban jaati hai — koi file nahi, koi photo nahi.
--   (c) Ek referrer par koi rok nahi — script se 100 account/din = 1500 din Plus.
--
-- Ab ki app kya bhejti hai (app-mobile/src/lib/plan.ts):
--   • install id (`getDeviceId`) — HAMESHA. SecureStore na chale to bhi wahi
--     session ke liye naya bana deti hai; null kabhi nahi jaata.
--   • hardware id (`getHardwareId`) — kabhi-kabhi NULL, aur ye jaan-boojh ke
--     hai: emulator, iOS jab restart ke baad phone unlock na hua ho, aur wo OEM
--     jo bekaar ANDROID_ID dete hain.
--
-- ⚠️ Isliye "hardware id zaroori" NAHI kiya. Wo asli users ko hamesha ke liye
-- reward se bahar kar deta — aur unhe kabhi pata bhi na chalta kyun. Rok ab ye
-- hai: install id YA hardware id me se kam se kam ek hona chahiye. Aaj ki app
-- hamesha install id bhejti hai, isliye asli user par koi asar nahi; sirf bina
-- device wali call (purani build, ya seedha REST) `need_update` sunti hai.
--
-- ⚠️ Document ki shart ab `file_path is not null` hai. Ye asli users ke liye
-- surakshit hai kyunki add-document screen bina photo ke Save hone hi nahi
-- deti (`photoRequired`), aur file_path server (`/api/storage/commit`) upload
-- ke baad khud bharta hai. Upload fail/offline ho to reward sirf RUKTA hai —
-- `need_document` lautta hai, upload kataar (`doc-upload-queue.ts`) file
-- chadha deti hai, aur `auth-provider` app saamne aane par dobara check karta
-- hai. Reward khota nahi, der se milta hai.
--
-- ⚠️ Referrer ki rozana hadd (`referral_daily_cap`, default 5 / 24 ghante).
-- Hadd paar wala referral `referrer_daily_cap` lautata hai aur UNREWARDED hi
-- rehta hai — agli baar (hadd khulne par) wahi referral apne aap qualify ho
-- jaata hai. Asli dost ka reward khota nahi. `0` (ya kam) = koi hadd nahi.
--
-- ROLLBACK: `device-hardware.sql` dobara chalao (dono overload aur
--   apply_referral_code purane ho jaayenge). `referral_daily_cap` config row
--   pade rehne se kuch nahi bigadta.

insert into public.app_config(key, value) values
  ('referral_daily_cap', '5'::jsonb)
on conflict (key) do nothing;

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
  if dev is not null and length(dev) < 8 then dev := null; end if;

  /**
   * ⚠️ Pehle bina device ke ye check SKIP ho jaata tha. Aaj ki app hamesha
   * install id bhejti hai, isliye bina device wali call ya to bahut purani
   * build hai ya seedha REST — dono ko "app update karo" hi sahi jawab hai.
   */
  if dev is null and hw is null then
    return 'need_update';
  end if;

  if public.user_seen_on_device(ref_id, dev, hw) then
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

create or replace function public.check_referral_qualification(
  p_device_id text,
  p_hardware_id text default null
)
returns text language plpgsql security definer set search_path = public as $$
declare
  r      public.referrals%rowtype;
  days   int;
  earned int;
  dev    text;
  hw     text;
  cap    int;
  recent int;
begin
  if auth.uid() is null then return 'no_auth'; end if;
  if not public.cfg_bool('referrals_enabled', true) then return 'disabled'; end if;

  /**
   * `for update` — ek hi referee ki do saath chalti call (document save +
   * reminder save ek hi pal me dono ise bulaate hain) pehle dono
   * `rewarded_at is null` padh leti thi aur DONO baar din mil jaate the.
   * Ab doosri call pehli ke khatam hone tak rukti hai, phir `not found` sunti hai.
   */
  select * into r from public.referrals
   where referee_id = auth.uid() and rewarded_at is null
   for update;
  if not found then return 'no_referral'; end if;

  -- Anti-fraud 1: naye user ne ek ASLI document (file ke saath) upload kiya
  -- AUR ek reminder set kiya. Sirf row kaafi nahi — row ek REST call hai.
  if not exists (
    select 1 from public.documents
     where user_id = auth.uid() and file_path is not null
  ) then
    return 'need_document';
  end if;
  if not exists (select 1 from public.reminders where user_id = auth.uid()) then
    return 'need_reminder';
  end if;

  dev := nullif(trim(coalesce(p_device_id, '')), '');
  hw  := nullif(trim(coalesce(p_hardware_id, '')), '');
  if dev is not null and length(dev) < 8 then dev := null; end if;

  -- ⚠️ Bina device ke saare device-check skip ho jaate the — wahi (a) wala chhed.
  if dev is null and hw is null then
    return 'need_update';
  end if;

  -- Anti-fraud 2: jisne code diya wo isi phone par tha?
  if public.user_seen_on_device(r.referrer_id, dev, hw) then
    return 'same_device';
  end if;

  -- Anti-fraud 3: is PHONE se pehle hi reward liya ja chuka hai?
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

  /**
   * Anti-fraud 4: referrer ki rozana hadd.
   *
   * ⚠️ Referrer ki profile row pehle LOCK hoti hai. Bina iske ek hi referrer ke
   * das referee ek saath qualify karein to sab ek hi ginti (4) padhte aur sab
   * paas ho jaate — hadd sirf kaagaz par rehti. Lock se wo ek-ek karke chalte
   * hain aur chhatha sach me `referrer_daily_cap` sunta hai.
   */
  cap := public.cfg_int('referral_daily_cap', 5);
  if cap > 0 then
    perform 1 from public.profiles where id = r.referrer_id for update;
    select count(*) into recent
      from public.referrals
     where referrer_id = r.referrer_id
       and rewarded_at > now() - interval '24 hours';
    if recent >= cap then
      return 'referrer_daily_cap';
    end if;
  end if;

  days := public.cfg_int('referral_days', 15);

  -- Koi kul cap nahi — jitne referrals, utne din (rozana hadd upar hai).
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

  -- Device par mohar — hardware_id bhi, warna reinstall ke baad ye row mile hi na.
  if dev is not null then
    insert into public.devices (id, hardware_id, referral_claimed_at, last_user_id)
    values (dev, hw, now(), auth.uid())
    on conflict (id) do update
      set referral_claimed_at = coalesce(public.devices.referral_claimed_at, now()),
          hardware_id = coalesce(excluded.hardware_id, public.devices.hardware_id),
          last_user_id = auth.uid();
  elsif hw is not null then
    update public.devices set referral_claimed_at = coalesce(referral_claimed_at, now())
     where hardware_id = hw;
  end if;

  return 'rewarded';
end;
$$;

/**
 * Purana 0-arg version — ab koi reward nahi deta.
 *
 * ⚠️ Ye DROP nahi kiya, sirf `need_update` lautata hai. Drop karne par jo bahut
 * purani build ise bulati hai use 404 milta aur wo "error" samajh ke har baar
 * dobara maarti. Aaj ki app 2-arg wala bulati hai aur yahan tabhi aati hai jab
 * wo fail ho — tab bhi reward yahan se dena galat hai, kyunki yahi wo raasta
 * tha jisse device-check bypass hote the.
 */
create or replace function public.check_referral_qualification()
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'no_auth'; end if;
  return 'need_update';
end;
$$;

revoke all on function public.check_referral_qualification(text, text) from public, anon;
grant execute on function public.check_referral_qualification(text, text) to authenticated;
revoke all on function public.check_referral_qualification() from public, anon;
grant execute on function public.check_referral_qualification() to authenticated;


/* ========================================================================== */
/*  3. Free plan ki hadd — ab server par, sirf app par nahi                    */
/* ========================================================================== */
--
-- ⚠️ `can_add_reminder()` / `can_add_document()` sirf SAWAAL the — app unse
-- poochh ke khud ruk jaati thi. Seedha `POST /rest/v1/documents` karne wale
-- ke liye koi deewar thi hi nahi: free user 500 document daal sakta tha, aur
-- `is_locked` / `is_paused` / `file_path` / `notified_at` bhi insert ke waqt
-- apni marzi se bhar sakta tha (column-grants.sql ne sirf UPDATE roka tha).
--
-- Ab do BEFORE triggers:
--   documents: is_locked=false, file_path/file_size/mime_type=null,
--              created_at=now(); aur free user ki kul ginti >= free_documents
--              → `plan_limit_documents`.
--   reminders: is_paused=false, notified_at=null, created_at=now(); aur free
--              user ke CHALU (is_on and not is_paused) reminders >=
--              free_reminders → `plan_limit_reminders`. Band reminder ko chalu
--              karna (is_on false→true) bhi usi hadd se guzarta hai — warna
--              "band bana ke daalo, phir chalu kar do" se hadd bekaar thi.
--
-- ⚠️ `file_path` insert par null karna surakshit hai: app `addDocument()` use
-- bhejti hi nahi, aur use `/api/storage/commit` upload ke baad service_role
-- PATCH se bharta hai (`web/lib/storage-server.ts` → `saveDocumentFile`).
-- `created_at` isliye ki `enforce_plan_limits` isi tarteeb se tay karta hai kaun
-- khula rahega — client apni marzi ki taarikh daal ke wo chunaav khud na kar le.
--
-- ⚠️ Error ke message HUBAHU `plan_limit_documents` / `plan_limit_reminders`
-- hain — app inhi shabdon ko pakadti hai. Badalna mat.
--
-- ⚠️ Offline outbox (`reminder-outbox.ts`) baad me wahi `addReminder()` insert
-- karta hai — trigger use bhi usi niyam se jaanchta hai. Hadd paar ho to outbox
-- use "pakki galti" maan ke hata deta hai (wahi bartaav jo `ReminderLimitError`
-- par pehle se tha). service_role/admin/cron ke insert trigger se bahar hain.
--
-- ROLLBACK:
--   drop trigger if exists documents_client_insert_guard on public.documents;
--   drop trigger if exists reminders_client_write_guard on public.reminders;
--   phir `plan-limits.sql` dobara chalao (enforce_plan_limits + can_add_reminder
--   purane ho jaayenge) aur `cron-plan-expiry.sql` (downgrade_expired_plans).

/**
 * Hadd ki jaanch — ek jagah.
 *
 * ⚠️ SECURITY DEFINER isliye ki `is_plus_active()` authenticated se revoke hai
 * (plan-limits.sql). Aur isliye trigger khud definer NAHI hai — definer banate
 * hi uske andar `current_user` postgres ho jaata aur "app ka insert hai ya
 * server ka" wala sawaal hi mar jaata.
 *
 * `auth.uid()` hi dekhta hai, kisi aur ka uid nahi leta — isliye authenticated
 * ko grant dena surakshit hai: ise seedha bulane se sirf apni hi hadd ka pata
 * chalta hai (jo `can_add_*` waise bhi batata hai).
 *
 * ⚠️ VOLATILE hona zaroori hai. STABLE function statement ke shuru ka snapshot
 * dekhta hai — tab ek hi request me 50 rows ka batch insert har row par ginti 0
 * padhta aur poori hadd bypass ho jaati. Volatile function har query par naya
 * snapshot leta hai, jisme usi statement ki pichhli rows bhi dikhti hain.
 *
 * ⚠️ Advisory lock — do saath chalti request (do phone, ya ek script) dono ek
 * hi ginti (2 of 3) padh ke dono paas ho jaati. Lock transaction khatam hone
 * tak rehta hai, isliye doosri pehli ke commit ke baad hi ginti padhti hai.
 */
create or replace function public.plan_limit_assert(p_kind text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cnt int;
begin
  -- Bina login ke insert waise bhi RLS se girega — yahan rokne ki zaroorat nahi.
  if v_uid is null then return; end if;
  if p_kind not in ('documents', 'reminders') then return; end if;

  perform pg_advisory_xact_lock(hashtext('plan_limit:' || p_kind || ':' || v_uid::text));

  if public.is_plus_active(v_uid) then return; end if;

  if p_kind = 'documents' then
    select count(*) into v_cnt from public.documents where user_id = v_uid;
    if v_cnt >= public.cfg_int('free_documents', 3) then
      raise exception 'plan_limit_documents' using errcode = 'P0001';
    end if;
  else
    select count(*) into v_cnt from public.reminders
     where user_id = v_uid and is_on and not is_paused;
    if v_cnt >= public.cfg_int('free_reminders', 5) then
      raise exception 'plan_limit_reminders' using errcode = 'P0001';
    end if;
  end if;
end;
$$;

revoke all on function public.plan_limit_assert(text) from public, anon;
grant execute on function public.plan_limit_assert(text) to authenticated;

create or replace function public.documents_client_insert_guard()
returns trigger language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- Server ke column — app ke haath me nahi.
  new.is_locked  := false;
  new.file_path  := null;
  new.file_size  := null;
  new.mime_type  := null;
  new.created_at := now();

  perform public.plan_limit_assert('documents');
  return new;
end;
$$;

drop trigger if exists documents_client_insert_guard on public.documents;
create trigger documents_client_insert_guard
  before insert on public.documents
  for each row execute function public.documents_client_insert_guard();

create or replace function public.reminders_client_write_guard()
returns trigger language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_paused   := false;
    new.notified_at := null;
    new.created_at  := now();
    if new.is_on then
      perform public.plan_limit_assert('reminders');
    end if;
  elsif new.is_on and not coalesce(old.is_on, false) and not new.is_paused then
    -- Band reminder chalu ho raha hai — ye bhi ek naya "chalu" slot hai.
    perform public.plan_limit_assert('reminders');
  end if;
  return new;
end;
$$;

drop trigger if exists reminders_client_write_guard on public.reminders;
create trigger reminders_client_write_guard
  before insert or update of is_on on public.reminders
  for each row execute function public.reminders_client_write_guard();

/**
 * `can_add_reminder()` — ab wahi ginti jo trigger lagata hai.
 *
 * ⚠️ Pehle ye SAARE reminders ginta tha, band wale bhi. Trigger chalu wale
 * ginta hai. Dono alag hote to app "jagah hai" dikhati aur server mana karta
 * (ya ulta) — user ke saamne sabse uljhan wali soorat.
 */
create or replace function public.can_add_reminder()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare cnt int;
begin
  if auth.uid() is null then return false; end if;
  if public.is_plus_active(auth.uid()) then return true; end if;
  select count(*) into cnt from public.reminders
   where user_id = auth.uid() and is_on and not is_paused;
  return cnt < public.cfg_int('free_reminders', 5);
end;
$$;

revoke all on function public.can_add_reminder() from public, anon;
grant execute on function public.can_add_reminder() to authenticated;

/**
 * `enforce_plan_limits` — reminders ki tarteeb ab sirf CHALU reminders me.
 *
 * ⚠️ Ye badlaav zaroori hai, warna naya niyam khud ko kaat-ta. Purana version
 * SAARE reminders ko created_at se ginta tha. Free user ke 5 reminder hon jinme
 * 3 band hain: naye niyam se 6th banana allowed hai (chalu sirf 2) — par agle
 * hi session-load par `enforce_my_limits()` us 6th ko "rn 6 > 5" maan ke PAUSE
 * kar deta. User ne abhi banaya, aur wo turant chup.
 *
 * Ab: chalu reminders me pehle N (created_at asc) chalte hain, baaki pause.
 * Band reminder par `is_paused = false` — use chalu karte waqt trigger hadd
 * dekh leta hai. Documents ka hissa bilkul purana hai (AAKHRI N khule).
 */
create or replace function public.enforce_plan_limits(p_uid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  active   boolean := public.is_plus_active(p_uid);
  rem_lim  int := public.cfg_int('free_reminders', 5);
  doc_lim  int := public.cfg_int('free_documents', 3);
begin
  if p_uid is null then return; end if;

  if active then
    update public.reminders set is_paused = false
      where user_id = p_uid and is_paused;
    update public.documents set is_locked = false
      where user_id = p_uid and is_locked;
    return;
  end if;

  -- Free: CHALU reminders me pehle rem_lim active, baaki pause.
  --
  -- ⚠️ Tarteeb me PEHLE wo jo abhi chal rahe hain (`is_paused asc`), phir purane.
  -- Sirf created_at se ginne par: 5 chalu + 2 paused (Plus khatam hone wale) —
  -- user ek chalu hataata, trigger naya banane deta (chalu 4 < 5), aur agle hi
  -- load par ye function purane PAUSED ko chalu karke abhi-abhi bana reminder
  -- pause kar deta. Plus se free hone par sab chalu hote hain, to wahan tarteeb
  -- pehle jaisi (sabse purane N) hi rehti hai.
  with ranked as (
    select id,
           case when is_on
                then row_number() over (
                  partition by is_on order by is_paused asc, created_at asc, id asc
                )
           end as rn
      from public.reminders where user_id = p_uid
  )
  update public.reminders r
     set is_paused = coalesce(ranked.rn > rem_lim, false)
    from ranked
   where r.id = ranked.id
     and r.is_paused <> coalesce(ranked.rn > rem_lim, false);

  -- Free: documents — AAKHRI doc_lim khule, baaki lock (plan-limits.sql jaisa).
  with ranked as (
    select id, row_number() over (order by created_at desc, id desc) as rn
    from public.documents where user_id = p_uid
  )
  update public.documents d
     set is_locked = (ranked.rn > doc_lim)
    from ranked
   where d.id = ranked.id
     and d.is_locked <> (ranked.rn > doc_lim);
end;
$$;

revoke all on function public.enforce_plan_limits(uuid) from public, anon, authenticated;
grant execute on function public.enforce_plan_limits(uuid) to service_role;

/**
 * Cron — ab sirf "Plus khatam hua" nahi, HAR free user.
 *
 * ⚠️ Purana version sirf `plan = 'plus'` aur expiry nikli hui dekhta tha. Jo
 * user kabhi Plus tha hi nahi (plan = 'free') aur jisne app ki rok bypass karke
 * 50 document daal diye, wo kabhi is list me aata hi nahi tha — uska downgrade
 * tabhi lagta jab wo khud app khol ke `enforce_my_limits()` chalata. Trigger ab
 * NAYE insert rokta hai; ye un purane rows ko sambhalta hai jo trigger se pehle
 * ghus chuke the.
 *
 * Signature aur return type wahi — cron job (`downgrade-expired-plans`) bina
 * chhede isi naye version ko bulane lagta hai.
 */
create or replace function public.downgrade_expired_plans(p_limit int default 500)
returns int language plpgsql security definer set search_path = public as $$
declare
  u       uuid;
  n       int := 0;
  doc_lim int := public.cfg_int('free_documents', 3);
  rem_lim int := public.cfg_int('free_reminders', 5);
begin
  for u in
    select p.id
      from public.profiles p
     where not public.is_plus_active(p.id)
       -- Sirf jinka kaam baaki hai — warna har ghante har free user par chalta.
       and (
         exists (
           select 1 from public.documents d
            where d.user_id = p.id and not d.is_locked
            offset doc_lim
         )
         or exists (
           select 1 from public.reminders r
            where r.user_id = p.id and r.is_on and not r.is_paused
            offset rem_lim
         )
       )
     limit p_limit
  loop
    perform public.enforce_plan_limits(u);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function public.downgrade_expired_plans(int) from public, anon, authenticated;


/* ========================================================================== */
/*  4. Email code ki "koshish" ginti — ab race-safe                           */
/* ========================================================================== */
--
-- ⚠️ `device_approval_check` aur `app_lock_reset_check` dono pehle PADHTE the
-- (select), phir milaate, phir `tries = r.tries + 1` likhte. Ek saath 50
-- request bhejo to sab ek hi `tries = 0` padhti hain — 5 ki hadd kabhi lagti hi
-- nahi, aur 6 ank ka code ek hi burst me toot sakta hai. `phone-otp.sql` ka
-- `otp_check` isse pehle hi bacha hua hai (update … returning).
--
-- Ab row `for update` se LOCK hoti hai: doosri request pehli ke khatam hone tak
-- rukti hai aur phir taaza `tries` / `used_at` dekhti hai. Sahi code do baar
-- aaye to doosri ko `none` milta hai (code pehle hi use ho chuka) — ek code,
-- ek baar. Signature, return aur saare jawab ('ok' | 'wrong' | …) wahi.
--
-- ROLLBACK: `device-approval.sql` aur `app-lock.sql` dobara chalao.

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
   order by created_at desc limit 1
   for update;

  if not found then return 'none'; end if;
  if r.expires_at < now() then return 'expired'; end if;
  if r.tries >= 5 then return 'locked'; end if;
  if r.device_id is distinct from p_device then return 'other_device'; end if;

  if r.code_hash is distinct from p_hash then
    -- `tries + 1` column par — `r.tries + 1` par nahi. Lock ke saath dono ek
    -- jaise hain, par ye kal koi lock hata de tab bhi sahi rehta hai.
    update public.device_approval set tries = tries + 1 where id = r.id;
    return 'wrong';
  end if;

  update public.device_approval set used_at = now() where id = r.id;
  perform public.activate_device(p_user, p_device, 'otp');
  return 'ok';
end;
$$;

revoke all on function public.device_approval_check(uuid, text, text)
  from public, anon, authenticated;

create or replace function public.app_lock_reset_check(p_user uuid, p_hash text)
returns text language plpgsql security definer set search_path = public as $$
declare
  r public.app_lock_reset%rowtype;
begin
  select * into r from public.app_lock_reset
   where user_id = p_user and used_at is null
   order by created_at desc limit 1
   for update;

  if not found then return 'none'; end if;
  if r.expires_at < now() then return 'expired'; end if;
  if r.tries >= 5 then return 'locked'; end if;

  if r.code_hash = p_hash then
    update public.app_lock_reset set used_at = now() where id = r.id;
    return 'ok';
  end if;

  update public.app_lock_reset set tries = tries + 1 where id = r.id;
  return 'wrong';
end;
$$;

revoke all on function public.app_lock_reset_check(uuid, text) from public, anon, authenticated;


/* ========================================================================== */
/*  5. handle_new_user — ek hi, poora version                                  */
/* ========================================================================== */
--
-- ⚠️ `language-column.sql` (sabse baad me chali, 17 Aug) ne `handle_new_user`
-- ko NAYE SIRE se likh diya aur do cheezein chup-chaap gira di:
--
--   • referral code — us din ke baad ke HAR naye user ka `referral_code` null
--     hai. Unki Refer & Earn screen khaali, aur wo kisi ko bula hi nahi sakte.
--   • `fix-name-sync.sql` ka naam wala ilaaj — `on conflict do update set
--     full_name = excluded.full_name` wapas aa gaya, jo naam ko NULL se bhi
--     mita deta hai.
--
-- Ab teeno ek jagah: referral code (rewards-referrals.sql), naam kabhi null
-- se na mite (fix-name-sync.sql), aur signup ki bhasha (language-column.sql).
--
-- ⚠️ Code ki takkar par signup nahi girna chahiye. `exists` wala loop race me
-- pakka nahi hai (do signup ek hi pal me ek hi code chun lein), aur unique
-- violation yahan poore SIGNUP ko gira deta. Isliye insert khud bhi takkar par
-- naya code le ke dobara koshish karta hai.
--
-- ROLLBACK: `language-column.sql` dobara chalao (par wo upar wale dono bug
--   wapas le aayega). Backfill kiye gaye referral code rehne dena — wo kuch
--   nahi todte.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c      text;
  tries  int := 0;
  v_name text := nullif(trim(coalesce(
                   new.raw_user_meta_data->>'full_name',
                   new.raw_user_meta_data->>'name',
                   ''
                 )), '');
  -- Kachhi value (purani app, Google login) par default — warna
  -- `profiles_language_check` poora signup rok deta.
  v_lang text := case
                   when new.raw_user_meta_data->>'language' in ('hinglish', 'hi', 'en')
                     then new.raw_user_meta_data->>'language'
                   else 'hinglish'
                 end;
begin
  loop
    tries := tries + 1;
    loop
      c := public.gen_referral_code();
      exit when not exists (select 1 from public.profiles where referral_code = c);
    end loop;

    begin
      insert into public.profiles (id, email, full_name, referral_code, language)
      values (new.id, new.email, v_name, c, v_lang)
      on conflict (id) do update set
        email         = coalesce(excluded.email, public.profiles.email),
        -- naya naam mile tabhi badlo; warna purana rakho (NULL se overwrite mat karo)
        full_name     = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
        -- pehle se code ho to wahi — user ka shared link kabhi nahi badalna chahiye
        referral_code = coalesce(public.profiles.referral_code, excluded.referral_code);
      exit;
    exception when unique_violation then
      if tries >= 5 then raise; end if;
    end;
  end loop;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: jin profiles ka referral_code null hai (language-column.sql ke baad
-- wale signups). Har row alag koshish — ek takkar poori migration na giraye.
do $$
declare
  p record;
  c text;
  n int;
begin
  for p in select id from public.profiles where referral_code is null loop
    n := 0;
    loop
      n := n + 1;
      c := public.gen_referral_code();
      begin
        update public.profiles set referral_code = c
         where id = p.id and referral_code is null;
        exit;
      exception when unique_violation then
        if n >= 10 then raise; end if;
      end;
    end loop;
  end loop;
end $$;


/* ========================================================================== */
/*  6. claim_waitlist_reward — darwaza band                                   */
/* ========================================================================== */
--
-- ⚠️ `plans.sql` isse `authenticated` ko grant karta hai, aur ye SECURITY
-- DEFINER hai jo seedha `plan = 'plus'` + 1 saal likhta hai. App ise ab kahin
-- nahi bulati (waitlist hat chuki). Khula rehne ka koi faayda nahi, sirf khatra.
--
-- DROP nahi kiya — `drop-waitlist.sql` ka STEP 2 wahi kaam owner ke haath me
-- chhodta hai. Wo pehle chal chuka ho to function hai hi nahi, isliye
-- `to_regprocedure` se poochh ke hi revoke — warna yahi line poori migration
-- gira deti.
--
-- ROLLBACK: grant execute on function public.claim_waitlist_reward() to authenticated;

do $$
begin
  if to_regprocedure('public.claim_waitlist_reward()') is not null then
    revoke all on function public.claim_waitlist_reward() from public, anon, authenticated;
  end if;
end $$;


/* ========================================================================== */
/*  7. Log wale raaste — koi bhi DB na bhar de                                 */
/* ========================================================================== */
--
-- ROLLBACK:
--   `error-logs.sql` aur `delivery-log.sql` dobara chalao;
--   drop trigger if exists analytics_events_client_guard on public.analytics_events;

/* 7a. log_app_error ------------------------------------------------------- */
--
-- ⚠️ Ye `anon` ko bhi khula hai (login se pehle ke crash bhi aane chahiye), aur
-- `p_context` ki koi hadd nahi thi. Ek script har call me 1MB JSON bhej ke
-- `app_errors` ko minton me GB bana sakti thi — aur wahi table admin ka Logs
-- page aur error-digest email padhte hain.
--
-- Ab: har text field ki hadd, context 8KB tak (usse bada ho to sirf ek chhota
-- sa "head" rehta hai), aur ek halki rate-limit — ek user 10 minute me 100,
-- bina login ke sab milake 1 minute me 120. App pehle hi ek jaise error dedupe
-- karti hai (`report-error.ts` ka `shouldSend`), isliye asli app is hadd tak
-- kabhi nahi pahunchti. Hadd paar = chup-chaap chhod do (error phenkna logging
-- ko hi ek naya error bana deta).
--
-- Web ka server `app_errors` me seedha service_role se likhta hai
-- (`web/lib/errors-server.ts`) — us par ye function lagta hi nahi.

create index if not exists app_errors_user_time_idx
  on public.app_errors (user_id, created_at desc);

create or replace function public.log_app_error(
  p_message text,
  p_source text default 'app',
  p_level text default 'error',
  p_stack text default null,
  p_context jsonb default null,
  p_platform text default null,
  p_app_version text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_ctx    jsonb := p_context;
  v_recent int;
begin
  if v_uid is not null then
    select count(*) into v_recent from public.app_errors
     where user_id = v_uid and created_at > now() - interval '10 minutes';
    if v_recent >= 100 then return; end if;
  else
    select count(*) into v_recent from public.app_errors
     where user_id is null and created_at > now() - interval '1 minute';
    if v_recent >= 120 then return; end if;
  end if;

  if v_ctx is not null and octet_length(v_ctx::text) > 8000 then
    v_ctx := jsonb_build_object(
      'truncated', true,
      'bytes',     octet_length(p_context::text),
      'head',      left(p_context::text, 2000)
    );
  end if;

  insert into public.app_errors
    (user_id, source, level, message, stack, context, platform, app_version)
  values (
    v_uid,
    case when p_source in ('app', 'web', 'edge') then p_source else 'app' end,
    case when p_level in ('error', 'warn') then p_level else 'error' end,
    coalesce(left(p_message, 2000), '(no message)'),
    left(p_stack, 8000),
    v_ctx,
    left(p_platform, 20),
    left(p_app_version, 40)
  );
end;
$$;

revoke all on function public.log_app_error(text,text,text,text,jsonb,text,text) from public;
grant execute on function public.log_app_error(text,text,text,text,jsonb,text,text)
  to anon, authenticated, service_role;

/* 7b. analytics_events ---------------------------------------------------- */
--
-- ⚠️ Is table par `anon` ka seedha INSERT hai (website ka visitor logged-in
-- nahi hota) — aur har column bina hadd ka. `props` me 5MB ka JSON daal do,
-- bas. Rate yahan nahi rok sakte (anon ki koi pehchaan hi nahi), par ek row
-- kitni badi ho sakti hai wo zaroor.
--
-- Rokne (error) ki jagah KAAT dete hain: app/web 25 events ka batch ek hi
-- insert me bhejte hain, aur ek lambi row poore batch ko gira deti.
-- Asli events chhote hain (`screen_view`, `tap`, page path) — unpar koi asar nahi.

create or replace function public.analytics_events_client_guard()
returns trigger language plpgsql as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  new.name       := left(new.name, 80);
  new.target     := left(new.target, 300);
  new.session_id := left(new.session_id, 100);
  new.device_id  := left(new.device_id, 100);
  new.source     := case when new.source in ('app', 'web') then new.source else 'app' end;
  new.created_at := now();

  if new.props is not null and octet_length(new.props::text) > 4000 then
    new.props := jsonb_build_object('truncated', true);
  end if;
  return new;
end;
$$;

drop trigger if exists analytics_events_client_guard on public.analytics_events;
create trigger analytics_events_client_guard
  before insert on public.analytics_events
  for each row execute function public.analytics_events_client_guard();

/* 7c. log_notification ---------------------------------------------------- */
--
-- ⚠️ Pehle koi bhi logged-in user kisi bhi `p_item_id` aur kisi bhi `p_kind`
-- ke saath row likh sakta tha. Do nuksaan:
--   • ek (item, due_at) har baar nayi `due_at` ke saath = anginat rows;
--   • `on conflict` kisi DOOSRE user ki row par `seen_at` bhar deta — admin
--     panel me "user ne dekh liya" ka jhooth.
--
-- Ab: kind sirf 'reminder' | 'document', item ISI user ka hona chahiye, aur
-- due_at samajhdaar khidki me (90 din peeche se 7 din aage). App ise tabhi
-- bulati hai jab alert screen par AAYA — yaani due_at hamesha "abhi ke aas-paas"
-- hota hai. Galat call chup-chaap chhod di jaati hai (app waise bhi error ko
-- nigal leti hai — `notif-delivery.ts`).
--
-- ⚠️ Iska matlab: service_role se bina user ke bulaane par ab kuch nahi likhta.
-- Aisa koi caller hai nahi (sirf app bulati hai); cron `log_delivery` use karta hai.

create or replace function public.log_notification(
  p_kind    text,
  p_item_id uuid,
  p_due_at  timestamptz,
  p_seen    boolean default false
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_item_id is null or p_due_at is null then return; end if;
  if p_kind not in ('reminder', 'document') then return; end if;
  if p_due_at < now() - interval '90 days' or p_due_at > now() + interval '7 days' then
    return;
  end if;

  if p_kind = 'reminder' and not exists (
    select 1 from public.reminders where id = p_item_id and user_id = v_uid
  ) then
    return;
  end if;
  if p_kind = 'document' and not exists (
    select 1 from public.documents where id = p_item_id and user_id = v_uid
  ) then
    return;
  end if;

  insert into public.delivery_log
    (kind, item_id, user_id, due_at, channel, status, plan, seen_at)
  values
    (p_kind, p_item_id, v_uid, p_due_at, 'notification', 'sent',
     case when public.is_plus_active(v_uid) then 'plus' else 'free' end,
     case when p_seen then now() else null end)
  on conflict (kind, item_id, due_at, channel) do update
    -- ⚠️ `coalesce` — pehli baar ka waqt hi sach hai.
    set seen_at = coalesce(public.delivery_log.seen_at,
                           case when p_seen then now() else null end);
end;
$$;

revoke all on function public.log_notification(text, uuid, timestamptz, boolean) from public, anon;
grant execute on function public.log_notification(text, uuid, timestamptz, boolean) to authenticated, service_role;


/* ========================================================================== */
/*  8. claim_device_if_free — JAAN-BOOJH KE nahi badla                         */
/* ========================================================================== */
--
-- ⚠️ Audit ki salah thi: "claim sirf tab jab `devices.last_user_id = auth.uid()`".
-- Aaj ki app ke saath wo asli users ko chup-chaap tod deti:
--
--   • `device_seen` app me SIRF ek jagah chalta hai — `LanguageProvider`, aur
--     wo bhi tabhi jab local me bhasha saved na ho (yaani pehli baar app khuli).
--     Us waqt user LOGIN hi nahi hota, isliye row ka `last_user_id` null rehta
--     hai. Login ke baad app `device_seen` dobara nahi bulati.
--   • Phir `device-approval-gate` → `refreshDeviceState()` →
--     `claim_device_if_free`. Us pal `last_user_id` null (ya pichhle user A ka)
--     hota hai — naye rule par har naya user aur har "A logout, B login" wala
--     phone kabhi active hi nahi hota. Wahi bug jiske liye device-approval.sql
--     me pichhli shart hataayi gayi thi: koi reminder nahi, koi notification
--     nahi, aur screen par ek shabd bhi nahi.
--
-- Asli khatra bhi chhota hai: device id ek random UUID hai jo client ko kahin
-- se padhne ko nahi milta (devices/analytics_events par koi select policy nahi),
-- aur galat claim ka asar sirf itna ki us phone ka maalik agli app-open par use
-- wapas claim kar leta hai.
--
-- Sahi ilaaj pehle APP me: login ke baad (claim se pehle) `registerDevice()`
-- chalao, taaki `device_users` me (device, user) likh jaaye. Wo release sab tak
-- pahunch jaye, TAB ye shart jodni hai:
--
--   if not exists (select 1 from public.device_users
--                   where device_id = p_id and user_id = auth.uid()) then
--     return false;
--   end if;


/* ========================================================================== */
/*  9. SMS pumping — din ka kul budget aur desh-wise hadd                      */
/* ========================================================================== */
--
-- ⚠️ `otp_issue` ki saari haddein EK user / EK number / EK IP par thi. SMS
-- pumping (toll fraud) theek iske ulta chalta hai: hazaar account, hazaar alag
-- number (aksar mehnge international premium range), hazaar IP. Har ek apni
-- hadd ke andar — aur bill hamara. Twilio par ek raat me lakhon ka nuksaan
-- isi tarah hota hai.
--
-- Ab do nayi deewar, dono `app_config` se (admin panel se live badal sakti hain):
--   otp_global_per_day       — poore system ka 24 ghante ka SMS budget (2000)
--   otp_intl_country_per_day — +91 ke bahar HAR desh ka 24 ghante ka budget (50)
--
-- Jawab wahi shakal: `{ status: 'too_many', scope, retry_after }`. Web ka
-- `/api/phone/send-otp` isse pehle se 429 `too_many` me badalta hai aur app
-- "support me ticket" wali line dikhati hai — koi naya code nahi chahiye.
--
-- ⚠️ Ye ginti `ignored` rows bhi ginti hai. Admin ka reset ek USER ki hadd
-- kholta hai, par jo SMS ja chuka uska paisa lag chuka — budget usse wapas
-- nahi aata.
--
-- ROLLBACK: `phone-otp.sql` dobara chalao (config rows pade rehne se kuch nahi bigadta).

insert into public.app_config(key, value) values
  ('otp_global_per_day',       '2000'::jsonb),
  ('otp_intl_country_per_day', '50'::jsonb)
on conflict (key) do nothing;

-- Din bhar ki kul ginti isi par — bina iske har SMS poori table scan karta.
create index if not exists phone_otp_time on public.phone_otp (created_at desc);

create or replace function public.otp_issue(
  p_user    uuid,
  p_phone   text,
  p_hash    text,
  p_ip      text default null,
  p_country text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  lim        record;
  last_at    timestamptz;
  wait       int;
  hour_count int;
  day_count  int;
  ip_count   int;
  all_count  int;
  cc_count   int;
begin
  if p_user is null or coalesce(trim(p_phone), '') = '' or coalesce(trim(p_hash), '') = '' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into lim from public.otp_limits();

  /* 1. Thehraav (phone-otp.sql jaisa). */
  select max(created_at) into last_at
    from public.phone_otp
   where not ignored
     and created_at > now() - make_interval(secs => lim.cooldown_seconds)
     and (user_id = p_user or phone = p_phone);

  if last_at is not null then
    wait := ceil(extract(epoch from (last_at + make_interval(secs => lim.cooldown_seconds) - now())));
    if wait > 0 then
      return jsonb_build_object('status', 'cooldown', 'retry_after', wait);
    end if;
  end if;

  /* 2. Ghante aur din ki hadd (phone-otp.sql jaisa). */
  select count(*) into hour_count
    from public.phone_otp
   where not ignored
     and created_at > now() - interval '1 hour'
     and (user_id = p_user or phone = p_phone);
  if hour_count >= lim.per_hour then
    return jsonb_build_object('status', 'too_many', 'scope', 'hour', 'retry_after', 3600);
  end if;

  select count(*) into day_count
    from public.phone_otp
   where not ignored
     and created_at > now() - interval '1 day'
     and (user_id = p_user or phone = p_phone);
  if day_count >= lim.per_day then
    return jsonb_build_object('status', 'too_many', 'scope', 'day', 'retry_after', 86400);
  end if;

  /* 3. Fraud — ek hi IP se bahut saare ALAG number (phone-otp.sql jaisa). */
  if p_ip is not null then
    select count(distinct phone) into ip_count
      from public.phone_otp
     where not ignored
       and ip = p_ip
       and created_at > now() - interval '1 day';
    if ip_count >= lim.ip_per_day then
      return jsonb_build_object('status', 'too_many', 'scope', 'ip', 'retry_after', 86400);
    end if;
  end if;

  /**
   * 3b. Poore system ka budget.
   *
   * ⚠️ Ye asli user ko bhi rok sakta hai — aur ye jaan-boojh ka sauda hai. Din
   * ke 2000 SMS asli signups ke liye kaafi se zyada hain; usse upar jaana
   * lagbhag hamesha hamla hai. Hamle ke dauraan kuch asli users ka ek din ruk
   * jaana, ek raat me poora Twilio balance khatam hone se kahin sasta hai.
   */
  select count(*) into all_count
    from public.phone_otp
   where created_at > now() - interval '1 day';
  if all_count >= public.cfg_int('otp_global_per_day', 2000) then
    return jsonb_build_object('status', 'too_many', 'scope', 'global', 'retry_after', 3600);
  end if;

  /**
   * 3c. Bharat ke bahar — har desh ka alag budget.
   *
   * Pumping lagbhag hamesha international premium number par hota hai (unka
   * daam kai guna hai aur fraud karne wale ko usme hissa milta hai). Hamare
   * users zyaadatar +91 hain, isliye wahan koi nayi rok nahi. Desh `p_country`
   * se (web `countryOf(phone)` bhejta hai); wo na ho to sab bina-desh wale ek
   * hi bucket me.
   */
  if p_phone not like '+91%' then
    select count(*) into cc_count
      from public.phone_otp
     where created_at > now() - interval '1 day'
       and phone not like '+91%'
       and coalesce(country, '') = coalesce(p_country, '');
    if cc_count >= public.cfg_int('otp_intl_country_per_day', 50) then
      return jsonb_build_object('status', 'too_many', 'scope', 'country', 'retry_after', 3600);
    end if;
  end if;

  /* 4. Purane zinda code maaro — ek waqt me ek hi zinda code. */
  update public.phone_otp
     set consumed_at = now()
   where user_id = p_user
     and phone = p_phone
     and consumed_at is null;

  insert into public.phone_otp (user_id, phone, code_hash, expires_at, ip, country)
  values (
    p_user, p_phone, p_hash,
    now() + make_interval(secs => lim.ttl_seconds),
    p_ip, p_country
  );

  return jsonb_build_object('status', 'ok', 'ttl', lim.ttl_seconds);
end;
$$;

revoke all on function public.otp_issue(uuid, text, text, text, text) from public, anon, authenticated;


/* ========================================================================== */
/* 10. App lock PIN ka hash — JAAN-BOOJH KE abhi nahi badla                    */
/* ========================================================================== */
--
-- Audit ne sahi pakda: `get_app_lock()` hash + salt app ko lautata hai, aur
-- hash ek hi SHA-256 hai. 4-6 ank ka PIN usse second me nikal jaata hai.
--
-- ⚠️ Par hashing yahan se badalna live users ko LOCK OUT kar deta:
--   • PIN ka milaan PHONE par hota hai, bina net ke (app-lock.sql ka poora
--     tark yahi hai). Phone ke SecureStore me SHA-256 wala hash pada hai aur
--     app ka code wahi algorithm chalata hai.
--   • Server par naya algorithm (PBKDF2/scrypt) lagte hi, jo phone naya hash
--     le aata wo purane app code se kabhi match nahi karta — user apne sahi
--     PIN se bahar, aur reset ke alawa koi raasta nahi.
--   • Aur purana hash kabhi naye me badla hi nahi ja sakta — uske liye asli
--     PIN chahiye, jo server ke paas hai hi nahi.
--
-- Sahi raasta (ek alag release me): app me versioned hash (`v2:pbkdf2:…`) —
-- milaan dono samjhe, aur agli sahi PIN entry par app khud `set_app_lock` se
-- v2 likh de. Jab zyaadatar users v2 par aa jayein, tab `get_app_lock` sirf v2
-- lautaye aur v1 wale se ek baar PIN dobara lagwaya jaye. Tab tak asli
-- behtari: 6 ank ka PIN (100 guna) — app-mobile/src/lib/app-lock.ts dekho.


/* ========================================================================== */
/* 11. AI ki rozana hadd — per user, per task                                  */
/* ========================================================================== */
--
-- ⚠️ `ai` edge function har logged-in user ke liye khula hai aur uske peeche
-- Gemini ka bill hai. Ek account (ya ek script ek account se) din bhar `scan`
-- maar sakta tha — sabse mehnga raasta (vision model + poori image).
--
-- `service_usage` se ginna sasta nahi tha: wahan (user_id, created_at) ka koi
-- index nahi, row Gemini call ke BAAD aur fire-and-forget likhi jaati hai
-- (ek saath 20 request sab "0" padhti), aur fail/retry/fallback rows bhi usi me
-- hain. Isliye ek chhota counter: ek (user, din, task) = ek row, aur
-- `ai_usage_bump` ek hi atomic statement me +1 karke nayi ginti lautata hai.
--
-- Din Asia/Kolkata ka — "aaj ki hadd" user ke din se khule, UTC ki aadhi raat
-- (subah 5:30) se nahi. Hadd khud edge function me hai (env `AI_DAILY_LIMITS`
-- se badal sakti hai); yahan sirf ginti.
--
-- ⚠️ Edge function is table/RPC ke na hone par FAIL OPEN karta hai (console
-- warning, AI chalta rehta hai) — isliye deploy ka kram kuch bhi ho, AI nahi
-- rukta.
--
-- ROLLBACK:
--   select cron.unschedule(jobid) from cron.job where jobname = 'prune-ai-usage-daily';
--   drop function if exists public.ai_usage_prune();
--   drop function if exists public.ai_usage_bump(uuid, text);
--   drop table if exists public.ai_usage_daily;

create table if not exists public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  task    text not null,
  calls   int  not null default 0,
  primary key (user_id, day, task)
);

alter table public.ai_usage_daily enable row level security;
-- Koi policy nahi = app se bilkul band. Sirf service_role (edge function).
revoke all on public.ai_usage_daily from anon, authenticated;

create or replace function public.ai_usage_bump(p_user uuid, p_task text)
returns int language sql security definer set search_path = public as $$
  insert into public.ai_usage_daily as a (user_id, day, task, calls)
  values (p_user, (now() at time zone 'Asia/Kolkata')::date, left(coalesce(p_task, ''), 40), 1)
  on conflict (user_id, day, task) do update
    set calls = a.calls + 1
  returning calls;
$$;

revoke all on function public.ai_usage_bump(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_usage_bump(uuid, text) to service_role;

create or replace function public.ai_usage_prune()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.ai_usage_daily where day < current_date - 14;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.ai_usage_prune() from public, anon, authenticated;
grant execute on function public.ai_usage_prune() to service_role;

-- ⚠️ `do` + `exception` — delivery-log.sql wali seekh: cron ki ek line poori
-- migration na giraye. pg_cron na ho to bhi upar sab ban jaata hai.
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'prune-ai-usage-daily';
  perform cron.schedule(
    'prune-ai-usage-daily',
    '40 3 * * *',
    $job$ select public.ai_usage_prune(); $job$
  );
exception when others then
  raise notice 'prune-ai-usage-daily schedule nahi ho payi (%). Table aur functions phir bhi ban gaye.', sqlerrm;
end $$;

commit;


/* ========================================================================== */
/*  Jaanch — commit ke BAAD alag se chalao                                     */
/* ========================================================================== */
--
-- 1) user_details — column grant JAAN-BOOJH KE nahi badle (wajah hisse 1 me).
--    Profile save pehle jaisa chalna chahiye; suraksha trigger se hai. App me
--    apna profile ek baar save karke dekh lo, phir ye 0 aana chahiye (kisi ne
--    app se khud ko verified nahi likha):
--
--   select count(*) from public.user_details
--    where phone_verified_at is not null and phone is null;
--
-- 2) Naye triggers maujood hain:
--
--   select tgrelid::regclass as tbl, tgname, tgenabled
--     from pg_trigger
--    where tgname in ('user_details_guard_server_columns',
--                     'documents_client_insert_guard',
--                     'reminders_client_write_guard',
--                     'analytics_events_client_guard',
--                     'on_auth_user_created')
--    order by 1, 2;
--
-- 3) Function grants — kaun kise bula sakta hai:
--
--   select p.oid::regprocedure as fn,
--          has_function_privilege('anon',          p.oid, 'EXECUTE') as anon,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
--          has_function_privilege('service_role',  p.oid, 'EXECUTE') as service_role
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
--    where p.proname in ('claim_waitlist_reward', 'check_referral_qualification',
--                        'apply_referral_code', 'plan_limit_assert', 'log_app_error',
--                        'log_notification', 'otp_issue', 'ai_usage_bump',
--                        'device_approval_check', 'app_lock_reset_check',
--                        'enforce_plan_limits', 'downgrade_expired_plans')
--    order by 1;
--   -- claim_waitlist_reward: teeno false (ya row hi nahi — agar drop ho chuka).
--   -- ai_usage_bump / otp_issue / *_check: sirf service_role true.
--
-- 4) Overload ek hi baar (duplicate hua to named-arg call "not unique" se girti hai):
--
--   select oid::regprocedure from pg_proc
--    where proname in ('check_referral_qualification', 'apply_referral_code');
--   -- Umeed: check_referral_qualification(text,text), check_referral_qualification(),
--   --        apply_referral_code(text,text,text)
--
-- 5) Referral code backfill — 0 aana chahiye:
--
--   select count(*) as bina_code from public.profiles where referral_code is null;
--
-- 6) Naye config (admin panel se badal sakte ho):
--
--   select key, value from public.app_config
--    where key in ('referral_daily_cap', 'otp_global_per_day', 'otp_intl_country_per_day');
--
-- 7) Cron jobs:
--
--   select jobname, schedule, active from cron.job
--    where jobname in ('downgrade-expired-plans', 'prune-ai-usage-daily');
--
-- 8) Free plan ki rok (kisi TEST free user ke JWT se, REST par) — 4th document
--    par `plan_limit_documents` aana chahiye, aur `file_path` bhejne par bhi
--    row me null hi padna chahiye:
--
--   POST /rest/v1/documents  { "name": "t", "type": "other", "file_path": "x/y" }
--
-- 9) AI counter chal raha hai (edge deploy ke baad ek chat karke):
--
--   select * from public.ai_usage_daily order by day desc, calls desc limit 20;
