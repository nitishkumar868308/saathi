-- Saathi — Landing page tables (waitlist + contact messages)
-- Supabase SQL Editor mein paste karke Run karo.
--
-- Security: RLS ON hai aur koi public policy nahi — matlab publishable/anon key
-- se koi in tables ko read/write NAHI kar sakta. Sirf server (service_role key)
-- inhe access karta hai (RLS bypass karta hai). Isliye emails/messages safe hain.

-- 1. Waitlist (early access signups)
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

-- 2. Contact messages
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

-- RLS ON, bina kisi anon policy ke → sirf service_role (server) access kar sakta hai.
alter table public.waitlist enable row level security;
alter table public.contact_messages enable row level security;

-- (Koi "for all using(true)" policy mat banao — warna publishable key se
--  data leak ho jayega. Server service_role key use karta hai jo RLS bypass karta hai.)
