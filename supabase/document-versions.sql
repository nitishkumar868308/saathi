-- ============================================================================
-- Apka Saathi — Document ka PURANA version (photo + expiry) sambhaal ke rakho
--
-- Supabase SQL Editor me poori file Run karo. Dobara chalana safe hai.
-- Pehle chal chuki honi chahiye: schema.sql, storage.sql, auth-rls.sql
-- ============================================================================
--
-- ── Ye kyun bana ───────────────────────────────────────────────────────────
--
-- `document-renew` ab tak PURANE ko mita deta tha: nayi photo usi R2 key par
-- chadh jaati thi (`<uid>/<docId>.<ext>`) aur nayi expiry usi column par likh
-- jaati thi. Yaani renew ke baad purana document kahin bachta hi nahi tha.
--
-- ⚠️ Aur wo asal me galat hai — kyunki asli zindagi me purana document renew ke
-- baad bhi kaam ka rehta hai:
--
--   • Purana passport naye ke saath hi lagta hai (visa ka pichhla record usi me
--     hota hai), aur bahut jagah "pichhla passport number" maanga jaata hai.
--   • Purani insurance policy claim ke waqt chahiye hoti hai — ghatna us daur
--     ki ho sakti hai jab purani policy chal rahi thi.
--   • Purana DL / RC challan aur transfer ke kaam me maanga jaata hai.
--   • Aur sabse aam baat: "renew se pehle wali date kya thi?" — ye sawaal log
--     har saal poochhte hain, aur app ke paas uska koi jawab nahi tha.
--
-- Ab har renew par purana haal (photo ka rasta + us waqt ki expiry) yahan ek
-- alag row me chala jaata hai, aur document-view par "Purane versions" me dikhta
-- hai.
--
-- ⚠️ Purani FILE ab R2 se delete NAHI hoti. Wahi is poori feature ki jaan hai.
-- Isliye nayi photo ab ek NAYE naam par chadhti hai (`<uid>/<docId>-v2.jpg`) —
-- warna wo purani ko upar se dabaa deti aur history me sirf ek toota hua link
-- bachta. Poora hisaab `web/app/api/storage/upload-url/route.ts` me hai.

/* ------------------------------------------------------------------ */
/* 1. Table                                                            */
/* ------------------------------------------------------------------ */

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  /**
   * Kaunsa version — 1 se shuru, har renew par ek aage.
   *
   * ⚠️ Ye sirf ginti nahi hai, R2 par file ka NAAM bhi isi se banta hai:
   * version 1 = `<uid>/<docId>.<ext>` (bilkul purana raasta, jaisa aaj hai),
   * version 2 se aage = `<uid>/<docId>-v<n>.<ext>`. Isliye `unique` hona
   * zaroori hai — do row ka ek hi version matlab do file ka ek hi naam.
   */
  version int not null,
  /** Us waqt ki expiry (renew se pehle wali). */
  expiry date,
  /** Us waqt ki file — R2 par ab bhi wahin padi hai. */
  file_path text,
  file_size bigint,
  mime_type text,
  /** Ye version kab tak "current" tha — yaani renew kab hua. */
  created_at timestamptz not null default now(),
  unique (document_id, version)
);

create index if not exists document_versions_doc_idx
  on public.document_versions (document_id, version desc);

/* ------------------------------------------------------------------ */
/* 2. RLS — sirf apne versions                                         */
/* ------------------------------------------------------------------ */

alter table public.document_versions enable row level security;

drop policy if exists "own document versions" on public.document_versions;
create policy "own document versions" on public.document_versions
  for select using (user_id = auth.uid());

/**
 * ⚠️ Likhne ka koi policy JAAN-BOOJH KE nahi hai.
 *
 * Wahi soch jo `column-grants.sql` me hai: user ki row hone ka matlab ye nahi ki
 * user use likh sake. Yahan to aur zaroori hai — `file_path` is table ka sabse
 * naazuk khaana hai. Agar app use seedha likh sakti, to koi bhi apni row me kisi
 * aur ka path daal ke uski file padhne ki koshish kar sakta tha (`download-url`
 * apni jaanch alag se karta hai, par ek hi deewar par tikna galat hai).
 *
 * Row banane ka EK hi raasta hai: neeche wali `snapshot_document_version()`,
 * jo `security definer` hai aur `file_path` khud `documents` se uthati hai —
 * app se kabhi nahi leti.
 */
