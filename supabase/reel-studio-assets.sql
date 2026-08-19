-- AI Reel Studio — Phase 5 (assets + media library) ke liye chhoti si badhotri.
-- Supabase SQL Editor me Run karo. (Dobara run karna safe hai — sab idempotent hai.)
--
-- `supabase/reel-studio.sql` pehle chal chuki honi chahiye — ye usi ki
-- `reel_assets` table par do column jodti hai.
--
-- ⚠️ DO COLUMN, AUR DONO KYUN:
--
-- 1. **meta jsonb** — asli ffprobe ka nateeja (codec, bitrate, pixel format,
--    rotation, profile) aur thumbnail ki key.
--
--    Har field ke liye alag column banane ka mann hota hai, par wo raasta
--    hamesha ek jagah aakar rukta hai: agli baar jab ek aur cheez naapni ho
--    (colour range, LUFS, HDR flags…) to phir se migration likhni padti hai.
--    jsonb rakhne se naya field jodna sirf code ka kaam hai — aur yahi is poore
--    project ka "dynamic-first" rule hai.
--
--    ⚠️ Jo cheezein **dhoondhi/chhaani** jaati hain (width, height, duration,
--    fps, kind) wo apne asli column me hi rehti hain — unhe jsonb me daalna
--    query ko dheema aur index ko bekaar kar deta.
--
-- 2. **tags text[]** — "music", "screen-recording" jaisi cheezein.
--
--    Media library me in naam ke tab chahiye the. Bina tag ke wo tab sirf
--    andaaze par chal sakte the (filename me "screen" dhoondh kar), jo ek din
--    galat nikalta aur bharosa khatam kar deta. Tag user khud lagata hai,
--    isliye tab sach bolte hain.


/* ------------------------------------------------------------------ */
/*  1. Naye column                                                     */
/* ------------------------------------------------------------------ */

alter table public.reel_assets
  add column if not exists meta jsonb   not null default '{}'::jsonb,
  add column if not exists tags text[]  not null default '{}';


/* ------------------------------------------------------------------ */
/*  2. Index                                                           */
/* ------------------------------------------------------------------ */

-- Tab se filter karna: `tags @> '{music}'`. GIN ke bina ye poori table padhta hai.
create index if not exists reel_assets_tags_idx
  on public.reel_assets using gin (tags);

-- "Ye asset kis project me use ho raha hai?" — delete se pehle yahi poochha
-- jaata hai. `doc->'items' @> '[{"assetId":"..."}]'` isi index se chalta hai.
create index if not exists reel_projects_doc_items_idx
  on public.reel_projects using gin ((doc -> 'items') jsonb_path_ops);


/* ------------------------------------------------------------------ */
/*  3. Sanity — chalane ke baad ye dekh lena                           */
/* ------------------------------------------------------------------ */

-- select column_name, data_type from information_schema.columns
--  where table_schema='public' and table_name='reel_assets' order by ordinal_position;
--
-- Umeed: ... meta (jsonb), tags (ARRAY) sabse aakhir me dikhne chahiye.
