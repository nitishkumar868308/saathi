-- Cron ki nabz — "call sach me aayi thi ya nahi".
-- Supabase SQL Editor me Run karo. Dobara run safe hai.
--
-- ⚠️ Ye kyun chahiye tha:
--
-- Admin panel abhi cron ka haal REMINDERS se andaza lagata hai — beet chuke par
-- na chhue gaye reminder ginta hai (`web/lib/delivery-health.ts`). Wo saboot
-- pakka hai, par wo do bilkul alag halaat me chup ho jaata hai:
--
--   • Kisi ka koi reminder due hi na ho -> ginti 0 -> "sab theek hai" — chahe
--     cron mahine se band pada ho.
--   • Cron ki call POHONCH rahi ho par 401 par lauT rahi ho -> reminder atke
--     dikhte hain (sahi), par ye pata nahi chalta ki call aayi bhi thi ya nahi.
--     Aur yahi dono soorat ka ilaaj sabse alag hai: ek me job hi nahi hai,
--     doosre me secret galat hai.
--
-- Nabz dono ka farq saaf kar deti hai: har cron call apna nishaan yahan chhod
-- deti hai — chahe us call me bhejne ko kuch mila ho ya nahi.

create table if not exists public.cron_health (
  -- 'send-reminders', 'document-expiry', 'error-digest', 'sync-play-prices'
  job         text primary key,
  -- Aakhri baar ye route KAB tak pahunchi (auth paar karke).
  last_ok_at  timestamptz not null default now(),
  -- Ab tak kitni baar. Ye ginti hi batati hai ki cron ka rhythm theek hai ya
  -- wo beech-beech me atak raha hai.
  runs        bigint not null default 0
);

-- ⚠️ RLS on, aur koi policy NAHI. Iska matlab: anon/authenticated is table ko
-- chhoo hi nahi sakte. Likhne wala sirf service_role hai (jo RLS ke upar hai)
-- aur wo sirf hamare cron routes ke paas hai. Ye admin ka andaruni saboot hai —
-- app ko iski koi zaroorat nahi.
alter table public.cron_health enable row level security;

comment on table public.cron_health is
  'Har cron route apni nabz yahan chhodta hai. Sirf service_role padhta/likhta hai.';
