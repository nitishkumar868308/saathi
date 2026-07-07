-- reminders: user_id + notified_at (server-side WhatsApp/email sending ke liye)
-- Supabase SQL Editor mein Run karo. (Dobara run safe hai.)

alter table public.reminders
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.reminders
  add column if not exists notified_at timestamptz;

-- Due reminders (jo abhi tak nahi bheje) fast dhundhne ke liye.
create index if not exists reminders_due_idx
  on public.reminders (remind_at)
  where notified_at is null;
