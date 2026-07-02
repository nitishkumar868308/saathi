-- Profiles table — app-specific user info (auth.users se linked).
-- Supabase SQL Editor mein Run karo. (Dobara run karo toh bhi safe hai.)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  saathi_name text default 'Saathi',
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists full_name text;

alter table public.profiles enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- Naya signup pe profile auto-ban jaye + naam metadata se copy ho
-- (email signup: full_name; Google: full_name/name)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do update set full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
