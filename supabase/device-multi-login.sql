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
