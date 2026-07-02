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

-- RLS on (Supabase best practice). Abhi dev ke liye anon ko allow.
-- (Baad mein login add karke per-user policies banayenge.)
alter table public.documents enable row level security;
alter table public.reminders enable row level security;
alter table public.messages  enable row level security;

drop policy if exists "dev all documents" on public.documents;
drop policy if exists "dev all reminders" on public.reminders;
drop policy if exists "dev all messages"  on public.messages;

create policy "dev all documents" on public.documents for all using (true) with check (true);
create policy "dev all reminders" on public.reminders for all using (true) with check (true);
create policy "dev all messages"  on public.messages  for all using (true) with check (true);
