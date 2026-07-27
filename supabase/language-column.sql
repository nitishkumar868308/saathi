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
