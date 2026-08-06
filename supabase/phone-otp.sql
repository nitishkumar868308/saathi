-- Apka Saathi — Apna khud ka SMS OTP (Twilio Verify ki jagah)
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
-- NOTE: isse pehle ye do chala lena —
--   • phone-verify.sql      (`phone_verified_at`, `mark_phone_verified` — dono
--                            ab bhi waise ke waise use hote hain)
--   • rewards-referrals.sql (`app_config` table aur `cfg_int` helper, jinse
--                            neeche wali saari haddein padhi jaati hain)
--
-- ═══════════════════════════════════════════════════════════════════════
--  Twilio Verify kyun hataya
-- ═══════════════════════════════════════════════════════════════════════
--
-- Verify har verification par ALAG paisa leta hai — SMS ke daam ke UPAR. Wo
-- paisa teen cheezon ka hai: OTP banana, use sambhalna, aur galat koshishein
-- ginna. Teenon kaam chhote hain aur teenon yahan ho sakte hain. Isliye ab:
--
--   • OTP hum banate hain (crypto se, andaza lagane laayak nahi)
--   • Uska HASH yahan rehta hai (khud OTP kahin nahi likha jaata)
--   • Twilio se sirf saada SMS jaata hai (sabse sasta raasta)
--
-- ═══════════════════════════════════════════════════════════════════════
--  ⚠️ OTP app me (localStorage/AsyncStorage me) KABHI mat rakhna
-- ═══════════════════════════════════════════════════════════════════════
--
-- Ye sabse zaroori baat hai. Agar OTP app ke andar save ho, to verification ka
-- koi matlab hi nahi bachta:
--
--   • App ka storage user ke apne phone par hai. Rooted phone, adb backup, ya
--     ek reverse-engineered APK — teenon me wo saaf padha ja sakta hai.
--   • Jo check app ke andar hota hai use app ke andar hi bypass kiya ja sakta
--     hai. Hamla karne wale ko SMS ka intezaar bhi nahi karna padta.
--   • Poora sawaal hi ye hai: "kya ye number sach me is user ka hai?" Uska
--     jawab wahi jagah de sakti hai jahan user ka haath na pahunche.
--
-- Isliye OTP ka hash SIRF yahan (server/DB) hai, aur milaan bhi yahin hota hai.
-- App ko OTP kabhi dikhta hi nahi — bilkul waise hi jaise Verify ke zamane me
-- nahi dikhta tha. Bacha sirf paisa, surakhsha nahi.
--
-- ═══════════════════════════════════════════════════════════════════════
--  Rate-limit / brute-force yahan (DB me) kyun hai, code me kyun nahi
-- ═══════════════════════════════════════════════════════════════════════
--
-- Vercel par har serverless instance ki apni memory hoti hai. In-memory counter
-- (jaise `admin-rate-limit.ts`) aam soorat me kaam karta hai, par ek hamlavar
-- jo tez-tez request bhejta hai wo alag-alag instance par ja ke usse patla kar
-- deta hai. OTP par ye do tarah se mehnga hai — paisa (har SMS ka daam) aur
-- surakhsha (6 ank sirf 10 lakh me se ek hain; bina attempt-limit ke wo minton
-- me toot sakte hain).
--
-- Postgres ek hi jagah hai jise saare instance saath me dekhte hain. Isliye
-- ginti yahan hai.

create extension if not exists pgcrypto;

/**
 * Bheje gaye OTP ka hisaab.
 *
 * ⚠️ `code_hash` — kabhi asli code nahi. Wajah wahi hai jo password ke saath
 * hoti hai: DB ka backup, ek galat SELECT, ya log me chhapa hua ek row — teeno
 * soorat me plain code ka matlab hai kisi ka bhi number verify kar lena.
 * Milaan ke liye hash hi kaafi hai (hum dono taraf ek hi tareeke se banate
 * hain), isliye asli code rakhne ki koi wajah hi nahi.
 *
 * Row DELETE nahi hoti, `consumed_at` set hota hai — kyunki rate-limit ki ginti
 * isi table se hoti hai. Delete karne par hamlavar har koshish ke baad slate
 * saaf kar leta.
 */
