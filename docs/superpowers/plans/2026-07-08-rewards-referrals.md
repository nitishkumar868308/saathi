# First-1000 Reward + Referrals + Admin Config — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Verify with `npx tsc --noEmit` (web + app); no test runner in repo.

**Goal:** Waitlist hatao. Pehle 1000 signups ko 3 mahine Plus. Referral: 1 referral = 15 din Plus **dono** ko (cap 6 mahine), reward tabhi jab naya user **document upload + Saathi se chat** kare. Admin se ye sab knobs manage ho.

**Architecture:** Sab grant logic Postgres RPC (`security definer`) me — client bharosa nahi. Din hamesha `greatest(now(), plan_expires_at) + N days` pe **add** hote hain, isliye paid user ka plan bhi extend hota hai. Config `app_config` table me (admin editable). Chat message **edge function** server-side record karta hai (anti-fraud).

**Decisions (locked):**
- First-N = signup order (`profiles.created_at` rank ≤ N). Auto-grant on first login.
- Referral code: signup screen field + share-link (`apkasaathi.com/r/CODE`) autofill.
- "Meaningful AI action" = ≥1 chat message to Saathi (server-recorded).
- Landing waitlist form → **Play Store download CTA**.
- Waitlist **table delete nahi** (data reh sakta hai) — sirf product surface hatega.

---

## Phase A — Database

### Task A1: `supabase/rewards-referrals.sql`

- [ ] **Step 1: Config table + defaults**

```sql
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_config(key, value) values
  ('first_n_enabled',     'true'::jsonb),
  ('first_n_users',       '1000'::jsonb),
  ('first_n_free_months', '3'::jsonb),
  ('referrals_enabled',   'true'::jsonb),
  ('referral_days',       '15'::jsonb),
  ('referral_cap_months', '6'::jsonb)
on conflict (key) do nothing;

alter table public.app_config enable row level security;
drop policy if exists "read config" on public.app_config;
create policy "read config" on public.app_config for select using (true);
-- writes: sirf service_role (admin API).

create or replace function public.cfg_int(k text, dflt int)
returns int language sql stable as $$
  select coalesce((select (value #>> '{}')::int from public.app_config where key = k), dflt);
$$;

create or replace function public.cfg_bool(k text, dflt boolean)
returns boolean language sql stable as $$
  select coalesce((select (value #>> '{}')::boolean from public.app_config where key = k), dflt);
$$;
```

- [ ] **Step 2: Profile + ownership columns**

```sql
alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists referred_by uuid references auth.users(id);
alter table public.profiles add column if not exists referral_days_earned int not null default 0;
alter table public.profiles add column if not exists first_n_granted boolean not null default false;

-- Anti-fraud checks ke liye ownership chahiye.
alter table public.documents add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.messages  add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists documents_user_idx on public.documents(user_id);
create index if not exists messages_user_idx  on public.messages(user_id);
```

- [ ] **Step 3: Referrals table**

```sql
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referee_id  uuid not null unique references auth.users(id) on delete cascade,
  code text not null,
  qualified_at timestamptz,
  rewarded_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint no_self_referral check (referrer_id <> referee_id)
);
create index if not exists referrals_referrer_idx on public.referrals(referrer_id);
alter table public.referrals enable row level security;
drop policy if exists "own referrals" on public.referrals;
create policy "own referrals" on public.referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referee_id);
```

- [ ] **Step 4: Grant helper (days add karo, paid plan extend ho)**

```sql
create or replace function public.grant_plus_days(p_uid uuid, p_days int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
     set plan = 'plus',
         plan_expires_at = greatest(coalesce(plan_expires_at, now()), now())
                           + make_interval(days => p_days),
         plan_source = coalesce(plan_source, 'reward')
   where id = p_uid;
end;
$$;
```

- [ ] **Step 5: Referral code auto-generate on signup**

```sql
create or replace function public.gen_referral_code()
returns text language sql stable as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

-- handle_new_user ko update: profile + referral_code
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare c text;
begin
  loop
    c := public.gen_referral_code();
    exit when not exists (select 1 from public.profiles where referral_code = c);
  end loop;

  insert into public.profiles (id, email, full_name, referral_code)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    c
  )
  on conflict (id) do update set full_name = excluded.full_name;
  return new;
end;
$$;

-- Purane users ko bhi code do
update public.profiles set referral_code = public.gen_referral_code()
where referral_code is null;
```

- [ ] **Step 6: First-N reward (waitlist ki jagah)**

