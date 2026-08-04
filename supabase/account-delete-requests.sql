-- Apka Saathi — account delete requests (admin panel se sambhalne layak)
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
--
-- ⚠️ Ab tak ye request `contact_messages` me ek prefix ke saath ghusi hoti thi:
--   message = "[ACCOUNT DELETE REQUEST] ..."
-- Yaani wo aam sandeshon ke beech kahin dabi rehti thi, uska koi status nahi
-- hota tha (kis par kaam ho gaya, kis par nahi), aur admin uspar KUCH KAR HI
-- NAHI SAKTA tha — sirf padh sakta tha. Play Store ki data-deletion shart ke
-- liye request lena kaafi nahi hai; use poora karna bhi padta hai.
--
-- Ab: apni table, apna status, aur admin panel se hi do raaste —
--   HIDE  (soft) — user ka data DB me rehta hai par app/user side band ho jaata hai
--   PURGE (hard) — sab kuch sach me delete
--
-- Purani requests bhi is table me le aayi jaati hain (neeche step 4).

/* ------------------------------------------------------------------ */
/*  1. Requests                                                        */
/* ------------------------------------------------------------------ */

create table if not exists public.account_delete_requests (
  id uuid primary key default gen_random_uuid(),

  /*
   * Kis user ki request.
   *
   * NULL ho sakta hai — aur ye jaan-boojh ke hai: website ka delete-account
   * form bina login ke bhi bhara ja sakta hai (Play Store yahi maangta hai),
   * to us waqt sirf email pata hoti hai. Admin panel email se user dhoondh ke
   * ise baad me jod deta hai.
   *
   * `on delete set null` isliye ki user purge hone ke baad bhi request ka
   * record bacha rahe — compliance me "kab maanga, kab kiya" dono chahiye.
   */
  user_id    uuid references auth.users(id) on delete set null,

  name       text,
  email      text not null,
  reason     text,

  /*
   * pending  — abhi kuch nahi hua
   * hidden   — soft: data DB me hai, par user side band
   * deleted  — hard: sab kuch mita diya gaya
   * rejected — admin ne mana kiya (jaise galat/duplicate request)
   */
  status     text not null default 'pending'
             check (status in ('pending', 'hidden', 'deleted', 'rejected')),

  -- Kaam kab hua, aur admin ka apna note (kyun kiya/nahi kiya).
  handled_at timestamptz,
  note       text,

  /*
   * Purge ke waqt kya-kya kitna hataya — sirf ginti, koi asli data nahi.
   * { "documents": 12, "reminders": 30, ... }
   *
   * Purge ke baad rows to rehti hi nahi, isliye ye ekmatra saboot hota hai ki
   * kaam sach me hua tha aur kitna hua tha.
   */
  removed    jsonb,

  created_at timestamptz not null default now()
);

create index if not exists adr_status_idx  on public.account_delete_requests (status, created_at desc);
create index if not exists adr_email_idx   on public.account_delete_requests (lower(email));
create index if not exists adr_user_idx    on public.account_delete_requests (user_id);

-- Sirf service_role (admin API) — koi client policy nahi. Website ka form bhi
-- server route se hi likhta hai.
alter table public.account_delete_requests enable row level security;

/* ------------------------------------------------------------------ */
/*  2. Soft delete ka nishaan                                          */
/* ------------------------------------------------------------------ */

/*
 * `deleted_at` set = account band. Data DB me safe hai, par user ke liye khatam.
 *
 * Ye "hide" ka poora matlab hai. Do wajah se ye hard delete se pehle ka sahi
 * kadam hai:
 *   (a) galti se delete ho jaye to wapas laaya ja sakta hai (user aksar 2 din
 *       baad wapas aata hai),
 *   (b) payment/refund ya kanooni sawaal aane par record maujood rehta hai.
 *
 * ⚠️ Ye column akela kuch nahi rokta — RLS policy (neeche) ise sach me lagu
 * karti hai. Sirf app ke code me check karna kaafi nahi hota: koi bhi seedha
 * API call karke data padh sakta tha.
 */
alter table public.profiles
  add column if not exists deleted_at timestamptz;

