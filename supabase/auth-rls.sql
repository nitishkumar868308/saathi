-- Auth ke baad: har user ka apna data (per-user security).
-- Supabase SQL Editor mein paste karke Run karo.

alter table public.documents add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table public.reminders add column if not exists user_id uuid references auth.users(id) default auth.uid();
alter table public.messages  add column if not exists user_id uuid references auth.users(id) default auth.uid();

-- purani dev-all policies hatao
drop policy if exists "dev all documents" on public.documents;
drop policy if exists "dev all reminders" on public.reminders;
drop policy if exists "dev all messages"  on public.messages;

-- ab sirf apna data (login zaroori)
create policy "own documents" on public.documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own reminders" on public.reminders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own messages"  on public.messages  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
