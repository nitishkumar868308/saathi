-- Google Play Console ka price = EK HI SACH.
--
-- ── Kyun ye table ──────────────────────────────────────────────────────────
-- Price Play Console me set hota hai. App wahi price seedha Play se padh leti
-- hai (`ProductDetails` / RevenueCat ka `priceString`) — usko is table ki
-- zaroorat hi nahi. Dikkat website aur admin panel ki hai: wahan Play Billing
-- hota hi nahi, isliye wo Play se seedha kuch nahi puchh sakte.
--
-- Isliye server (Next.js) roz ek baar Google Play Developer API se saare desh
-- ke price padhta hai aur yahan rakh deta hai. Website aur admin yahin se
-- padhte hain. Source phir bhi ek hi rehta hai — Play Console.
--
--   Play Console  →  Play Developer API  →  ye table  →  web + admin
--                 ↘  Play Billing (seedha)           →  app
--
-- ⚠️ Is table me kabhi haath se price mat likhna. Ye Play ki NAKAL hai, uska
--    maalik nahi. Haath se likhoge to wahi purani bimari wapas aa jaayegi:
--    screen kuch dikhayegi aur Play kuch aur kaatega. Price badalna hamesha
--    Play Console me — phir admin me "Sync now".
--
-- Purana `country_pricing` (base × multiplier × conversion_rate) hataya nahi
-- gaya: wo ab sirf FALLBACK hai — jab Play API set na ho ya sync fail ho jaye,
-- taaki website ka price kabhi khaali na dikhe.

-- ── Price ──────────────────────────────────────────────────────────────────
create table if not exists public.play_prices (
  -- Play Console ka subscription id, jaise 'plus_monthly' / 'plus_yearly'.
  product_id text not null,
  -- Us subscription ka base plan id (ek subscription ke kai base plan ho sakte
  -- hain). Isse hi pata chalta hai ki ye monthly ka daam hai ya yearly ka.
  base_plan_id text not null,
  -- ISO2, uppercase — 'IN', 'US', 'AE'. IP-country isi se match hota hai.
  region_code text not null,
  -- ISO 4217 — 'INR', 'USD'. Symbol ALAG se store nahi hota: `Intl.NumberFormat`
  -- currency code se khud sahi symbol aur sahi jagah (₹99 vs 99 kr) laga deta
  -- hai. Symbol ko haath se rakhna sirf ek aur cheez thi jo galat ho sakti thi.
  region_currency text not null,
  -- Play ka apna hisaab: 1 unit = 1,000,000 micros. ₹99 = 99000000.
  -- ⚠️ numeric/float me NAHI — paisa kabhi floating point me nahi rakhna.
  amount_micros bigint not null,
  -- ISO 8601 duration jaisa Play deta hai: 'P1M' (mahina), 'P1Y' (saal).
  billing_period text,
  synced_at timestamptz not null default now(),
  primary key (product_id, base_plan_id, region_code)
);

create index if not exists play_prices_region_idx
  on public.play_prices (region_code);

alter table public.play_prices enable row level security;

-- Public read — website aur app dono ko price dikhana hai, ye chhupane wali
-- cheez hai bhi nahi (Play Store par waise bhi sabko dikhta hai).
-- Likhna sirf service_role (sync job) — koi policy = koi insert/update nahi.
drop policy if exists "read play_prices" on public.play_prices;
create policy "read play_prices" on public.play_prices
  for select using (true);

-- ── Sync ka haal ───────────────────────────────────────────────────────────
-- Admin ko ye dikhna zaroori hai: "kab sync hua" aur "fail hua to kyun".
--
-- ⚠️ Iske bina sabse khatarnaak soorat banti hai — sync 3 hafte se fail ho, aur
--    admin panel purana price poore aaram se dikhata rahe, bina kisi nishaan ke.
--    Ek row, hamesha maujood, chahe sync fail hi kyun na ho.
create table if not exists public.play_price_sync (
  id boolean primary key default true,
  -- Aakhri KAAMYAB sync. Fail hone par ye purana hi rehta hai — jaan-boojh ke,
  -- kyunki "data kitna purana hai" wahi batata hai.
  synced_at timestamptz,
  ok boolean not null default false,
  -- Fail ki asli wajah (Google ka message) — "sync failed" se kuch pata nahi
  -- chalta, aur yahan aksar wajah "service account ko Play Console me access
  -- nahi diya" hoti hai.
  message text,
  -- Kitne (product × region) price aaye — 0 aaye to kuch to gadbad hai.
  rows_count integer not null default 0,
  -- Har koshish, chahe fail ho. `synced_at` se alag: isse pata chalta hai ki
  -- cron chal bhi raha hai ya nahi.
  attempted_at timestamptz not null default now(),
  constraint play_price_sync_single_row check (id)
);

insert into public.play_price_sync (id) values (true) on conflict (id) do nothing;

alter table public.play_price_sync enable row level security;

-- Sirf admin ke kaam ki cheez hai, aur wo service_role se padhta hai.
-- Koi public policy nahi — anon key se ye dikhega hi nahi.