create table if not exists public.phone_otp (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  /** E.164 — +919876543210 */
  phone       text not null,
  /** sha256(pepper : phone : code) — hex. Asli code kahin nahi. */
  code_hash   text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  /** Kitni baar galat code daala gaya. Hadd paar = ye code marr gaya. */
  attempts    int not null default 0,
  /** Sahi code daal diya gaya (ya naye code ne ise mar diya). */
  consumed_at timestamptz,
  /** Fraud dekhne ke liye — ek IP se kitne alag number. */
  ip          text,
  /** +91 → "IN". Country-wise routing aur fraud dono ke liye. */
  country     text,
  /**
   * Admin ne is user ki hadd reset kar di — ye row ab ginti me nahi aati.
   *
   * ⚠️ Reset par rows DELETE nahi hoti, ye flag lagta hai. Wajah: wahi rows
   * fraud dekhne ka ekmatra record hain. Delete kar dene par admin ko baad me
   * ye dikhta hi nahi ki us user ne pichhle hafte 40 SMS mangwaye the — aur
   * dobara reset maangne par uske paas faisla lene ka koi aadhaar nahi hota.
   */
  ignored     boolean not null default false
);

-- Purani install par column jod do (table pehle se ho sakti hai).
alter table public.phone_otp add column if not exists ignored boolean not null default false;

-- Rate-limit ke teen sawaal, teen index. Inke bina har send poori table scan
-- karta (aur wo table roz badhti hai).
create index if not exists phone_otp_user_time  on public.phone_otp (user_id, created_at desc);
create index if not exists phone_otp_phone_time on public.phone_otp (phone, created_at desc);
create index if not exists phone_otp_ip_time    on public.phone_otp (ip, created_at desc) where ip is not null;

alter table public.phone_otp enable row level security;
-- Jaan-boojh ke koi policy NAHI. RLS on + zero policy = anon/authenticated ke
-- liye table poori tarah band. Sirf service_role (jo RLS ko bypass karta hai)
-- neeche wale function se ise chhoo sakta hai. App ko is table ka rasta hi nahi
-- milna chahiye — warna wo apna hi hash padh ke aage badh sakti hai.

/* ═══════════════════════════════════════════════════════════════════════
 *  Hadd — ek jagah, taaki dono function ek hi kitaab padhein
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Har hadd `app_config` se aati hai — yaani admin panel se live badal sakti hai.
 *
 * ⚠️ Pehle ye number yahin function me likhe hue the. Wo do wajah se galat tha:
 * badalne ke liye har baar SQL chalana padta tha, aur (asli dikkat) ek user ki
 * soorat me hadd thodi der ke liye dheeli karne ka koi tareeka hi nahi tha —
 * jo user sach me phans jaata (naya phone, purana number, do-teen galat try) wo
 * poore din ke liye baahar ho jaata tha.
 *
 * Ab dono cheezein hain: admin sabke liye number badal sakta hai (yahan), aur
 * ek user ki ginti alag se reset kar sakta hai (`otp_reset_user`, neeche).
 *
 * `cfg_int` `rewards-referrals.sql` me banta hai. Key na ho to default lagta
 * hai, isliye is file ko chalane se pehle admin ko kuch set karne ki zaroorat
 * nahi.
 *
 *   otp_cooldown_seconds — do SMS ke beech ka thehraav. Iska asli faayda paisa
 *                  nahi, uljhan hai: ek number ka ek hi zinda code hota hai, to
 *                  jaldi-jaldi bheje gaye SMS purane code ko mardete hain aur
 *                  user aksar PEHLA wala daal ke "galat code" padhta hai.
 *   otp_ttl_seconds — code kitni der zinda. Default 10 minute.
 *   otp_per_hour  — ek ghante me itne se zyada SMS kisi asli user ko nahi
 *                  chahiye. 5 me do baar galat number aur teen retry aa jaate
 *                  hain.
 *   otp_per_day   — din bhar ki hadd. Yahi asli paisa bachati hai.
 *   otp_ip_per_day — ek hi jagah se itne ALAG number = script chal rahi hai.
 *   otp_max_attempts — ek code par itni galat koshish, uske baad wo code marr
 *                  gaya. 6 ank = 10 lakh sambhavnaayein; 5 koshish me tukka
 *                  lagne ka mauka 2 lakh me 1 hai.
 */
insert into public.app_config(key, value) values
  ('otp_cooldown_seconds', '30'::jsonb),
  ('otp_ttl_seconds',      '600'::jsonb),
  ('otp_per_hour',         '5'::jsonb),
  ('otp_per_day',          '15'::jsonb),
  ('otp_ip_per_day',       '40'::jsonb),
  ('otp_max_attempts',     '5'::jsonb)
on conflict (key) do nothing;

