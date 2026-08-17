-- Language preference ko DB me rakho taaki:
--   • user ka doosra device / web bhi wahi bhasha dikhaye
--   • server-side emails (welcome, reminder) user ki bhasha me jaayein
--
-- Chalao: Supabase SQL editor me ye poora file run karo (idempotent hai).

alter table public.profiles
  add column if not exists language text not null default 'hinglish';

-- Sirf 3 supported values allow karo.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_language_check'
  ) then
    alter table public.profiles
      add constraint profiles_language_check
      check (language in ('hinglish', 'hi', 'en'));
  end if;
end $$;

comment on column public.profiles.language is
  'User ki chuni hui bhasha: hinglish | hi | en. App/web se sync hoti hai, emails isi me jaate hain.';

-- ───────────────────────────────────────────────────────────────────────────
-- Naye user ki bhasha PEHLE HI PAL SE — signup ke metadata se.
--
-- ⚠️ Iske bina naye user ka pehla email hamesha Hinglish me jaata hai, chahe
-- usne app me Hindi hi chuni ho. Wajah waqt ki hai: `on_auth_user_created`
-- trigger `profiles` ki row usi pal bana deta hai jab account banta hai, aur us
-- row ka `language` abhi upar wala DEFAULT hota hai. Confirm/welcome wala email
-- theek us waqt jaata hai — yaani wo default padh ke chala jaata hai, aur user
-- ki asli pasand (jo app `signUp` ke metadata me bhejti hai) padi rehti hai.
--
-- Ye function `supabase/profiles.sql` wale ko badal deta hai (naam wahi hai),
-- bas ek column zyada bharta hai. Dono file kisi bhi kram me chalayi ja sakti
-- hain — jo baad me chale, uska version rehta hai, isliye badlaav ke baad ye
-- file baad me chalao.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, language)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    -- Kachhi value (purani app, ya Google login jisme language hi nahi hoti) par
    -- default par gir jao — warna `profiles_language_check` poora signup rok deta.
    case
      when new.raw_user_meta_data->>'language' in ('hinglish', 'hi', 'en')
        then new.raw_user_meta_data->>'language'
      else 'hinglish'
    end
  )
  on conflict (id) do update set full_name = excluded.full_name;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