```sql
create or replace function public.claim_first_n_reward()
returns text language plpgsql security definer set search_path = public as $$
declare urank int; months int;
begin
  if not public.cfg_bool('first_n_enabled', true) then return 'disabled'; end if;
  if (select first_n_granted from public.profiles where id = auth.uid()) then
    return 'already';
  end if;

  select rnk into urank from (
    select id, row_number() over (order by created_at asc) as rnk
    from public.profiles
  ) t where t.id = auth.uid();

  if urank is null or urank > public.cfg_int('first_n_users', 1000) then
    return 'not_eligible';
  end if;

  months := public.cfg_int('first_n_free_months', 3);
  perform public.grant_plus_days(auth.uid(), months * 30);
  update public.profiles set first_n_granted = true where id = auth.uid();
  return 'granted';
end;
$$;
grant execute on function public.claim_first_n_reward() to authenticated;
```

- [ ] **Step 7: Apply referral code (signup pe)**

```sql
create or replace function public.apply_referral_code(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare ref_id uuid;
begin
  if not public.cfg_bool('referrals_enabled', true) then return 'disabled'; end if;
  if auth.uid() is null then return 'no_auth'; end if;
  if exists (select 1 from public.referrals where referee_id = auth.uid()) then
    return 'already_referred';
  end if;

  select id into ref_id from public.profiles
   where upper(referral_code) = upper(trim(p_code));
  if ref_id is null then return 'invalid_code'; end if;
  if ref_id = auth.uid() then return 'self'; end if;

  insert into public.referrals (referrer_id, referee_id, code)
  values (ref_id, auth.uid(), upper(trim(p_code)));
  update public.profiles set referred_by = ref_id where id = auth.uid();
  return 'applied';
end;
$$;
grant execute on function public.apply_referral_code(text) to authenticated;
```

- [ ] **Step 8: Qualification + reward (document + chat dono hone pe)**

```sql
create or replace function public.check_referral_qualification()
returns text language plpgsql security definer set search_path = public as $$
declare r record; days int; cap_days int; earned int;
begin
  select * into r from public.referrals
   where referee_id = auth.uid() and rewarded_at is null;
  if r is null then return 'no_referral'; end if;

  -- Anti-fraud: naya user ne document upload kiya AUR Saathi se chat kiya
  if not exists (select 1 from public.documents where user_id = auth.uid()) then
    return 'need_document';
  end if;
  if not exists (select 1 from public.messages
                  where user_id = auth.uid() and role = 'user') then
    return 'need_chat';
  end if;

  days     := public.cfg_int('referral_days', 15);
  cap_days := public.cfg_int('referral_cap_months', 6) * 30;

  select referral_days_earned into earned from public.profiles where id = r.referrer_id;
  if earned + days <= cap_days then
    perform public.grant_plus_days(r.referrer_id, days);
    update public.profiles set referral_days_earned = earned + days
     where id = r.referrer_id;
  end if;

  -- Naye user ko hamesha (uska pehla referral hai)
  perform public.grant_plus_days(auth.uid(), days);

  update public.referrals
     set qualified_at = coalesce(qualified_at, now()), rewarded_at = now()
   where id = r.id;
  return 'rewarded';
end;
$$;
grant execute on function public.check_referral_qualification() to authenticated;
```

- [ ] **Step 9: Admin manual grant (service_role se)**

```sql
create or replace function public.admin_grant_days(p_email text, p_days int)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select id into uid from public.profiles where lower(email) = lower(trim(p_email));
  if uid is null then return 'user_not_found'; end if;
  perform public.grant_plus_days(uid, p_days);
  return 'granted';
end;
$$;
-- authenticated ko grant NAHI. Sirf service_role (admin API) call karega.
```

- [ ] **Step 10:** Supabase SQL Editor me run karo. Expected: success, dobara run bhi safe.
- [ ] **Step 11: Commit** `git add supabase/rewards-referrals.sql && git commit -m "feat(db): first-N reward + referrals + app_config"`

---

## Phase B — Edge function: chat message server-side record

### Task B1: `supabase/functions/ai/index.ts`
- [ ] Authorization header se user nikaalo (`supabase.auth.getUser(jwt)`).
- [ ] `task === "chat"` pe, reply ke baad service-role se `messages` me 2 rows insert karo
      (`role='user'` + `role='saathi'`, dono me `user_id`).
- [ ] Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Edge Function secrets).
- [ ] Insert fail ho to chat fail na ho (best-effort, try/catch).
- [ ] **Commit**

---

## Phase C — App (Expo)

### Task C1: ownership on insert
- [ ] `lib/documents.ts` → `addDocument` me `user_id` set karo (auth.getUser()).
- [ ] `lib/reminders.ts` pehle se `user_id` set karta hai ✓ (kuch nahi karna).

