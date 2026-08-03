-- Apka Saathi — Phone number ka SMS OTP verification
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
-- NOTE: pehle locations-billing.sql chala lena (`user_details` wahin banta hai).
--
-- Ab tak phone sirf LIKHA jaata tha. `user_details.phone` me jo bhi dal do wahi
-- sach maan liya jaata tha, aur usi par reminder ka WhatsApp chala jaata tha.
-- Do cheezein iski wajah se toot-ti thi:
--
--   • Ek digit galat ho to reminder kisi AJNABI ke WhatsApp par jaata tha, aur
--     asli user ko kabhi kuch nahi milta. Dono me se kisi ko pata bhi nahi
--     chalta ki kyun.
--   • Ek hi number kitne bhi accounts me daala ja sakta tha. Yaani ek phone
--     number se kitne bhi "verified" dikhne wale account bante rehte.
--
-- Ab number tabhi bharosemand maana jaata hai jab us par SMS ka OTP pahunch ke
-- wapas confirm ho jaye (Twilio Verify se — wo khud OTP banata, bhejta aur
-- check karta hai; hum kabhi OTP na banate hain na store karte hain).

alter table public.user_details
  add column if not exists phone_verified_at timestamptz;

/**
 * Ek verified number = ek account. Bas.
 *
 * ⚠️ Ye check code me karne ki koshish mat karna. "Pehle SELECT karke dekho ki
 * kisi aur ka to nahi, phir UPDATE karo" ek classic race hai: do log ek hi
 * number ek hi pal me verify karein to dono ka SELECT khaali aata hai aur dono
 * ka UPDATE chal jaata hai. Postgres ka unique index hi wo ek jagah hai jahan
 * ye kabhi galat nahi ho sakta — do me se ek insert/update pakka fail hoga,
 * aur usi fail ko API "ye number kisi aur account me laga hai" me badal deti hai.
 *
 * Partial index hai — sirf VERIFIED numbers par. Bina verify kiya number kitne
 * bhi log likh sakte hain (aur likhte hain: log typo karte hain, number badalte
 * hain). Rok sirf wahan hai jahan number sach saabit ho chuka hai.
 */
create unique index if not exists user_details_verified_phone_uniq
  on public.user_details (phone)
  where phone_verified_at is not null;

/**
 * Number badla to verification apne aap khatam.
 *
 * ⚠️ Iske bina sabse bada chhed khul jaata: user apna number verify karta, phir
 * chup-chaap use kisi aur number se badal deta — aur `phone_verified_at` waise
 * ka waisa pada rehta. Yaani ek OTP se koi bhi number "verified" ban jaata.
 *
 * Trigger isliye, app ke code me nahi: `user_details` app se seedha update hota
 * hai (profile screen), aur wahan ye baat bhoolna bahut aasan hai. Yahan bhoola
 * hi nahi ja sakta.
 */
create or replace function public.user_details_reset_phone_verification()
returns trigger language plpgsql as $$
begin
  if new.phone is distinct from old.phone then
    new.phone_verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists user_details_phone_changed on public.user_details;
create trigger user_details_phone_changed
  before update of phone on public.user_details
  for each row execute function public.user_details_reset_phone_verification();

/**
 * Verify ho chuke number ko is user ke naam par likho.
 *
 * Sirf service_role — yaani sirf wo API route jo Twilio se "approved" sun chuka
 * hai. App se seedha bulaya ja sakta hota to `phone_verified_at` koi bhi khud
 * set kar leta aur poora OTP bekaar ho jaata.
 *
 * Lautata hai: 'ok' | 'taken'
 */
create or replace function public.mark_phone_verified(p_user uuid, p_phone text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or coalesce(trim(p_phone), '') = '' then
    return 'invalid';
  end if;

  /**
   * DO QADAM — aur ye ek saath NAHI ho sakte.
   *
   * ⚠️ Pehla tarika ye tha: ek hi upsert me `phone` aur `phone_verified_at`
   * dono set kar do. Wo chup-chaap TOOTA hua tha, aur iski wajah Postgres ka
   * order hai: BEFORE trigger UPDATE ke SET ke BAAD chalta hai aur NEW ko
   * badal sakta hai — yaani upar wala `user_details_phone_changed` trigger
   * hamare `phone_verified_at = now()` ko null kar deta.
   *
   * Natija bilkul aisa dikhta jaise sab theek hai: OTP sahi nikalta, API "ok"
   * lautati, app "Verified ✓" dikha deti — aur DB me verification hoti hi
   * nahi. Agli baar screen khulne par tick gayab. Sirf NAYE number par (jab
   * `phone` sach me badla ho), yaani theek us soorat me jiske liye ye function
   * bana hai.
   *
   * Isliye:
   *   1. phone likho (trigger chale to chale — verification ab lagni hi hai)
   *   2. alag UPDATE se sirf `phone_verified_at`. Trigger `update of phone` par
   *      bandha hai, aur is statement me `phone` hai hi nahi — isliye wo chalta
   *      hi nahi.
   */
  insert into public.user_details (user_id, phone)
  values (p_user, p_phone)
  on conflict (user_id) do update
    set phone = excluded.phone,
        updated_at = now();

  update public.user_details
     set phone_verified_at = now()
   where user_id = p_user;

  return 'ok';
exception
  -- Upar wala unique index. Iska matlab bilkul ek hi hai: ye number pehle se
  -- kisi DOOSRE account me verify ho chuka hai.
  when unique_violation then
    return 'taken';
end;
$$;

revoke all on function public.mark_phone_verified(uuid, text) from public, anon, authenticated;
-- Sirf service_role (web ka /api/phone/verify-otp).

/**
 * "Ye number pehle se kisi aur ke paas verified to nahi?"
 *
 * OTP BHEJNE se pehle ka check. Ye pakka nahi hai (race upar wale index se
 * rukti hai, yahan se nahi) — iska kaam sirf itna hai ki 6 digit type karwane
 * ke BAAD "ye number to kisi aur ka hai" na kehna pade. Ek SMS ka paisa bhi
 * bach jaata hai.
 */
create or replace function public.phone_taken_by_other(p_user uuid, p_phone text)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.user_details
     where phone = p_phone
       and phone_verified_at is not null
       and user_id is distinct from p_user
  );
$$;

revoke all on function public.phone_taken_by_other(uuid, text) from public, anon, authenticated;