create or replace function public.otp_limits()
returns table (
  cooldown_seconds int,
  ttl_seconds      int,
  per_hour         int,
  per_day          int,
  ip_per_day       int,
  max_attempts     int
) language sql stable as $$
  select
    public.cfg_int('otp_cooldown_seconds', 30),
    public.cfg_int('otp_ttl_seconds',      600),
    public.cfg_int('otp_per_hour',         5),
    public.cfg_int('otp_per_day',          15),
    public.cfg_int('otp_ip_per_day',       40),
    public.cfg_int('otp_max_attempts',     5);
$$;

/* ═══════════════════════════════════════════════════════════════════════
 *  Naya OTP jaari karo
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Hadd jaancho, purane code maaro, naya likho.
 *
 * ⚠️ Ye sab EK hi function me isliye hai ki inke beech me kuch aa na sake.
 * Alag-alag call hoti to do request ek hi pal me dono cooldown check paas kar
 * leti aur do SMS chale jaate — bilkul wahi cheez jise rokna tha.
 *
 * SMS abhi bheja NAHI gaya hai. Ye pehle likhta hai, phir API SMS bhejti hai —
 * ulta karne par ek fail hua insert ke baad SMS ja chuka hota aur user ke paas
 * ek aisa code hota jo kisi kaam ka nahi.
 *
 * Lautata hai json:
 *   { "status": "ok" }
 *   { "status": "cooldown",  "retry_after": 17 }
 *   { "status": "too_many",  "retry_after": 2431 }
 */
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
begin
  if p_user is null or coalesce(trim(p_phone), '') = '' or coalesce(trim(p_hash), '') = '' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into lim from public.otp_limits();

  /* 1. Thehraav — pichhla SMS kitni der pehle gaya. Ye sabse sasta check hai,
   *    isliye sabse pehle. Ginti user AUR phone dono par: ek hi account alag
   *    number daal ke, ya do account ek hi number par, dono se bachna hai. */
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

  /* 2. Ghante aur din ki hadd.
   *
   * `too_many` aur `cooldown` ko app ALAG dikhati hai, aur ye farak zaroori
   * hai: cooldown 30 second ka intezaar hai (button khud khul jayega), par
   * `too_many` ka matlab hai user aaj ke liye baahar hai — wahan intezaar
   * karne ko kehna jhooth hoga. Us soorat me app profile me "support me ticket
   * raise karo" wali line dikhati hai, aur admin `otp_reset_user` se uski
   * ginti saaf kar deta hai. */
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

  /* 3. Fraud — ek hi IP se bahut saare ALAG number.
   *
   * DISTINCT phone gina jaata hai, total SMS nahi. Ek ghar/office ka NAT ek hi
   * IP dikhata hai aur wahan kai log apna-apna number verify kar sakte hain —
   * unhe rokna galat hoga. Par ek hi IP se 40 alag number ek din me = script. */
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
   * 4. Purane zinda code maaro.
   *
   * ⚠️ Iske bina ek saaf chhed reh jaata: user 3 baar "dobara bhejo" dabata,
   * teen code zinda ho jaate, aur teenon me se kisi se bhi verify ho jaata —
   * yaani hamlavar ko har SMS par ek naya 5-attempt ka mauka mil jaata.
   * Ek waqt me ek hi zinda code.
   */
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

/* ═══════════════════════════════════════════════════════════════════════
 *  Code milao
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * User ne jo daala, wo sahi hai kya.
 *
 * Lautata hai: 'ok' | 'wrong' | 'expired' | 'locked' | 'none'
 *
 * ⚠️ `attempts` HAR koshish par badhta hai — sahi ya galat, us se pehle. Agar
 * ye sirf galat par badhta, to hamlavar ek sahi-dikhta hua pattern bhej ke
 * ginti ko chhoo hi na paata. Aur agar badhne se pehle milaan hota, to ek
 * concurrent barsaat (ek hi pal me 50 request) sab ek hi `attempts` value
 * padhti aur limit kabhi lagti hi nahi. Isliye pehle `update ... returning`,
 * phir faisla — Postgres har row par ise ek-ek karke chalata hai.
 */
create or replace function public.otp_check(p_user uuid, p_phone text, p_hash text)
returns text language plpgsql security definer set search_path = public as $$
declare
  lim  record;
  row  public.phone_otp;
