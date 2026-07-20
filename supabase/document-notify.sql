-- #8 — Document expiry ka WhatsApp follow-up (sirf documents ke liye).
-- Logic: expiry notification ke 1 ghante baad tak user ne app me OK/dekh nahi
-- kiya, to WhatsApp reminder jaata hai. Ack kiya to nahi jaata.
--
-- Ack ka signal: app ReminderAlert ke "OK" pe acknowledge_document() call karti
-- hai -> documents.expiry_ack_at = now(). Cron isi ko check karta hai.

alter table public.documents
  add column if not exists expiry_ack_at timestamptz;

-- Kaun sa (document, notification-moment) ka WhatsApp ja chuka — dobara na jaye.
create table if not exists public.document_whatsapp_log (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  due_at timestamptz not null,
  sent_at timestamptz not null default now(),
  unique (document_id, due_at)
);

alter table public.document_whatsapp_log enable row level security;
-- Koi client policy nahi — sirf service_role (cron) likhta/padhta hai.

-- App se ack: caller ke apne document pe expiry_ack_at set karo.
create or replace function public.acknowledge_document(p_doc_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.documents
  set expiry_ack_at = now()
  where id = p_doc_id and user_id = auth.uid();
$$;

revoke all on function public.acknowledge_document(uuid) from public, anon;
grant execute on function public.acknowledge_document(uuid) to authenticated, service_role;
