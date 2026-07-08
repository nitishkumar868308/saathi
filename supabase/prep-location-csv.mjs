// Location CSV ko Supabase import-ready banata hai (header + sirf zaroori columns).
//
// Ye "countries-states-cities" (dr5hn) dataset ke liye hai jisme header row nahi hoti.
// Column order (0-indexed) assume kiya gaya hai:
//   countries.csv : 0=id, 1=name, 2=iso3, 3=iso2  -> out: id,name,code(=iso2)
//   states.csv    : 0=id, 1=name, 2=country_id    -> out: id,country_id,name
//   cities.csv    : 0=id, 1=name, 2=state_id       -> out: id,state_id,name
// Agar aapki file ka column order alag ho to neeche MAP me index badal do.
//
// Usage (PowerShell / terminal, project root se):
//   node supabase/prep-location-csv.mjs countries "country (1).csv" countries_import.csv
//   node supabase/prep-location-csv.mjs states    states.csv        states_import.csv
//   node supabase/prep-location-csv.mjs cities    cities.csv        cities_import.csv
//
// Phir Supabase Table Editor > Import > *_import.csv upload karo (isme header hoga).

import { readFileSync, writeFileSync } from "node:fs";

const MAP = {
  countries: { header: ["id", "name", "code"], cols: [0, 1, 3] },
  states: { header: ["id", "country_id", "name"], cols: [0, 2, 1] },
  cities: { header: ["id", "state_id", "name"], cols: [0, 2, 1] },
};

const [type, inFile, outFile] = process.argv.slice(2);
if (!type || !inFile || !outFile || !MAP[type]) {
  console.error("Usage: node supabase/prep-location-csv.mjs <countries|states|cities> <input.csv> <output.csv>");
  process.exit(1);
}

// Minimal RFC4180 CSV parser (quoted fields, commas & newlines inside quotes handle karta hai).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* skip */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const { header, cols } = MAP[type];
const rows = parseCsv(readFileSync(inFile, "utf8"));

const out = [header.join(",")];
for (const r of rows) {
  out.push(cols.map((idx) => csvCell(r[idx])).join(","));
}
writeFileSync(outFile, out.join("\n"), "utf8");
console.log(`Done: ${rows.length} rows -> ${outFile} (columns: ${header.join(", ")})`);
