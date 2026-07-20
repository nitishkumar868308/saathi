-- Reviews / ratings — app me 1 hafte baad popup se aate hain (#9).
-- User apna review daalta/dekhta hai; admin service_role se sab padhta hai.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  text text,
  -- "I allow Apka Saathi to display this review on its website"
  allow_display boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reviews_created_idx on public.reviews (created_at desc);
create index if not exists reviews_user_idx on public.reviews (user_id);

alter table public.reviews enable row level security;

drop policy if exists "own review insert" on public.reviews;
create policy "own review insert" on public.reviews
  for insert with check (auth.uid() = user_id);

drop policy if exists "own review read" on public.reviews;
create policy "own review read" on public.reviews
  for select using (auth.uid() = user_id);

-- Admin (service_role) RLS bypass karta hai — alag policy ki zaroorat nahi.
