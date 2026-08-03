-- Apka Saathi — Reviews website par, sirf admin ki manzoori ke baad (item 1)
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
-- NOTE: pehle reviews.sql, profiles.sql aur locations-billing.sql chala lena.
--
-- App me review lete waqt user se saaf poocha jaata hai: "I allow Apka Saathi to
-- display this review on its website" (`reviews.allow_display`). Ab tak us haan
-- ka koi matlab nahi tha — website par teen HAATH SE LIKHE testimonial pade the
-- ("Rohit S., Delhi") aur unke upar likha tha "Asli Saathi users ki asli baat".
-- Jo logon ne sach me haan kaha tha, unki baat kahin dikhti hi nahi thi.
--
-- Yahan se wo baat website tak pahunchti hai — par SEEDHA nahi. Do darwaze hain,
-- aur DONO khulne zaroori hain:
--
--     user ki anumati (allow_display)  +  admin ki manzoori (web_status)
--
-- Ye do alag cheezein hain aur unhe alag rakhna zaroori hai. Anumati user ki
-- marzi hai — sirf wahi de ya wapas le sakta hai. Manzoori chhaanti hai: gaali,
-- spam, ya kisi ka phone number likha hua review bhi allow_display = true ke
-- saath aa sakta hai, aur bina manzoori ke wo seedha landing page par chala
-- jaata. Naya review hamesha `pending` hota hai — kuch na karo to website par
-- kuch bhi apne aap nahi jaata.
--
-- Teen cheezein dhyan se:
--
--   1. Website par kuch bhi anon (bina login) padhta hai. Isliye `reviews` table
--      par koi anon SELECT policy NAHI khol rahe — warna user_id bhi bahar chala
--      jaata. Ek security-definer function sirf utna hi lautata hai jitna page par
--      dikhna chahiye: rating, text, pehla naam, sheher, tareekh.
--
--   2. `web_status` sirf service_role (admin API) se badalta hai. User ke paas
--      uske apne review par bhi is column ka haq nahi — warna manzoori ka matlab
--      hi khatam.
--
--   3. Review BADALNE par manzoori khud-ba-khud khatam ho jaati hai (neeche
--      trigger). Iske bina moderation ek dikhava bhar hota: koi saaf review
--      likhta, approve ho jaata, aur phir usse edit karke kuch bhi likh deta.

/* ------------------------------------------------------------------ */
/* 1. Manzoori ka darja — pending / approved / rejected                */
/* ------------------------------------------------------------------ */

alter table public.reviews
  add column if not exists web_status text not null default 'pending';

-- Sirf teen values. Bina is rok ke ek typo ("aproved") ka matlab yahi hota ki
-- review chup-chaap kabhi dikhta hi nahi, aur wajah dhoondhna bahut mushkil.
alter table public.reviews drop constraint if exists reviews_web_status_chk;
alter table public.reviews add constraint reviews_web_status_chk
  check (web_status in ('pending', 'approved', 'rejected'));

-- Kisne kab manzoori di — baad me "ye kaise live chala gaya" ka jawab isse milta hai.
alter table public.reviews add column if not exists web_status_at timestamptz;

-- Website ka query hamesha yahi do shart lagata hai — index usi kram me.
create index if not exists reviews_public_idx
  on public.reviews (web_status, allow_display, created_at desc);

-- ⚠️ Ek purana raasta hata rahe hain: pehle is file me `web_hidden` (ek simple
-- on/off) tha. Wo "kuch na karo to review live" wala default deta tha, jo galat
-- taraf jhukta hai — moderation ka matlab hi ye hai ki default NA ho. Column
-- agar pehle ban chuka hai to uski value ko ek baar `web_status` me utaar dete
-- hain, taaki jo review pehle se chhupaya gaya tha wo rejected hi rahe.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'reviews' and column_name = 'web_hidden'
  ) then
    execute $mig$
      update public.reviews
         set web_status = case when web_hidden then 'rejected' else web_status end
       where web_status = 'pending'
    $mig$;
    execute 'alter table public.reviews drop column web_hidden';
  end if;
end $$;

/* ------------------------------------------------------------------ */
/* 2. Review badla → manzoori khatam                                   */
/* ------------------------------------------------------------------ */
/**
 * Rating ya text badle to darja wapas `pending`.
 *
 * ⚠️ Iske bina moderation ek dikhava bhar hai: koi saaf-suthra review likhta,
 * admin approve kar deta, aur phir app se usse edit karke kuch bhi likh deta —
 * aur wo naya text seedha landing page par live hota, bina kisi ke dekhe.
 *
 * Sirf rating/text par. Anumati (`allow_display`) badalne se darja nahi badalta:
 * user apni haan wapas le kar phir de de, to phir se manzoori maangna bekaar
 * pareshani hai — text wahi hai jo admin ne padha tha.
 */
create or replace function public.reviews_reset_web_status()
returns trigger language plpgsql set search_path = public as $$
begin
  -- Admin ne khud darja badla ho (approve/reject) to usse mat chhedo.
  if new.web_status is distinct from old.web_status then
    new.web_status_at := now();
    return new;
  end if;

  if new.rating is distinct from old.rating
     or coalesce(new.text, '') is distinct from coalesce(old.text, '') then
    new.web_status := 'pending';
    new.web_status_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_web_status_guard on public.reviews;
create trigger reviews_web_status_guard
  before update on public.reviews
  for each row execute function public.reviews_reset_web_status();

