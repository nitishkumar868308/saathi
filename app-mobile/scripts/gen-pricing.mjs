#!/usr/bin/env node
/**
 * Har country ka pricing row banata hai — currency, symbol, conversion rate,
 * multiplier.
 *
 * Chalao:  cd app-mobile && node scripts/gen-pricing.mjs
 *
 * Teen files banti hain:
 *   supabase/country-pricing-data.sql   <- Supabase me chalane ke liye
 *   supabase/country-pricing.json       <- padhne/check karne ke liye
 *   supabase/country-pricing.csv        <- Excel me kholne ke liye
 *
 * Formula (country-pricing.sql wala):
 *   local_amount = round(base_INR × multiplier × conversion_rate)
 *
 * ⚠️ INDIA KA MULTIPLIER 1 HI RAHTA HAI.
 * base price khud INR me hai (app_config.plus_price_monthly = 99), yaani India
 * "base" market hai. Uska multiplier 2 karne ka matlab hoga Indian users ka
 * price CHUPCHAAP DOUBLE kar dena — 99 ka 198. Isliye India = 1, baaki sab = 2.
 * Ye badalna ho to neeche MULTIPLIER/BASE_COUNTRY se badlo.
 *
 * ⚠️ Rates HAR DIN badalte hain. Ye file ek snapshot hai — mahine me ek baar
 * dobara chala ke SQL chala dena, warna price dheere-dheere galat hota jaayega.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SUPA = join(HERE, "..", "..", "supabase");

const BASE_COUNTRY = "IN";
const MULTIPLIER = 2;
const FX_URL = "https://open.er-api.com/v6/latest/INR";

/** SQL string literal — naam me apostrophe ho to ('Cote d''Ivoire'). */
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

/**
 * Rate ko kitne decimal tak rakhein.
 *
 * USD jaise mehnge currency me 1 INR = 0.0104 hota hai — 2 decimal par wo 0.01
 * ban jaata aur price ~4% galat ho jaata. Isliye chhoti value par zyada
 * decimal. IDR jaise sasste me 1 INR = 190 hota hai, wahan decimal bekaar hai.
 */
function roundRate(r) {
  if (r >= 100) return Math.round(r);
  if (r >= 1) return Math.round(r * 10000) / 10000;
  return Math.round(r * 1000000) / 1000000;
}

const fx = await fetch(FX_URL).then((r) => r.json());
if (fx.result !== "success") throw new Error(`FX fetch fail: ${JSON.stringify(fx).slice(0, 200)}`);
const rates = fx.rates;

/**
 * CSV ki ek line ko fields me todo — quotes ka dhyan rakhte hue.
 *
 * ⚠️ Seedha `line.split(",")` yahan kaam nahi karta: ek country ka naam khud
 * comma rakhta hai — `BQ,BES,"Bonaire, Sint Eustatius and Saba",USD,$`. Naive
 * split usse do fields bana deta tha, jisse uska naam bhi bigadta tha aur
 * currency bhi khisak jaati thi (USD ki jagah aadha naam aa jaata).
 */
