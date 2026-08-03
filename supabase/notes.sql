-- Apka Saathi — Notes (kachhi baatein: saamaan ki list, ek idea, kuch bhi)
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
-- NOTE: pehle profiles.sql / schema.sql chala lena.
--
-- Reminder ke saath ye kyun chahiye tha: reminder ka matlab hi hai "iska ek
-- WAQT hai". Par aadhi baatein aisi hoti hain jinka koi waqt hota hi nahi —
-- bazaar ka saamaan, ek idea jo abhi aaya, gaadi ka number, kisi ka naapa hua
-- size. Ab tak aise log wahi baat ek jhoote reminder me daal dete the (koi bhi
-- time chun ke) aur phir wo bina matlab ke bajta rehta tha.
--
-- Note ka apna koi alarm nahi hai. Zaroorat pade to user use reminder me bhej
-- deta hai — tab wahan ek asli reminder banta hai, aur note apni jagah rehta
-- hai.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Title khaali ho sakta hai: log seedha likhna shuru karte hain. UI pehli
  -- line se apne aap ek title bana leta hai, par wo yahan thopa nahi jaata.
  title text,
  body  text not null default '',
  /**
   * Pin kiya hua note hamesha upar. Ek chhoti si cheez hai par isi se list
   * kaam ki rehti hai — 40 note ho jaane par bhi "bazaar wali list" upar hi
   * milti hai.
   */
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_updated_idx
  on public.notes(user_id, is_pinned desc, updated_at desc);

alter table public.notes enable row level security;

-- Apne hi note — chaaron kaam ke liye. `with check` bhi utna hi zaroori hai
-- jitna `using`: uske bina user apna note kisi aur ke naam par likh sakta hai.
drop policy if exists "own notes read"   on public.notes;
drop policy if exists "own notes insert" on public.notes;
drop policy if exists "own notes update" on public.notes;
drop policy if exists "own notes delete" on public.notes;

create policy "own notes read"   on public.notes for select using (user_id = auth.uid());
create policy "own notes insert" on public.notes for insert with check (user_id = auth.uid());
create policy "own notes update" on public.notes for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notes delete" on public.notes for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.notes to authenticated;

/**
 * `updated_at` khud chalta rahe.
 *
 * App se bhejna bhi ho sakta tha, par tab wo phone ki ghadi par tik jaata —
 * aur galat ghadi wale phone ke note list me hamesha sabse upar ya sabse
 * neeche chipak jaate. Yahan server ki ghadi hi ek sach hai.
 */
create or replace function public.notes_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists notes_touch on public.notes;
create trigger notes_touch before update on public.notes
  for each row execute function public.notes_touch_updated_at();
