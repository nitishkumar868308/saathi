-- #11 — Country-wise pricing.
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
