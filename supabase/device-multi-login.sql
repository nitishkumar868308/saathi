-- Apka Saathi — "Aapka account aur kitne phones par login hai?"
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
-- NOTE: pehle devices-analytics.sql chala lena (`devices` table wahin banta hai).
--
-- `device-owner.sql` ek hi sawaal ka jawab deta hai: "IS PHONE par pehle koi
-- AUR tha kya?" — yaani ek phone, do log.
--
-- Uska ulta sawaal kahin poocha hi nahi jaata tha: "MERA account aur kitne
-- phones par login hai?" — yaani ek account, kai phone. Aur yahi wo soorat hai
-- jisme sab kuch chup-chaap toot-ta hai:
--
--   • Reminder ke alarm har phone me ALAG lagte hain. Doosre phone par app
--     kholi hi nahi, to wahan ke alarm purane pade rehte hain — badla hua
--     reminder wahan purane waqt par bajta rehta hai.
--   • FCM token har phone ka apna hai, par `save_device_token` ek token ka
--     maalik ek hi user rakhta hai. Ek hi account ke do phone chalein to
--     admin ka bheja message dono par jaata hai — user ko lagta hai "do baar
--     kyun aaya".
--   • Account share ho raha ho (ghar me ek hi ID) to kisi ko ye kabhi pata
--     nahi chalta ki uske documents doosre phone par bhi khule pade hain.
--
-- In teeno ka koi error nahi aata. Isliye ye function sirf ITNA batata hai ki
-- aur kitne phone hain aur wo kis tarah ke hain — na koi ID, na koi token.

/**
 * Mere account ke doosre active phone.
 *
 * `p_id` = abhi wala device (SecureStore ka UUID) — use ginti se hata dete
 * hain, warna har akela user bhi "1 doosra phone" dekhta.
 *
 * "Active" = pichhle `p_days` din me dikha. Jaan-boojh ke window rakhi hai:
 * do saal purana bech diya hua phone chetavni ke laayak nahi hai, aur usse
 * ginti hamesha badhti hi jaati (kabhi ghatti nahi) — jo dheere-dheere is
 * chetavni ko jhooth bana deta.
 *
 * Lautata hai:
 *   count   — doosre phone kitne (abhi wala nikaal kar)
 *   devices — [{ platform, last_seen_at }] — sirf itna. Koi device id nahi,
 *             kyunki wahi ek cheez hai jisse doosre phone ko pehchana ja sake.
 */
create or replace function public.my_other_devices(
  p_id text default null,
  p_days int default 30
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare res jsonb; n int;
begin
  if auth.uid() is null then
    return jsonb_build_object('count', 0, 'devices', '[]'::jsonb);
  end if;

  select count(*)::int,
         coalesce(jsonb_agg(jsonb_build_object(
           'platform', d.platform,
           'last_seen_at', d.last_seen_at
         ) order by d.last_seen_at desc), '[]'::jsonb)
    into n, res
  from (
    select platform, last_seen_at
      from public.devices
     where last_user_id = auth.uid()
       -- Abhi wala phone apni hi ginti me nahi aana chahiye. `p_id` null ho
       -- (purane app build) to sab dikhenge — tab UI ek zyada ginega, par
       -- chetavni na dikhne se behtar hai.
       and (p_id is null or id <> p_id)
       and last_seen_at >= now() - make_interval(days => greatest(1, least(p_days, 365)))
     order by last_seen_at desc
     limit 20
  ) d;

  return jsonb_build_object('count', coalesce(n, 0), 'devices', res);
end;
$$;

revoke all on function public.my_other_devices(text, int) from public, anon;
-- Sirf logged-in user — aur wo bhi sirf apne hi phone dekh sakta hai (auth.uid()).
grant execute on function public.my_other_devices(text, int) to authenticated;


/**
 * "Baaki sab phones se logout" — devices table par bhi lagu karo.
 *
 * ⚠️ Ye function pehle THA HI NAHI, aur uski kami se ek button poori tarah
 * jhooth bol raha tha. App ka `signOutOtherDevices()` sirf Supabase ke refresh
 * TOKEN revoke karta hai — us se `devices` table ko koi farak nahi padta. Aur
 * upar wala `my_other_devices()` ginti wahin se leta hai.
 *
 * Natija theek wahi tha jo user ne pakda: "Sign out all other phones" dabao,
 * "ho gaya" wala toast bhi aaye, aur agli baar login karte hi wahi chetavni
 * phir se — "aapki ID aur bhi phones par login hai". Row 30 din tak padi rehti
 * thi, isliye chetavni 30 din tak lauttti rehti thi.
 *
 * Ab `last_user_id` hata dete hain: wo phone ab kisi ke naam par nahi rehta,
 * ginti se nikal jaata hai, aur uspar is user ka koi push bhi nahi jaata.
 *
 * ⚠️ Row DELETE nahi karte. `devices` me hardware/analytics ki jaankari bhi
 * hai, aur usi id par wo phone kal dobara login kar sakta hai — tab wo apne
 * aap wapas apne naam par aa jaata hai.
 */
create or replace function public.release_my_other_devices(p_id text default null)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return 0; end if;

  update public.devices
     set last_user_id = null
   where last_user_id = auth.uid()
     -- Abhi wala phone chalu rehna chahiye — yahi to "baaki sab" ka matlab hai.
     and (p_id is null or id <> p_id);

  get diagnostics n = row_count;
  return coalesce(n, 0);
end;
$$;

revoke all on function public.release_my_other_devices(text) from public, anon;
grant execute on function public.release_my_other_devices(text) to authenticated;
