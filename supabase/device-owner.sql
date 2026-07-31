-- Apka Saathi — "Ye device kiske liye set hai?"
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
-- NOTE: pehle devices-analytics.sql, profiles.sql aur rewards-referrals.sql
--       chala lena (aakhri wali me `mask_email()` banta hai, jo yahan chahiye).
--
-- Ek phone Saathi ke liye EK hi user ka ghar hai. Wajah technical hai, niyam
-- nahi:
--
--   • Notification (FCM) ka token phone ka hota hai, user ka nahi. Doosra user
--     login karte hi `save_device_token` us token ka maalik badal deta hai —
--     yaani pehle wale user ke reminder ki notification is phone par aani BAND
--     ho jaati hai.
--   • Reminder ke alarm (notifee) bhi phone ke andar lagte hain aur wo usi user
--     ke data se bante hain jo abhi login hai.
--   • Referral ka reward ek device par ek hi baar milta hai.
--
-- Ab tak ye sab chup-chaap hota tha. Doosra banda login karta, sab theek dikhta,
-- aur do log ye samajh nahi paate the ki ek ke reminder kyun aana band ho gaye.
--
-- Ye function login se PEHLE bhi poocha ja sakta hai (anon), isliye jaankari
-- jaan-boojh ke kam aur dhundhli lautayi jaati hai: naam ka pehla hissa aur
-- email ka mask kiya hua roop. Poora email kabhi nahi jaata.

-- Email masking ke liye `public.mask_email()` use hota hai, jo pehle se
-- `rewards-referrals.sql` me bana hua hai ("ra••••@gmail.com").
--
-- ⚠️ Use yahan dobara mat banana. Wo `mask_email(e text)` naam se bana hai, aur
-- doosre naam wale parameter ke saath `create or replace` chalane par Postgres
-- saaf mana kar deta hai:
--     ERROR: cannot change name of input parameter "e"
-- Aur usse zabardasti drop karna aur bhi bura hota — `my_rewards()` aur
-- referral wale doosre function usi par tike hain.

/**
 * Is device ka "ghar" kiska hai?
 *
 * Maalik = `first_user_id` — jo is phone par SABSE PEHLE login hua tha. Jaan
 * boojh ke `last_user_id` nahi: warna doosra banda login karte hi wo khud maalik
 * ban jaata aur chetavni kabhi dikhti hi nahi (jo poori baat ka ulta hai).
 *
 * Lautata hai:
 *   claimed  — is device ka koi maalik darj hai
 *   is_me    — abhi jo login hai wahi maalik hai (tab kuch dikhana nahi)
 *   name     — maalik ka pehla naam (poora naam nahi)
 *   email    — mask kiya hua email
 *
 * anon ko bhi mila hai kyunki login screen par (session se pehle) bhi ye
 * dikhana kaam ka hai. Row sirf us device ke apne UUID se milti hai, jo sirf usi
 * phone ke SecureStore me hota hai.
 */
create or replace function public.device_owner(p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare owner_id uuid; owner_name text; owner_email text;
begin
  if p_id is null or length(trim(p_id)) < 8 then
    return jsonb_build_object('claimed', false);
  end if;

  select first_user_id into owner_id from public.devices where id = p_id;
  if owner_id is null then
    return jsonb_build_object('claimed', false);
  end if;

  select full_name, email into owner_name, owner_email
    from public.profiles where id = owner_id;

  return jsonb_build_object(
    'claimed', true,
    'is_me', owner_id = auth.uid(),
    -- Sirf pehla shabd — poora naam batane ki koi zaroorat nahi.
    'name', nullif(split_part(coalesce(owner_name, ''), ' ', 1), ''),
    'email', public.mask_email(owner_email)
  );
end;
$$;

revoke all on function public.device_owner(text) from public;
grant execute on function public.device_owner(text) to anon, authenticated;
