-- ⚠️ AB ISTEMAAL ME NAHI HAI — ise chalane ki zaroorat nahi.
--
-- Plus ka daam ab sirf Google Play Console me set hota hai aur `play_prices`
-- table me sync hota hai (`supabase/play-prices.sql`, docs/play-prices.md).
-- Neeche wala haath se bhara jaane wala hisaab poora hata diya gaya: koi code
-- ab is table ko na padhta hai na likhta hai, aur admin panel me iska editor
-- bhi nahi raha.
--
-- Wajah: conversion rate roz badalti hai aur admin mahine me ek baar hi use
-- chhoo paata tha. Natija hamesha ek — website ek daam dikhati aur Play doosra
-- kaat leta. Play ki policy yahi maangti hai ki jo dikhe wahi kate.
--
-- Table jaan-boojh ke DROP nahi ki gayi (kisi ka data mitana nahi tha). Jab
-- pakka ho jaye ki wapas nahi chahiye, tab:
--   drop table if exists public.country_pricing;
--
-- ─────────────────────────────────────────────────────────────────────────────
-- (purana) #11 — Country-wise pricing.
-- Formula: local_amount = round( base_INR * multiplier * conversion_rate )
--   base_INR         = app_config.plus_price_monthly / _yearly (jaise 99 / 999)
--   multiplier       = us country ke liye (India=1, bahar=jaise 3)
--   conversion_rate  = 1 INR = kitni local currency (India=1, USD=~0.012)
-- Display currency + symbol ke saath. Charge Play Store account-country se hota
-- hai (VPN/fake-GPS se sirf DISPLAY badalta hai, asli charge nahi — fraud-safe).

create table if not exists public.country_pricing (
  country_code text primary key,          -- ISO2, uppercase (IN, US, AE...)
  country_name text not null,
  currency text not null,                 -- ISO 4217 (INR, USD...)
  symbol text not null,                    -- ₹, $, د.إ...
  conversion_rate numeric not null default 1,   -- 1 INR = ? local
  multiplier numeric not null default 1,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.country_pricing enable row level security;

-- Public read — app/web ko price dikhane ke liye. Likhna sirf service_role (admin).
drop policy if exists "read country_pricing" on public.country_pricing;
create policy "read country_pricing" on public.country_pricing
  for select using (enabled = true);

-- India base row (multiplier 1, rate 1) — hamesha rahe.
insert into public.country_pricing (country_code, country_name, currency, symbol, conversion_rate, multiplier, enabled)
values ('IN', 'India', 'INR', '₹', 1, 1, true)
on conflict (country_code) do nothing;
