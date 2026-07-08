-- Saathi — Database schema (Phase 2, bina AI ke)
-- Supabase SQL Editor mein paste karke Run karo.

-- 1. Documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'other',
  expiry date,
  created_at timestamptz not null default now()
);

-- Document ki local file ka path (app device pe). Abhi cloud pe nahi.
alter table public.documents add column if not exists file_uri text;

-- 2. Reminders
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  time_label text,
  remind_at timestamptz,
  is_on boolean not null default true,
  bucket text not null default 'today', -- 'today' | 'upcoming'
  created_at timestamptz not null default now()
);

-- 3. Chat messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  role text not null, -- 'user' | 'saathi'
  content text not null,
  created_at timestamptz not null default now()
);

-- 4. Ownership — har row kis user ki hai
--    (RLS aur free-plan document limit dono isi pe tike hain)
alter table public.documents add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.reminders add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.messages  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists documents_user_idx on public.documents(user_id);
create index if not exists reminders_user_idx on public.reminders(user_id);
create index if not exists messages_user_idx  on public.messages(user_id);

-- 5. RLS — sirf apna data
--
-- ⚠️ Pehle yahan `using (true)` tha — matlab har user ko SAB users ke documents,
-- reminders aur messages dikhte the, aur kisi ka bhi document delete ho sakta tha.
-- Ab sirf apni rows.
--
-- NOTE: purani rows jinme user_id NULL hai, ab kisi ko nahi dikhengi (pre-launch
-- me theek hai). Chaaho to pehle unhe delete kar do:
--   delete from public.documents where user_id is null;
--   delete from public.reminders where user_id is null;
--   delete from public.messages  where user_id is null;

alter table public.documents enable row level security;
alter table public.reminders enable row level security;
alter table public.messages  enable row level security;

drop policy if exists "dev all documents" on public.documents;
drop policy if exists "dev all reminders" on public.reminders;
drop policy if exists "dev all messages"  on public.messages;

drop policy if exists "own documents" on public.documents;
drop policy if exists "own reminders" on public.reminders;
drop policy if exists "own messages"  on public.messages;

create policy "own documents" on public.documents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own reminders" on public.reminders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own messages" on public.messages for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reminder-sender cron aur `ai` edge function service_role se chalte hain —
-- woh RLS bypass karte hain, isliye unhe koi policy nahi chahiye.
