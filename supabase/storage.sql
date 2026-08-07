-- Apka Saathi — documents table ke file columns.
-- Supabase SQL Editor me Run karo. (Dobara run safe.)
--
-- ⚠️ FILE STORAGE AB SUPABASE PAR NAHI HAI.
--
-- Saari files (documents + profile photo) Cloudflare R2 par jaati hain:
--
--     avatars/<uid>/avatar.jpg
--     documents/<uid>/<docId>.<ext>
--
-- Bucket poora PRIVATE hai. App seedha R2 se baat nahi karti — wo apna Supabase
-- token le kar web ke /api/storage/* par aati hai, aur server uske APNE folder
-- ka chhoti umar wala presigned URL banata hai. Poori baat web/lib/r2.ts me.
--
-- Isliye is file me ab sirf `documents` ke columns bache hain. Wo abhi bhi
-- zaroori hain: `file_path` me R2 ka rasta (`<uid>/<docId>.<ext>`) padta hai.

/* ------------------------------------------------------------------ */
/* 1. Profile photo URL                                                */
/* ------------------------------------------------------------------ */
-- Ab isme `https://<site>/api/avatar/<uid>?t=...` jaisa link padta hai.
alter table public.user_details add column if not exists avatar_url text;

/* ------------------------------------------------------------------ */
/* 2. Documents — R2 ka path + size + type                             */
/* ------------------------------------------------------------------ */
alter table public.documents add column if not exists file_path text;
alter table public.documents add column if not exists file_size bigint;
alter table public.documents add column if not exists mime_type text;

/* ------------------------------------------------------------------ */
/* 3. Purane Supabase buckets — hatane ka tareeka (OPTIONAL)           */
/* ------------------------------------------------------------------ */
-- Ye jaan-boojh ke comment me hai. Bucket girana wapas nahi aata, aur agar
-- kisi purane user ki file abhi bhi wahan padi ho to wo hamesha ke liye chali
-- jaayegi. Pehle Storage me jaa kar apni aankh se dekh lo ki dono khaali hain,
-- tabhi ye chalana.
--
--   delete from storage.objects where bucket_id in ('avatars', 'documents');
--   delete from storage.buckets where id in ('avatars', 'documents');
--
-- Policies bhi tab apne aap bekaar ho jaati hain:
--   drop policy if exists "avatar public read" on storage.objects;
--   drop policy if exists "avatar own write"   on storage.objects;
--   drop policy if exists "avatar own update"  on storage.objects;
--   drop policy if exists "avatar own delete"  on storage.objects;
--   drop policy if exists "doc own read"   on storage.objects;
--   drop policy if exists "doc own write"  on storage.objects;
--   drop policy if exists "doc own update" on storage.objects;
--   drop policy if exists "doc own delete" on storage.objects;