revoke insert, update, delete on public.document_versions from authenticated, anon;
grant select on public.document_versions to authenticated;

/* ------------------------------------------------------------------ */
/* 3. Snapshot — renew se PEHLE ka haal history me daal do             */
/* ------------------------------------------------------------------ */

/**
 * Abhi ka document version-history me daal do, aur naya version number lauta do.
 *
 * App ise renew ke SABSE PEHLE bulati hai — kuch badalne se pehle. Lauta hua
 * number do kaam karta hai:
 *
 *   1. Wo batata hai ki purana haal `version = n` par mehfooz ho gaya.
 *   2. Nayi file ka naam `n + 1` se banta hai, isliye wo purani ko kabhi
 *      overwrite nahi kar sakti.
 *
 * ⚠️ `file_path` yahan `documents` se PADHA jaata hai, app se liya nahi jaata.
 * Ye is function ki sabse zaroori line hai (upar wali wajah dekho).
 *
 * ⚠️ Ek hi document par do baar chalne ki daud se `unique (document_id, version)`
 * bachata hai, aur `max(version) + 1` usi statement me nikalta hai — isliye do
 * saath chalti hui koshishon me se ek fail hogi, dono ek hi number par nahi
 * baithengi.
 *
 * `0` = kuch nahi hua (document nahi mila ya apna nahi hai). App us par rukti
 * nahi — history ek upar wali cheez hai, renew uske bina bhi hona chahiye.
 */
create or replace function public.snapshot_document_version(p_document_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_next int;
  v_doc  public.documents%rowtype;
begin
  if auth.uid() is null then return 0; end if;

  select * into v_doc
    from public.documents
   where id = p_document_id and user_id = auth.uid();
  if not found then return 0; end if;

  select coalesce(max(version), 0) + 1 into v_next
    from public.document_versions
   where document_id = p_document_id;

  insert into public.document_versions
    (document_id, user_id, version, expiry, file_path, file_size, mime_type)
  values
    (p_document_id, auth.uid(), v_next, v_doc.expiry, v_doc.file_path,
     v_doc.file_size, v_doc.mime_type);

  return v_next;
end;
$$;

revoke all on function public.snapshot_document_version(uuid) from public, anon;
grant execute on function public.snapshot_document_version(uuid) to authenticated;

/* ------------------------------------------------------------------ */
/* 4. Document delete hone par R2 ki purani file bhi jaani chahiye      */
/* ------------------------------------------------------------------ */

/**
 * Is document ke saare version file paths — delete se PEHLE poochne ke liye.
 *
 * ⚠️ Iske bina ek naya "bill me zinda" wala chhed ban jaata (wahi jo
 * `storage.sql` aur `deleteDocument()` par likha hai, bas nayi shakl me):
 * document delete hone par uski row cascade se hat jaati, par R2 par padi
 * purani versions wali file hamesha ke liye wahin reh jaati — user ke liye
 * gayi hui, bucket me maujood, aur kisi purane signed URL se khulne layak.
 *
 * `distinct` isliye ki bina photo wale renew me do version ek hi file par
 * ishara karte hain (sirf expiry badli thi) — use do baar delete karna bekaar
 * hai.
 */
create or replace function public.my_document_version_paths(p_document_id uuid)
returns table (file_path text)
language sql security definer set search_path = public stable as $$
  select distinct v.file_path
    from public.document_versions v
   where v.document_id = p_document_id
     and v.user_id = auth.uid()
     and v.file_path is not null;
$$;

revoke all on function public.my_document_version_paths(uuid) from public, anon;
grant execute on function public.my_document_version_paths(uuid) to authenticated;
