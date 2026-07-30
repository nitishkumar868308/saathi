-- Item 18 — document expiry ka teen-qadam ladder + "ho gaya" wala jawab.
--
-- Ab har expiring document par TEEN baar khabar jaati hai — 7 din pehle, 1 din
-- pehle, aur us din — aur teenon baar teenon raaste se: phone ki notification,
-- email, aur WhatsApp.
--
-- Uske baad Saathi poochta hai "ye ho gaya kya?". User "haan" kahe to:
--   * us document ke aage ke saare reminder band,
--   * aur usse naya/renew kiya document daalne ko kaha jaata hai.
--
-- Ye file `document-notify.sql` ke BAAD chalao (wo expiry_ack_at banati hai).

/* ------------------------------------------------------------------ */
/*  1. "Ho gaya" ka nishaan                                           */
/* ------------------------------------------------------------------ */

-- expiry_ack_at = user ne alert dekh liya (chup kar do, WhatsApp mat bhejo).
-- renewed_at    = user ne kaha kaam HO GAYA (aage ke sab reminder band).
-- Do alag cheezein hain: dekh lena kaam ho jaana nahi hota.
alter table public.documents
  add column if not exists renewed_at timestamptz;

/* ------------------------------------------------------------------ */
/*  2. Kaunsi khabar ja chuki                                          */
/* ------------------------------------------------------------------ */

-- Purani `document_whatsapp_log` sirf WhatsApp ke liye thi. Ab email bhi jaata
-- hai, isliye ek hi log jisme channel bhi likha ho — warna dono channel ek
-- doosre ka dedupe kha jaate.
create table if not exists public.document_notify_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  -- Kis moment ki khabar (7/1/0 din wala 9 baje ka waqt).
  due_at timestamptz not null,
  -- 'email' | 'whatsapp'
  channel text not null,
  sent_at timestamptz not null default now(),
  unique (document_id, due_at, channel)
);

alter table public.document_notify_log enable row level security;
-- Koi client policy nahi — sirf service_role (cron) likhta/padhta hai.

create index if not exists document_notify_log_doc_idx
  on public.document_notify_log (document_id, due_at);

/* ------------------------------------------------------------------ */
/*  3. App se "ho gaya"                                                */
/* ------------------------------------------------------------------ */

-- User ne kaha kaam ho gaya. Ack bhi karo (WhatsApp follow-up ruk jaye) aur
-- renewed_at bhi bhar do (cron aage ki khabar bhejna hi band kar de).
create or replace function public.renew_document(p_doc_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.documents
  set expiry_ack_at = now(),
      renewed_at = now()
  where id = p_doc_id and user_id = auth.uid();
$$;

revoke all on function public.renew_document(uuid) from public, anon;
grant execute on function public.renew_document(uuid) to authenticated, service_role;