### Task C2: `lib/plan.ts` — naye RPC wrappers
- [ ] `claimWaitlistReward()` **hatao** → `claimFirstNReward()` (`rpc('claim_first_n_reward')`).
- [ ] `applyReferralCode(code)` → `rpc('apply_referral_code', { p_code })`.
- [ ] `checkReferralQualification()` → `rpc('check_referral_qualification')`.
- [ ] `getReferralInfo()` → profiles se `referral_code`, `referral_days_earned`; referrals count.

### Task C3: auth-provider
- [ ] Login pe `claimWaitlistReward()` → `claimFirstNReward()`.
- [ ] Login pe `checkReferralQualification()` bhi call (best-effort) — jab conditions poori ho jaayein tab reward lage.

### Task C4: signup me referral code
- [ ] `login.tsx` signup mode me optional "Referral code" `TextInput`.
- [ ] Signup success ke baad `applyReferralCode(code)` (agar code diya ho).
- [ ] Deep link `apkasaathi.com/r/CODE` → app khule to code prefill (expo-linking `useURL()`), warna ignore.

### Task C5: qualification trigger points
- [ ] Document add hone ke baad aur chat reply aane ke baad `checkReferralQualification()` (best-effort, silent).

### Task C6: Referral share screen
- [ ] Nayi screen `app/referral.tsx`: apna code, share button (`Share.share` with `https://apkasaathi.com/r/CODE`),
      kitne referral hue, kitne din kamaaye, cap.
- [ ] Settings me "Dost bulao — 15 din free" row.

### Task C7: copy
- [ ] `upgrade.tsx` reward text: "Pehle 1000 users ko Saathi Plus **3 mahine** FREE!"
- [ ] **Commit** har task ke baad.

---

## Phase D — Web: waitlist hatao + copy

### Task D1: Landing CTA
- [ ] `app/page.tsx` hero `<WaitlistForm id="hero" />` → **Play Store download button**.
- [ ] Footer CTA me bhi wahi. `WaitlistCount` hatao.
- [ ] `components/WaitlistForm.tsx`, `WaitlistCount.tsx` — **delete nahi**, bas use hatao (baad me kaam aa sakte).

### Task D2: Copy
- [ ] `lib/i18n/dictionaries.ts` (hi/en/hinglish): `reward` → "Pehle 1000 users ko Saathi Plus 3 mahine FREE!",
      `note` → 3 mahine wali line. Hero/waitlist copy → download CTA copy.
- [ ] `Pricing.tsx` reward banner (t.reward se aata hai — auto).
- [ ] `AboutContent.tsx`, `privacy/page.tsx` me waitlist mentions update.

### Task D3: Referral landing
- [ ] Naya route `app/r/[code]/page.tsx` → Play Store pe redirect + code ko `?ref=` me pass (ya cookie).
      Simple: page dikhaye "Aapko <code> se invite mila — app download karo", + Play Store button.

### Task D4: Waitlist API/route
- [ ] `app/api/waitlist/route.ts` — 410 Gone return kare (ya hata do). Table chhoda rahega.
- [ ] `lib/store.ts` waitlist functions rehne do (admin abhi bhi purana data dekh sake).
- [ ] **Commit**

---

## Phase E — Admin

### Task E1: Config API
- [ ] `app/api/admin/config/route.ts` — GET (sab config) / PUT (update). `isAuthed()` se protect.
- [ ] Service-role se `app_config` upsert.

### Task E2: Manual grant API
- [ ] `app/api/admin/grant/route.ts` — POST `{ email, days }` → `rpc/admin_grant_days`. `isAuthed()`.

### Task E3: Admin UI
- [ ] `AdminDashboard.tsx`: naya "Offers & Referrals" section —
      first_n_enabled/users/months, referrals_enabled/days/cap_months edit + save.
- [ ] Manual grant form (email + days).
- [ ] Referral stats (total referrals, rewarded count) — `/api/admin/data` me add.
- [ ] Waitlist section chhoda rahe (purana data), par "legacy" label.
- [ ] **Commit**

---

## Phase F — Verify + docs
- [ ] `cd web && npx tsc --noEmit` → clean
- [ ] `cd app-mobile && npx tsc --noEmit` → clean
- [ ] `docs/rewards-referrals.md` — kaise kaam karta hai, admin knobs, SQL run order.
- [ ] **Commit**

---

## Notes / risks
- `documents`/`messages` pe abhi permissive RLS hai; `user_id` add ho raha hai. Baad me own-row RLS lagana chahiye.
- Referral reward **idempotent** hai (`rewarded_at` set hone ke baad dobara nahi).
- Cap sirf **referrer** pe lagta hai; naye user ko uska ek-baar ka 15 din milta hai.
- `grant_plus_days` paid plan ko extend karta hai (expiry aage badhti hai) — paid user ka plan safe.
