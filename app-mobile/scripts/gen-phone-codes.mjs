#!/usr/bin/env node
/**
 * `supabase/country-phone-codes.sql` banata hai — countries.phone_code bharne ke liye.
 *
 * Chalao:  cd app-mobile && node scripts/gen-phone-codes.mjs
 *
 * Kyun ye script yahan (app-mobile me) hai aur supabase/ me nahi: data
 * `libphonenumber-js` se aata hai, aur wo package sirf app-mobile me install
 * hai. (`supabase/build-country-currency.js` CSV padhta hai, usse koi dep nahi
 * chahiye — isliye wo wahan reh sakta hai.)
 *
 * Data ek hi baar library se nikalta hai aur DB me chala jaata hai. Uske baad
 * app dial code DB se padhti hai, library se nahi.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";

const rows = getCountries()
  .map((cc) => {
    try {
      return `  ('${cc}','+${getCountryCallingCode(cc)}')`;
    } catch {
      // Kuch ISO codes ka calling code hota hi nahi — unhe chhod do.
      return null;
    }
  })
  .filter(Boolean);

const sql = `-- Phone ka dial code ab DB se aata hai.
--
-- ⚠️ Pehle app dial code seedha \`libphonenumber-js\` se nikaalti thi. Wo
-- hardcoded to nahi tha, par tha app ke ANDAR — matlab DB me naya country
-- jodne par uska phone code apne aap nahi aata tha, aur code badalne ke liye
-- har baar nayi app build karni padti.
--
-- Ab \`countries.phone_code\` hi sach hai. Library sirf number VALIDATE karne
-- ke liye rehti hai (ki "+91 98765" poora number hai ya nahi) — wo kaam DB nahi
-- kar sakti.
--
-- Ye file \`app-mobile/scripts/gen-phone-codes.mjs\` se apne aap banti hai.
-- Dobara chalana safe hai.

alter table public.countries add column if not exists phone_code text;

-- ⚠️ Match \`iso2\` par hota hai, \`code\` par nahi: \`code\` me kahin ISO2 hai
-- kahin ISO3 (isi wajah se \`add-country-currency.sql\` ne alag \`iso2\` column
-- banaya tha). \`coalesce\` dono ko dekh leta hai taaki ek bhi row chhoote nahi.
update public.countries c
set phone_code = v.dial
from (values
${rows.join(",\n")}
) as v(iso2, dial)
where upper(coalesce(c.iso2, c.code)) = v.iso2;

-- Chala ke ye dekh lena — "baaki" 0 hona chahiye:
--
--   select count(*) filter (where phone_code is not null) as bhar_gaya,
--          count(*) filter (where phone_code is null)     as baaki
--   from public.countries;
--
-- Kuch baaki reh jaayein to unka iso2 khali hoga:
--
--   select id, name, code, iso2 from public.countries where phone_code is null;
`;

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "country-phone-codes.sql");
writeFileSync(out, sql, "utf8");
console.log(`${rows.length} countries -> ${out}`);
