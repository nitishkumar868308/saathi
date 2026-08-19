-- ============================================================================
-- Phase 17 — templates + brand presets
--
-- Ise Supabase ke SQL editor me ek baar chala do. Dobara chalane par kuch nahi
-- toot'ta (`if not exists` / `on conflict`).
--
-- ⚠️ Dono table me asli cheez ek `jsonb` column hai (`doc` aur `tokens`), aur ye
-- jaan-boojhkar hai. Template ke har slot ke liye ek column banane par har naye
-- slot kind par ek migration likhni padti — aur template ka poora point hi ye
-- hai ki wo **data** hai, schema nahi. Shape ki jaanch `TemplateSchema` (zod)
-- karta hai, DB nahi.
-- ============================================================================

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