begin
  if p_user is null or coalesce(trim(p_phone), '') = '' or coalesce(trim(p_hash), '') = '' then
    return 'none';
  end if;

  select * into lim from public.otp_limits();

  -- Sabse naya zinda code, aur usi lamhe attempts +1. `for update` ke bina do
  -- samanantar request ek hi row padh leti hain.
  update public.phone_otp o
     set attempts = o.attempts + 1
   where o.id = (
     select id from public.phone_otp
      where user_id = p_user
        and phone = p_phone
        and consumed_at is null
      order by created_at desc
      limit 1
      for update
   )
  returning o.* into row;

  -- Is number ka koi zinda code hai hi nahi — ya to bheja hi nahi gaya, ya
  -- pehle hi use ho chuka. Dono me user ka agla kadam ek hi hai: naya mangao.
  if row.id is null then return 'none'; end if;

  if row.expires_at < now() then
    update public.phone_otp set consumed_at = now() where id = row.id;
    return 'expired';
  end if;

  -- `>` isliye ki abhi-abhi +1 ho chuka hai: 5 ki hadd par 5vi koshish abhi
  -- honi chahiye, 6vi nahi.
  if row.attempts > lim.max_attempts then
    update public.phone_otp set consumed_at = now() where id = row.id;
    return 'locked';
  end if;

  if row.code_hash = p_hash then
    update public.phone_otp set consumed_at = now() where id = row.id;
    return 'ok';
  end if;

  -- Aakhri koshish bhi galat gayi — code ab marr gaya. User ko naya mangana
  -- hoga, aur hamlavar ko bhi (jiske liye har naya code ek naya SMS hai, aur
  -- SMS par upar wali hadd lagi hui hai).
  if row.attempts >= lim.max_attempts then
    update public.phone_otp set consumed_at = now() where id = row.id;
    return 'locked';
  end if;

  return 'wrong';
end;
$$;

revoke all on function public.otp_check(uuid, text, text) from public, anon, authenticated;

/* ═══════════════════════════════════════════════════════════════════════
 *  Admin — hadd dekhna aur reset karna
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * Is user ki abhi ki haalat — app aur admin dono ke liye ek hi sach.
 *
 * App ise profile screen par use karti hai: `blocked` hone par phone number ke
 * paas "support me ticket raise karo" wali line dikhti hai. Iske bina user ko
 * sirf ek fail hui koshish dikhti thi aur kuch samajh nahi aata tha ki ab kare
 * kya — wo bas dobara-dobara try karta rehta tha (aur har try ek aur fail).
 */
create or replace function public.otp_status(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  lim        record;
  hour_count int;
  day_count  int;
begin
  select * into lim from public.otp_limits();

  select count(*) into hour_count
    from public.phone_otp
   where not ignored and user_id = p_user and created_at > now() - interval '1 hour';

  select count(*) into day_count
    from public.phone_otp
   where not ignored and user_id = p_user and created_at > now() - interval '1 day';

  return jsonb_build_object(
    'blocked',   (hour_count >= lim.per_hour or day_count >= lim.per_day),
    'sent_hour', hour_count,
    'sent_day',  day_count,
    'per_hour',  lim.per_hour,
    'per_day',   lim.per_day
  );
end;
$$;

revoke all on function public.otp_status(uuid) from public, anon, authenticated;

/**
 * Admin: is user ki OTP ginti saaf karo.
 *
 * User support me ticket raise karta hai ("mera number verify nahi ho raha"),
 * admin uski history dekh ke ye chala deta hai, aur user turant dobara koshish
 * kar sakta hai. Koi SQL nahi, koi wait nahi — ek button.
 *
 * ⚠️ Rows delete nahi hoti, `ignored` lagta hai. Wahi rows fraud dekhne ka
 * ekmatra record hain: agli baar reset maangne par admin ko dikhna chahiye ki
 * ye user pichhle mahine bhi teen baar reset karwa chuka hai. Delete kar dene
 * par har baar slate saaf dikhti hai — jo theek us aadmi ke liye faydemand hai
 * jise rokna tha.
 *
 * Lautata hai: kitni rows ginti se hataayi gayi.
 */
create or replace function public.otp_reset_user(p_user uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_user is null then return 0; end if;
  update public.phone_otp
     set ignored = true
   where user_id = p_user
     and not ignored;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.otp_reset_user(uuid) from public, anon, authenticated;

/* ═══════════════════════════════════════════════════════════════════════
 *  Safai
 * ═══════════════════════════════════════════════════════════════════════ */

/**
 * 30 din se purani rows hata do.
 *
 * Rate-limit ki sabse lambi khidki 1 din hai, par thoda itihaas fraud dekhne me
 * kaam aata hai. 30 din ke baad wo bhi bekaar hai aur table bas bhaari hoti hai.
 *
 * Cron se chalao (Supabase > Database > Cron), roz ek baar:
 *   select public.otp_prune();
 */
create or replace function public.otp_prune()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.phone_otp where created_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.otp_prune() from public, anon, authenticated;