/* ------------------------------------------------------------------ */
/* 3. Website ka data — public_reviews()                               */
/* ------------------------------------------------------------------ */
/**
 * Website par dikhane laayak reviews.
 *
 * Shartein:
 *   • user ne anumati di ho (allow_display)
 *   • admin ne manzoori di ho (web_status = 'approved')
 *   • kuch LIKHA bhi ho — akela 5-star bina text ke card me dikhane laayak nahi
 *     hai (khaali quote bhadda lagta hai). "Kitne logon ne rating di" wala
 *     hisaab neeche `public_review_stats()` alag se deta hai.
 *
 * Naam: sirf pehla shabd + surname ka pehla akshar ("Rohit S.") — bilkul wahi
 * shakal jo pehle handwritten testimonials ki thi. Poora naam ya email KABHI
 * nahi jaata. Naam hi na ho to null (page use "Saathi user" dikha dega).
 *
 * Sheher: user_details → cities se, agar user ne bharaa ho. Ye publicly dikhta
 * hai isliye sirf sheher — na state, na address, na phone.
 */
create or replace function public.public_reviews(p_limit int default 12)
returns jsonb language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) into res
  from (
    /**
     * Do parat kyun — pehle ek banda ek review, PHIR sabse naye N.
     *
     * ⚠️ Ye ek hi query me nahi ho sakta, aur wahi galti aasaan hai. `distinct on
     * (user_id)` ke saath Postgres ORDER BY ka pehla column user_id hi maangta
     * hai; usi query par LIMIT lagate to wo "sabse naye N reviews" nahi, "kisi
     * bhi N user ke reviews" de deta — landing page par purane review baithe
     * rehte aur aaj approve hua review kabhi dikhta hi nahi. Isliye chhaanti
     * andar, ginti bahar.
     *
     * `distinct on` ki zaroorat isliye hai ki `reviews` par per-user koi unique
     * rok NAHI hai: app ek hi baar poochta hai, par reinstall ke baad wo yaad bhi
     * mit jaati hai aur doosri row ban jaati hai. Uske bina ek hi aadmi ka naam
     * do-teen card me dikh sakta tha — wahi pehli cheez hai jise log dekh kar
     * "fake reviews" kehte hain.
     */
    select *
    from (
      select distinct on (r.user_id)
        r.id,
        r.rating,
        r.text,
        r.created_at,
        -- "Rohit S." — pehla naam + surname ka pehla akshar (agar surname ho).
        nullif(
          trim(
            split_part(coalesce(p.full_name, ''), ' ', 1) ||
            case
              when split_part(coalesce(p.full_name, ''), ' ', 2) <> ''
                then ' ' || left(split_part(p.full_name, ' ', 2), 1) || '.'
              else ''
            end
          ),
          ''
        ) as name,
        c.name as city
      from public.reviews r
      left join public.profiles p on p.id = r.user_id
      left join public.user_details ud on ud.user_id = r.user_id
      left join public.cities c on c.id = ud.city_id
      where r.allow_display
        and r.web_status = 'approved'
        and r.text is not null
        and length(trim(r.text)) >= 8
      -- Har user ki SABSE NAYI approved row bache — wahi uski asli raay hai.
      order by r.user_id, r.created_at desc
    ) latest
    order by latest.created_at desc
    limit greatest(1, least(coalesce(p_limit, 12), 60))
  ) x;

  return res;
end;
$$;

/**
 * "X logon ne Saathi ko Y star diye".
 *
 * Do faisle yahan jaan-boojh ke:
 *
 *   1. Ye ginti APPROVED reviews par hoti hai, sab par nahi. Pehli soch ulti thi
 *      ("rating ek raay hai, ginti me sab aane chahiye"), par ye number landing
 *      page par `aggregateRating` structured data me jaata hai — aur Google ki
 *      shart hai ki wahi number usi page par DIKHTA bhi ho. Jo review page par
 *      nahi hai use ginna wahi banaya-hua rating markup ban jaata jispar manual
 *      action aata hai. Isliye jo dikhta hai, wahi ginta hai.
 *
 *   2. Ek banda = ek vote (`distinct on`). Ek hi aadmi ki do rows ko do log gin
 *      lena galat aankda hai.
 */
create or replace function public.public_review_stats()
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'count', count(*)::int,
    'avg',   case when count(*) = 0 then null
                  else round(avg(rating)::numeric, 1) end
  )
  from (
    select distinct on (user_id) rating
    from public.reviews
    where allow_display
      and web_status = 'approved'
      and text is not null
      and length(trim(text)) >= 8
    order by user_id, created_at desc
  ) one_per_user;
$$;

revoke all on function public.public_reviews(int) from public;
revoke all on function public.public_review_stats() from public;
grant execute on function public.public_reviews(int) to anon, authenticated;
grant execute on function public.public_review_stats() to anon, authenticated;

/* ------------------------------------------------------------------ */
/* 4. Apni anumati wapas lena (app)                                    */
/* ------------------------------------------------------------------ */
--
-- `reviews.sql` me insert aur select ki policy hai par UPDATE ki nahi thi. Iska
-- matlab tha ki user apni hi anumati wapas nahi le sakta — "website par dikhao"
-- galti se tick ho gaya to phir kuch nahi ho sakta tha. Wo theek nahi hai (aur
-- privacy ke lihaaz se bhi galat), isliye apni row par update khol rahe hain.
--
-- ⚠️ `web_status` yahan se badla NAHI ja sakta — wo admin ka faisla hai. Policy
-- row deti hai, column nahi, isliye rok column-level grant se lagti hai: pehle
-- poora update chheeno, phir sirf teen column wapas do.
drop policy if exists "own review update" on public.reviews;
create policy "own review update" on public.reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke update on public.reviews from authenticated;
grant update (rating, text, allow_display) on public.reviews to authenticated;
