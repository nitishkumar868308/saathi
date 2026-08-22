-- ============================================================================
-- Phase 17 — templates + brand presets
--
-- Ise Supabase ke SQL editor me ek baar chala do. Dobara chalana safe hai.
--
-- ⚠️⚠️ `create table if not exists` ne yahan ek chup-chaap jaal bana diya tha,
-- aur wo asli chal kar pakda gaya (2026-08-22). Baat ye hai:
--
--   * `supabase/reel-studio.sql` (Phase 2) me bhi `reel_templates` aur
--     `reel_brand_presets` banti hain — par **poore alag dhaanche** ke saath
--     (`id uuid`, `tags`, `thumbnail_r2_key`; owner_id/is_builtin naam ki koi
--     cheez nahi).
--   * Wo file pehle chal chuki hoti hai, isliye neeche wala
--     `create table if not exists` **kuch nahi karta** — aur koi error bhi nahi
--     deta. Sab theek chalta dikhta hai.
--   * Phir do line neeche `create index ... (owner_id, ...)` par jaakar phat'ta
--     hai: `ERROR: 42703: column "owner_id" does not exist`. Aur us error se
--     bilkul lagta hai ki galti index me hai, jabki galti 15 line upar hai.
--
-- Isliye ab ye file `if not exists` par bharosa nahi karti. Neeche wala block
-- dekhta hai ki table purane dhaanche ki to nahi, aur ho to use **naye sire se
-- banata hai** — par sirf tab jab wo **khaali** ho. Ek bhi row hui to wo saaf
-- mana kar deta hai, taaki kisi ka kaam chup-chaap na mit jaaye.
--
-- ⚠️ Dono table me asli cheez ek `jsonb` column hai (`doc` aur `tokens`), aur ye
-- jaan-boojhkar hai. Template ke har slot ke liye ek column banane par har naye
-- slot kind par ek migration likhni padti — aur template ka poora point hi ye
-- hai ki wo **data** hai, schema nahi. Shape ki jaanch `TemplateSchema` (zod)
-- karta hai, DB nahi.
-- ============================================================================

/* ------------------------------------------------------------------------
 * Pehle ye: `reel-studio.sql` chal chuki hai ya nahi.
 *
 * ⚠️ Ye file uspar tiki hui hai (`reel_touch_updated_at`, `auth.users`), par wo
 * nirbharta kahin likhi nahi thi. Bina uske yahan ka error kisi aur cheez ka
 * dikhta hai aur aadmi galat jagah dhoondhta rehta hai.
 * ------------------------------------------------------------------------ */
do $need$
begin
  if to_regprocedure('public.reel_touch_updated_at()') is null then
    raise exception
      'public.reel_touch_updated_at() nahi mila — pehle supabase/reel-studio.sql chalao, phir ye file.';
  end if;
end
$need$;

/* ------------------------------------------------------------------------
 * Purane dhaanche ki table ho to use hatao — par sirf khaali ho tab.
 * ------------------------------------------------------------------------ */
do $rebuild$
declare
  v_table text;
  v_rows  bigint;
begin
  foreach v_table in array array['reel_templates', 'reel_brand_presets']
  loop
    -- Table hai hi nahi to kuch karne ko nahi — neeche create bana dega.
    if to_regclass('public.' || v_table) is null then
      continue;
    end if;

    -- `owner_id` hai matlab dhaancha pehle se naya hai. Haath mat lagao.
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = v_table and column_name = 'owner_id'
    ) then
      continue;
    end if;

    /*
     * ⚠️ Yahan pahunche matlab table purane dhaanche ki hai. Ab ek hi sawaal
     * maayne rakhta hai: usme kisi ka kaam pada hai ya nahi.
     *
     * Khaali ho to naye sire se banana bilkul surakshit hai. Ek bhi row ho to
     * ruk jaana hi sahi hai — `drop cascade` chala dena us aadmi ka kaam mita
     * deta jise pata bhi nahi chalta ki kya gaya. Aur wo nuksaan wapas nahi
     * aata.
     */
    execute format('select count(*) from public.%I', v_table) into v_rows;

    if v_rows > 0 then
      raise exception
        'public.% purane dhaanche ki hai aur usme % row hain. Ye file use naye sire se banati hai, par khaali table hi hataayegi. Pehle wo rows kahin bacha lo (ya khud tay karo ki nahi chahiye), phir dobara chalao.',
        v_table, v_rows;
    end if;

    raise notice 'public.% purane dhaanche ki thi aur khaali thi — naye sire se bana rahe hain', v_table;
    execute format('drop table public.%I cascade', v_table);
  end loop;
end
$rebuild$;