create index if not exists profiles_deleted_idx on public.profiles (deleted_at)
  where deleted_at is not null;

/**
 * "Ye user band to nahi hai?" — RLS policies isi se poochti hain.
 *
 * security definer isliye ki policy ke andar se profiles padhni hai bina
 * profiles ki apni policy me phasre.
 */
create or replace function public.account_active(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles p
    where p.id = uid and p.deleted_at is not null
  );
$$;

grant execute on function public.account_active(uuid) to authenticated, anon, service_role;

/* ------------------------------------------------------------------ */
/*  3. Band account ko apna data na dikhe                              */
/* ------------------------------------------------------------------ */

-- ⚠️ Har us table par lagana zaroori hai jisme user ka apna data hai. Ek bhi
-- chhoot jaye to "hide" adhoora reh jaata hai aur user ko wo hissa dikhta rehta
-- hai. Neeche wahi saat tables hain jinme user apna kuch dekhta hai.

drop policy if exists "own documents" on public.documents;
create policy "own documents" on public.documents for all
  using (user_id = auth.uid() and public.account_active(auth.uid()))
  with check (user_id = auth.uid() and public.account_active(auth.uid()));

drop policy if exists "own reminders" on public.reminders;
create policy "own reminders" on public.reminders for all
  using (user_id = auth.uid() and public.account_active(auth.uid()))
  with check (user_id = auth.uid() and public.account_active(auth.uid()));

drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages for all
  using (user_id = auth.uid() and public.account_active(auth.uid()))
  with check (user_id = auth.uid() and public.account_active(auth.uid()));

drop policy if exists "own notes" on public.notes;
create policy "own notes" on public.notes for all
  using (user_id = auth.uid() and public.account_active(auth.uid()))
  with check (user_id = auth.uid() and public.account_active(auth.uid()));

drop policy if exists "own details" on public.user_details;
create policy "own details" on public.user_details for all
  using (user_id = auth.uid() and public.account_active(auth.uid()))
  with check (user_id = auth.uid() and public.account_active(auth.uid()));

drop policy if exists "own tickets" on public.support_tickets;
create policy "own tickets" on public.support_tickets for all
  using (user_id = auth.uid() and public.account_active(auth.uid()))
  with check (user_id = auth.uid() and public.account_active(auth.uid()));

/*
 * Profile khud padhne se nahi rokte — app ko `deleted_at` DIKHNA chahiye,
 * tabhi wo user ko saaf keh sakti hai "ye account band kar diya gaya hai".
 * Rokna sirf badalne par hai, warna band user apna profile edit karta rahega.
 */
drop policy if exists "own profile" on public.profiles;
create policy "own profile read" on public.profiles for select
  using (id = auth.uid());
create policy "own profile write" on public.profiles for update
  using (id = auth.uid() and public.account_active(auth.uid()))
  with check (id = auth.uid() and public.account_active(auth.uid()));
create policy "own profile insert" on public.profiles for insert
  with check (id = auth.uid());

/* ------------------------------------------------------------------ */
/*  4. Purani requests le aao                                           */
/* ------------------------------------------------------------------ */

-- Wo requests jo abhi tak contact_messages me prefix ke saath padi hain. Email
-- par dedupe — dobara run karne se duplicate nahi banenge.
insert into public.account_delete_requests (name, email, reason, created_at, status)
select
  c.name,
  c.email,
  nullif(trim(replace(c.message, '[ACCOUNT DELETE REQUEST]', '')), ''),
  c.created_at,
  'pending'
from public.contact_messages c
where c.message like '[ACCOUNT DELETE REQUEST]%'
  and not exists (
    select 1 from public.account_delete_requests r
    where lower(r.email) = lower(c.email) and r.created_at = c.created_at
  );

-- Jo request user ke email se match ho jaye, use uska user_id bhi de do.
update public.account_delete_requests r
set user_id = p.id
from public.profiles p
where r.user_id is null and lower(p.email) = lower(r.email);

/* ------------------------------------------------------------------ */
/*  5. Jaanch                                                          */
/* ------------------------------------------------------------------ */

-- select status, count(*) from public.account_delete_requests group by status;
-- select id, email, deleted_at from public.profiles where deleted_at is not null;
