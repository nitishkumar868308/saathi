-- Apka Saathi — Admin team (roles + members + sidebar permissions).
-- Supabase SQL Editor me Run karo. (Dobara run safe.)
--
-- Ab tak /admin ek hi password se khulta tha. Uske do natije the: password
-- kisi ko dena matlab use POORA admin de dena (pricing, users, documents —
-- sab), aur kaun sa kaam kisne kiya iska koi hisaab hi nahi rehta tha.
--
-- Ab:
--   * har admin ka apna email + apna password
--   * "role" me tay hota hai ki sidebar me kaun se menu dikhenge
--   * naya member pehle `pending` rehta hai — master ke approve karne tak
--     uska login chalta hi nahi
--
-- ⚠️ ADMIN_PASSWORD wala master login abhi bhi kaam karta hai aur usko hamesha
--    saare menu milte hain. Wo jaan-boojh ke rakha gaya hai: agar in tables me
--    kuch gadbad ho jaye (ya aakhri active admin galti se disable ho jaye) to
--    andar jaane ka ek raasta bacha rehna chahiye.
--
-- RLS ON hai aur koi policy nahi — matlab anon/publishable key se ye tables
-- bilkul nahi khulte. Sirf server (service_role) inhe padhta-likhta hai.
-- Password hash yahan padte hain; ye baat yahan sabse zyada maayne rakhti hai.

/* ------------------------------------------------------------------ */
/* 1. Roles                                                            */
/* ------------------------------------------------------------------ */
create table if not exists public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  -- Sidebar ke menu keys: 'users', 'contacts', 'pricing', 'team' …
  -- Poori list web/lib/admin-menus.ts me hai (wahi ek sachchi jagah hai).
  menus text[] not null default '{}',
  created_at timestamptz not null default now()
);

/* ------------------------------------------------------------------ */
/* 2. Members                                                          */
/* ------------------------------------------------------------------ */
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  role_id uuid references public.admin_roles(id) on delete set null,

  -- Role ke upar is ek bande ke liye alag se chhoot / rok.
  -- Asli menu = (role.menus + menus_extra) - menus_denied
  menus_extra  text[] not null default '{}',
  menus_denied text[] not null default '{}',

  -- scrypt$N$r$p$<salt-b64>$<hash-b64> — dekho web/lib/admin-password.ts
  password_hash text not null,

  -- 'pending'  = invite chala gaya, approve hona baaki (login band)
  -- 'active'   = chalu
  -- 'disabled' = band kiya hua (row rakhi hai taaki hisaab bana rahe)
  status text not null default 'pending'
    check (status in ('pending', 'active', 'disabled')),

  created_at    timestamptz not null default now(),
  created_by    text,
  last_login_at timestamptz
);

create index if not exists admin_users_email_idx on public.admin_users (lower(email));

/* ------------------------------------------------------------------ */
/* 3. RLS — sirf server                                                */
/* ------------------------------------------------------------------ */
alter table public.admin_roles enable row level security;
alter table public.admin_users enable row level security;
-- (Koi policy jaan-boojh ke NAHI banayi. Ek bhi "for all using (true)" yahan
--  likh dena matlab publishable key se saare admin password hash padh lena.)

/* ------------------------------------------------------------------ */
/* 4. Shuruaati roles                                                  */
/* ------------------------------------------------------------------ */
-- Ye sirf ek shuruaat hai — admin > Team se inhe badla ja sakta hai.
insert into public.admin_roles (name, menus) values
  ('Support',  array['support','contacts','users']),
  ('Content',  array['blog','seo','reviews','renewals']),
  ('Finance',  array['pricing','spend','usage','rewards'])
on conflict (name) do nothing;