function csvFields(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // "" andar ka literal quote hai, warna quote khulta/band hota hai.
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

// countries-currency.csv = wahi list jisse DB ka iso2/currency bhara gaya tha.
const csv = readFileSync(join(SUPA, "countries-currency.csv"), "utf8").trim().split(/\r?\n/);
const head = csvFields(csv[0]);
const col = (n) => head.indexOf(n);

const rows = [];
const skipped = [];

for (const line of csv.slice(1)) {
  const p = csvFields(line);
  const iso2 = p[col("iso2")].trim().toUpperCase();
  const name = p[col("name")].trim();
  const currency = p[col("currency")].trim().toUpperCase();
  const symbol = p[col("currency_symbol")].trim();

  if (!iso2 || !currency) continue;

  const isBase = iso2 === BASE_COUNTRY;
  const rate = isBase ? 1 : rates[currency];

  // FX API me jis currency ka rate hi nahi (kuch chhote/pegged currency), usse
  // chhod dete hain — galat rate se price dikhane se behtar hai row hi na ho.
  // Row na hone par app base ₹ price dikhata hai (localAmount ka fallback).
  if (rate == null) {
    skipped.push({ iso2, name, currency });
    continue;
  }

  rows.push({
    country_code: iso2,
    country_name: name,
    currency,
    symbol: symbol || currency,
    conversion_rate: isBase ? 1 : roundRate(rate),
    multiplier: isBase ? 1 : MULTIPLIER,
  });
}

rows.sort((a, b) => a.country_code.localeCompare(b.country_code));

/* ------------------------------- SQL ------------------------------- */

const values = rows
  .map(
    (r) =>
      `  (${q(r.country_code)}, ${q(r.country_name)}, ${q(r.currency)}, ${q(r.symbol)}, ${r.conversion_rate}, ${r.multiplier})`,
  )
  .join(",\n");

const sql = `-- Har country ka pricing — currency, symbol, conversion rate, multiplier.
--
-- Formula (country-pricing.sql me tay hua):
--   local_amount = round(base_INR × multiplier × conversion_rate)
--
-- multiplier: India 1, baaki sab ${MULTIPLIER}.
-- ⚠️ India 1 isliye hai ki base price khud INR me hai (99/999). India ka
--    multiplier ${MULTIPLIER} karna matlab Indian users ka price double kar dena.
--
-- Rates: ${fx.time_last_update_utc}
-- Source: ${FX_URL}
-- ⚠️ Rates roz badalte hain. Mahine me ek baar
--    \`cd app-mobile && node scripts/gen-pricing.mjs\` chala ke ye file dobara
--    chala dena — warna price dheere-dheere galat hota jaayega.
--
-- Ye file apne aap banti hai — haath se mat badalna.
-- \`country-pricing.sql\` ke BAAD chalao (wo table banata hai).

insert into public.country_pricing
  (country_code, country_name, currency, symbol, conversion_rate, multiplier)
values
${values}
on conflict (country_code) do update set
  country_name    = excluded.country_name,
  currency        = excluded.currency,
  symbol          = excluded.symbol,
  conversion_rate = excluded.conversion_rate,
  -- ⚠️ multiplier ko jaan-boojh ke NAHI chhedte agar admin ne haath se badla ho?
  -- Nahi — yahan overwrite karte hain, taaki ye file hi ek sach rahe. Kisi ek
  -- country ka multiplier alag chahiye to admin panel se badlo, ye file dobara
  -- chalane par wo wapas ${MULTIPLIER} ho jaayega.
  multiplier      = excluded.multiplier,
  updated_at      = now();

-- Check:
--   select count(*) from public.country_pricing;                    -- ${rows.length}
--   select * from public.country_pricing where country_code = 'IN'; -- rate 1, multiplier 1
`;

writeFileSync(join(SUPA, "country-pricing-data.sql"), sql, "utf8");

/* --------------------------- JSON + CSV --------------------------- */

writeFileSync(
  join(SUPA, "country-pricing.json"),
  JSON.stringify(
    {
      generated_at: fx.time_last_update_utc,
      source: FX_URL,
      base_country: BASE_COUNTRY,
      multiplier: MULTIPLIER,
      note: "conversion_rate = 1 INR me kitni local currency. India base hai (rate 1, multiplier 1).",
      count: rows.length,
      skipped,
      countries: rows,
    },
    null,
    2,
  ),
  "utf8",
);

const outCsv = [
  "country_code,country_name,currency,symbol,conversion_rate,multiplier,price_for_99_INR",
  ...rows.map((r) => {
    const p = 99 * r.multiplier * r.conversion_rate;
    const shown = p >= 20 ? Math.round(p) : Math.round(p * 10) / 10;
    return `${r.country_code},"${r.country_name}",${r.currency},"${r.symbol}",${r.conversion_rate},${r.multiplier},${shown}`;
  }),
].join("\n");
writeFileSync(join(SUPA, "country-pricing.csv"), outCsv, "utf8");

console.log(`${rows.length} countries -> supabase/country-pricing-data.sql + .json + .csv`);
if (skipped.length) {
  console.log(`\nChhoot gaye (FX me rate nahi mila) — inhe base ₹ price dikhega: ${skipped.length}`);
  skipped.forEach((s) => console.log(`   ${s.iso2}  ${s.name}  (${s.currency})`));
}
