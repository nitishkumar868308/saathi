-- Apka Saathi — Admin: notes ka poora matn
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
-- NOTE: pehle notes.sql aur notes-reminder-link.sql chala lena.
--
-- ============================================================================
-- ⚠️ YE EK SOCHA-SAMJHA BADLAAV HAI — padh lena zaroori hai
-- ============================================================================
--
-- Ab tak admin ko notes ka sirf HISAAB dikhta tha (kisne kitne likhe, kitno ka
-- reminder bana) — matn kabhi nahi. Wo rok jaan-boojh ke lagayi gayi thi.
--
-- Ab matn bhi dikhta hai, kyunki maalik ne yahi maanga. Par jo baat pehle sach
-- thi wo ab bhi utni hi sach hai, aur usse aankh churana theek nahi:
--
--   Note user ki sabse niji cheez hai. Usme bazaar ki list bhi hoti hai aur
--   kisi ka phone number bhi; paise ka hisaab bhi, aur wo baatein bhi jo aadmi
--   kisi ko nahi batata. User ne ye sab is bharose par likha ki ye uska apna
--   hai.
--
-- Isliye ye function chalane se pehle DO cheezein poori honi chahiye:
--
--   1. PRIVACY POLICY me saaf likha ho ki notes ka matn support/admin dekh
--      sakta hai. Ye likhe bina dekhna, kai jagah kanoonan bhi galat hai
--      (India ka DPDP Act, EU ka GDPR) — aur bharose ke lihaaz se hamesha.
--   2. Admin panel me ye sirf unhi logon ke paas ho jinhe sach me chahiye
--      (`notes` menu ki permission — dekho lib/admin-menus.ts).
--
-- Neeche `admin_notes_list` sirf service_role ke liye khula hai, yaani sirf
-- admin API se — kisi logged-in user se seedha nahi chalta.

/**
 * Admin: notes ka poora matn — chhaan-been ke saath.
 *
 *   p_user   — sirf ek user ke note (null = sabke)
 *   p_search — title/body me ye lafz dhoondho (null/khaali = sab)
 *   p_limit  — ek page me kitne
 *   p_offset — kahan se
 *
 * `total` alag se lautta hai (page ke bahar wali poori ginti) — uske bina
 * pagination ka koi matlab nahi banta: admin ko pata hi nahi chalta ki aur
 * kitne bache hain.
 *
 * ⚠️ Matn JAISA HAI WAISA lautta hai — line break, khaali lines, spacing sab.
 * Kuch trim ya saaf nahi hota. Note ka dhaancha hi aksar uska aadha matlab
 * hota hai (list, ginti, do hisson me bata hua kuch) — use ek line me chipka
 * dena, use padhne layak hi nahi chhodta.
 */
create or replace function public.admin_notes_list(
  p_user   uuid    default null,
  p_search text    default null,
  p_limit  int     default 50,
  p_offset int     default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  res    jsonb;
  lim    int := greatest(1, least(coalesce(p_limit, 50), 200));
  off    int := greatest(0, coalesce(p_offset, 0));
  -- Khaali search aur "koi search nahi" ek hi baat hai. Iske bina khaali
  -- textbox par har note `%%` se match hota — chalta to hai, par har keystroke
  -- par poori table par ILIKE chal jaata.
  q      text := nullif(btrim(coalesce(p_search, '')), '');
begin
  select jsonb_build_object(
    'total', (
      select count(*)
      from public.notes n
      where (p_user is null or n.user_id = p_user)
        and (q is null or n.title ilike '%' || q || '%' or n.body ilike '%' || q || '%')
    ),
    'notes', coalesce((
      select jsonb_agg(x order by x.ord)
      from (
        select
          row_number() over (
            -- Pin kiye hue upar — user ke apne phone me bhi wahi kram hai,
            -- aur admin ko wahi dikhna chahiye jo user dekhta hai.
            order by n.is_pinned desc, n.updated_at desc
          ) as ord,
          n.id,
          n.user_id,
          p.full_name,
          p.email,
          n.title,
          n.body,
          n.is_pinned,
          -- Note se reminder bana ya nahi — Notes page ka sabse kaam ka aankda.
          (n.reminder_id is not null) as has_reminder,
          n.created_at,
          n.updated_at
        from public.notes n
        left join public.profiles p on p.id = n.user_id
        where (p_user is null or n.user_id = p_user)
          and (q is null or n.title ilike '%' || q || '%' or n.body ilike '%' || q || '%')
        order by n.is_pinned desc, n.updated_at desc
        limit lim offset off
      ) x
    ), '[]'::jsonb)
  ) into res;

  return res;
end;
$$;

-- ⚠️ Sirf service_role. Ye `security definer` hai, yaani RLS ko lang jaata hai
-- — `authenticated` ko dena ka matlab hota har logged-in user SABKE note padh
-- sakta. Ye revoke is file ki sabse zaroori line hai.
revoke all on function public.admin_notes_list(uuid, text, int, int)
  from public, anon, authenticated;

-- Search har baar poori table par ILIKE chalati hai. Notes badhne par wo
-- dheere padta hai, isliye trigram index — `%lafz%` wali khoj ismein hi tez
-- hoti hai (aam b-tree index aise search par kaam hi nahi aata).
create extension if not exists pg_trgm;

create index if not exists notes_body_trgm_idx  on public.notes using gin (body  gin_trgm_ops);
create index if not exists notes_title_trgm_idx on public.notes using gin (title gin_trgm_ops);

/* ------------------------------------------------------------------ */
/*  Jaanch                                                             */
/* ------------------------------------------------------------------ */

-- select public.admin_notes_list(null, null, 5, 0);
-- select public.admin_notes_list(null, 'bazaar', 20, 0);