create table if not exists public.reel_templates (
  id          text primary key,
  owner_id    uuid references auth.users (id) on delete cascade,
  name        text not null,
  description text not null default '',

  -- Poora template — `TemplateSchema` ke hisaab se.
  doc         jsonb not null,

  -- Gallery ke liye. Asset id ya URL; `null` = abhi nahi bana.
  thumbnail   text,

  -- Built-in templates ka `owner_id` null hota hai aur ye sabko dikhte hain.
  is_builtin  boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists reel_templates_owner_idx
  on public.reel_templates (owner_id, updated_at desc);

alter table public.reel_templates enable row level security;

/*
 * Built-in sabko dikhte hain, apne wale sirf apne ko.
 *
 * ⚠️ Do alag policy isliye ki `owner_id is null` wali row ko "sabka" maanna
 * padta hai. Ek hi policy me dono likhne par built-in templates kisi ko bhi
 * dikhte hi nahi — aur wo galti tab pata chalti hai jab gallery khaali dikhti
 * hai aur wajah kahin likhi nahi hoti.
 */
drop policy if exists reel_templates_read on public.reel_templates;
create policy reel_templates_read on public.reel_templates
  for select using (is_builtin or owner_id = auth.uid());

drop policy if exists reel_templates_write on public.reel_templates;
create policy reel_templates_write on public.reel_templates
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

/*
 * `updated_at` khud badalta rahe.
 *
 * ⚠️ Ye trigger pehle `reel-studio.sql` me tha, aur upar wala rebuild block
 * `drop table ... cascade` chalata hai — yaani wo trigger uske saath chala jaata
 * hai. Use yahan dobara na banana ek chup-chaap nuksaan hota: table banti,
 * policy lagti, sab theek dikhta, bas `updated_at` hamesha pehle din ka rehta —
 * aur gallery ka "recent" order chupchaap galat ho jaata.
 */
drop trigger if exists reel_templates_touch on public.reel_templates;
create trigger reel_templates_touch before update on public.reel_templates
  for each row execute function public.reel_touch_updated_at();


-- ============================================================================

create table if not exists public.reel_brand_presets (
  id         text primary key,
  owner_id   uuid references auth.users (id) on delete cascade,
  name       text not null,

  /*
   * `{ "brand.primary": "#C25A37", ... }`.
   *
   * Poora set rakhne ki zaroorat nahi — `brandTokensFor()` default ke upar
   * chadhata hai, isliye ek preset sirf apne badle hue rang rakh sakta hai.
   */
  tokens     jsonb not null default '{}'::jsonb,

  -- Brand ka logo (watermark aur end-screen dono isi ko use karte hain).
  logo_asset_id text,

  is_builtin boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reel_brand_presets_owner_idx
  on public.reel_brand_presets (owner_id, updated_at desc);

alter table public.reel_brand_presets enable row level security;

drop policy if exists reel_brand_presets_read on public.reel_brand_presets;
create policy reel_brand_presets_read on public.reel_brand_presets
  for select using (is_builtin or owner_id = auth.uid());

drop policy if exists reel_brand_presets_write on public.reel_brand_presets;
create policy reel_brand_presets_write on public.reel_brand_presets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

/*
 * `updated_at` khud badalta rahe.
 *
 * ⚠️ Ye trigger pehle `reel-studio.sql` me tha, aur upar wala rebuild block
 * `drop table ... cascade` chalata hai — yaani wo trigger uske saath chala jaata
 * hai. Use yahan dobara na banana ek chup-chaap nuksaan hota: table banti,
 * policy lagti, sab theek dikhta, bas `updated_at` hamesha pehle din ka rehta —
 * aur gallery ka "recent" order chupchaap galat ho jaata.
 */
drop trigger if exists reel_brand_presets_touch on public.reel_brand_presets;
create trigger reel_brand_presets_touch before update on public.reel_brand_presets
  for each row execute function public.reel_touch_updated_at();


-- ---------------------------------------------------------------- seed ------
-- Apka Saathi ka apna preset (17.9). Rang `web/app/globals.css` se hain, taaki
-- reels aur website ek hi parivaar ke lagein.

insert into public.reel_brand_presets (id, owner_id, name, tokens, is_builtin)
values (
  'apka-saathi',
  null,
  'Apka Saathi',
  jsonb_build_object(
    'brand.primary',      '#C25A37',
    'brand.primaryDark',  '#A8492B',
    'brand.accent',       '#E0A458',
    'brand.sage',         '#7C8A6B',
    'brand.text',         '#FFF9F0',
    'brand.textMuted',    '#D6C9B8',
    'brand.textOnAccent', '#241F1A',
    'brand.background',   '#1A1714',
    'brand.surface',      '#2E2823',
    'brand.line',         '#E5DBC9'
  ),
  true
)
on conflict (id) do update
  set name = excluded.name,
      tokens = excluded.tokens,
      updated_at = now();

-- ---------------------------------------------------------------- check -----
-- select id, name, is_builtin from public.reel_brand_presets order by id;
-- select id, name, is_builtin from public.reel_templates order by id;
