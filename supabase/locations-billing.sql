-- Saathi — Locations (country/state/city cascade) + per-user details
-- Supabase SQL Editor mein Run karo. (Dobara run safe hai.)

create table if not exists public.countries (
  id serial primary key,
  name text not null,
  code text unique
);
create table if not exists public.states (
  id serial primary key,
  country_id int not null references public.countries(id) on delete cascade,
  name text not null
);
create index if not exists states_country_idx on public.states(country_id);
create table if not exists public.cities (
  id serial primary key,
  state_id int not null references public.states(id) on delete cascade,
  name text not null
);
create index if not exists cities_state_idx on public.cities(state_id);

-- Per-user details (checkout/profile) — ek row per user, upsert.
create table if not exists public.user_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,                 -- E.164, jaise +919876543210
  phone_dial_code text,       -- +91
  phone_country text,         -- IN
  address text,
  gender text,
  country_id int references public.countries(id),
  state_id int references public.states(id),
  city_id int references public.cities(id),
  updated_at timestamptz not null default now()
);

-- RLS: location tables public-read (dropdown), user_details own-row.
alter table public.countries enable row level security;
alter table public.states enable row level security;
alter table public.cities enable row level security;
alter table public.user_details enable row level security;

drop policy if exists "read countries" on public.countries;
drop policy if exists "read states" on public.states;
drop policy if exists "read cities" on public.cities;
drop policy if exists "own user_details" on public.user_details;

create policy "read countries" on public.countries for select using (true);
create policy "read states" on public.states for select using (true);
create policy "read cities" on public.cities for select using (true);
create policy "own user_details" on public.user_details for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
