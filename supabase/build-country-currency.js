/**
 * countries table ke liye currency + symbol + iso2 data banata hai.
 * Sab LOCAL — kuch upload nahi hota.
 *
 * Chalao:  node supabase/build-country-currency.js
 * Banta hai:
 *   supabase/countries-currency.csv   <- download / import ke liye
 *   supabase/add-country-currency.sql <- seedha SQL editor me chala do (aasan)
 */
const fs = require("fs");
const path = require("path");

// iso2 | iso3 | naam | currency-code
const ROWS = `
AF|AFG|Afghanistan|AFN
AX|ALA|Aland Islands|EUR
AL|ALB|Albania|ALL
DZ|DZA|Algeria|DZD
AS|ASM|American Samoa|USD
AD|AND|Andorra|EUR
AO|AGO|Angola|AOA
AI|AIA|Anguilla|XCD
AQ|ATA|Antarctica|USD
AG|ATG|Antigua and Barbuda|XCD
AR|ARG|Argentina|ARS
AM|ARM|Armenia|AMD
AW|ABW|Aruba|AWG
AU|AUS|Australia|AUD
AT|AUT|Austria|EUR
AZ|AZE|Azerbaijan|AZN
BH|BHR|Bahrain|BHD
BD|BGD|Bangladesh|BDT
BB|BRB|Barbados|BBD
BY|BLR|Belarus|BYN
BE|BEL|Belgium|EUR
BZ|BLZ|Belize|BZD
BJ|BEN|Benin|XOF
BM|BMU|Bermuda|BMD
BT|BTN|Bhutan|BTN
BO|BOL|Bolivia|BOB
BQ|BES|Bonaire, Sint Eustatius and Saba|USD
BA|BIH|Bosnia and Herzegovina|BAM
BW|BWA|Botswana|BWP
BV|BVT|Bouvet Island|NOK
BR|BRA|Brazil|BRL
IO|IOT|British Indian Ocean Territory|USD
BN|BRN|Brunei|BND
BG|BGR|Bulgaria|BGN
BF|BFA|Burkina Faso|XOF
BI|BDI|Burundi|BIF
KH|KHM|Cambodia|KHR
CM|CMR|Cameroon|XAF
CA|CAN|Canada|CAD
CV|CPV|Cape Verde|CVE
KY|CYM|Cayman Islands|KYD
CF|CAF|Central African Republic|XAF
TD|TCD|Chad|XAF
CL|CHL|Chile|CLP
CN|CHN|China|CNY
CX|CXR|Christmas Island|AUD
CC|CCK|Cocos (Keeling) Islands|AUD
CO|COL|Colombia|COP
KM|COM|Comoros|KMF
CG|COG|Congo|CDF
CK|COK|Cook Islands|NZD
CR|CRI|Costa Rica|CRC
HR|HRV|Croatia|EUR
CU|CUB|Cuba|CUP
CW|CUW|Curacao|ANG
CY|CYP|Cyprus|EUR
CZ|CZE|Czech Republic|CZK
CD|COD|Democratic Republic of the Congo|CDF
DK|DNK|Denmark|DKK
DJ|DJI|Djibouti|DJF
DM|DMA|Dominica|XCD
DO|DOM|Dominican Republic|DOP
EC|ECU|Ecuador|USD
EG|EGY|Egypt|EGP
SV|SLV|El Salvador|USD
GQ|GNQ|Equatorial Guinea|XAF
ER|ERI|Eritrea|ERN
EE|EST|Estonia|EUR
SZ|SWZ|Eswatini|SZL
ET|ETH|Ethiopia|ETB
FK|FLK|Falkland Islands|FKP
FO|FRO|Faroe Islands|DKK
FJ|FJI|Fiji Islands|FJD
FI|FIN|Finland|EUR
FR|FRA|France|EUR
GF|GUF|French Guiana|EUR
PF|PYF|French Polynesia|XPF
TF|ATF|French Southern Territories|EUR
GA|GAB|Gabon|XAF
GE|GEO|Georgia|GEL
DE|DEU|Germany|EUR
GH|GHA|Ghana|GHS
GI|GIB|Gibraltar|GIP
GR|GRC|Greece|EUR
GL|GRL|Greenland|DKK
GD|GRD|Grenada|XCD
GP|GLP|Guadeloupe|EUR
GU|GUM|Guam|USD
GT|GTM|Guatemala|GTQ
GG|GGY|Guernsey|GBP
GN|GIN|Guinea|GNF
GW|GNB|Guinea-Bissau|XOF
GY|GUY|Guyana|GYD
HT|HTI|Haiti|HTG
HM|HMD|Heard Island and McDonald Islands|AUD
HN|HND|Honduras|HNL
HK|HKG|Hong Kong S.A.R.|HKD
HU|HUN|Hungary|HUF
IS|ISL|Iceland|ISK
IN|IND|India|INR
ID|IDN|Indonesia|IDR
IR|IRN|Iran|IRR
IQ|IRQ|Iraq|IQD
IE|IRL|Ireland|EUR
IL|ISR|Israel|ILS
IT|ITA|Italy|EUR
CI|CIV|Ivory Coast|XOF
JM|JAM|Jamaica|JMD
JP|JPN|Japan|JPY
JE|JEY|Jersey|GBP
JO|JOR|Jordan|JOD
KZ|KAZ|Kazakhstan|KZT
KE|KEN|Kenya|KES
KI|KIR|Kiribati|AUD
XK|XKX|Kosovo|EUR
KW|KWT|Kuwait|KWD
KG|KGZ|Kyrgyzstan|KGS
LA|LAO|Laos|LAK
LV|LVA|Latvia|EUR
LB|LBN|Lebanon|LBP
LS|LSO|Lesotho|LSL
LR|LBR|Liberia|LRD
LY|LBY|Libya|LYD
LI|LIE|Liechtenstein|CHF
LT|LTU|Lithuania|EUR
LU|LUX|Luxembourg|EUR
MO|MAC|Macau S.A.R.|MOP
MG|MDG|Madagascar|MGA
MW|MWI|Malawi|MWK
MY|MYS|Malaysia|MYR
MV|MDV|Maldives|MVR
ML|MLI|Mali|XOF
MT|MLT|Malta|EUR
IM|IMN|Man (Isle of)|GBP
MH|MHL|Marshall Islands|USD
MQ|MTQ|Martinique|EUR
MR|MRT|Mauritania|MRU
MU|MUS|Mauritius|MUR
YT|MYT|Mayotte|EUR
MX|MEX|Mexico|MXN
FM|FSM|Micronesia|USD
MD|MDA|Moldova|MDL
MC|MCO|Monaco|EUR
MN|MNG|Mongolia|MNT
ME|MNE|Montenegro|EUR
MS|MSR|Montserrat|XCD
MA|MAR|Morocco|MAD
MZ|MOZ|Mozambique|MZN
MM|MMR|Myanmar|MMK
NA|NAM|Namibia|NAD
NR|NRU|Nauru|AUD
NP|NPL|Nepal|NPR
NL|NLD|Netherlands|EUR
NC|NCL|New Caledonia|XPF
NZ|NZL|New Zealand|NZD
NI|NIC|Nicaragua|NIO
NE|NER|Niger|XOF
NG|NGA|Nigeria|NGN
NU|NIU|Niue|NZD
NF|NFK|Norfolk Island|AUD
KP|PRK|North Korea|KPW
MK|MKD|North Macedonia|MKD
MP|MNP|Northern Mariana Islands|USD
NO|NOR|Norway|NOK
OM|OMN|Oman|OMR
PK|PAK|Pakistan|PKR
PW|PLW|Palau|USD
PS|PSE|Palestinian Territory Occupied|ILS
PA|PAN|Panama|PAB
PG|PNG|Papua New Guinea|PGK
PY|PRY|Paraguay|PYG
PE|PER|Peru|PEN
PH|PHL|Philippines|PHP
PN|PCN|Pitcairn Island|NZD
PL|POL|Poland|PLN
PT|PRT|Portugal|EUR
PR|PRI|Puerto Rico|USD
QA|QAT|Qatar|QAR
RE|REU|Reunion|EUR
RO|ROU|Romania|RON
RU|RUS|Russia|RUB
RW|RWA|Rwanda|RWF
SH|SHN|Saint Helena|SHP
KN|KNA|Saint Kitts and Nevis|XCD
LC|LCA|Saint Lucia|XCD
PM|SPM|Saint Pierre and Miquelon|EUR
VC|VCT|Saint Vincent and the Grenadines|XCD
BL|BLM|Saint-Barthelemy|EUR
MF|MAF|Saint-Martin (French part)|EUR
WS|WSM|Samoa|WST
SM|SMR|San Marino|EUR
ST|STP|Sao Tome and Principe|STN
SA|SAU|Saudi Arabia|SAR
SN|SEN|Senegal|XOF
RS|SRB|Serbia|RSD
SC|SYC|Seychelles|SCR
SL|SLE|Sierra Leone|SLL
SG|SGP|Singapore|SGD
SX|SXM|Sint Maarten (Dutch part)|ANG
SK|SVK|Slovakia|EUR
SI|SVN|Slovenia|EUR
SB|SLB|Solomon Islands|SBD
SO|SOM|Somalia|SOS
ZA|ZAF|South Africa|ZAR
GS|SGS|South Georgia|GBP
KR|KOR|South Korea|KRW
SS|SSD|South Sudan|SSP
ES|ESP|Spain|EUR
LK|LKA|Sri Lanka|LKR
SD|SDN|Sudan|SDG
SR|SUR|Suriname|SRD
SJ|SJM|Svalbard and Jan Mayen Islands|NOK
SE|SWE|Sweden|SEK
CH|CHE|Switzerland|CHF
SY|SYR|Syria|SYP
TW|TWN|Taiwan|TWD
TJ|TJK|Tajikistan|TJS
TZ|TZA|Tanzania|TZS
TH|THA|Thailand|THB
BS|BHS|The Bahamas|BSD
GM|GMB|The Gambia|GMD
TL|TLS|Timor-Leste|USD
TG|TGO|Togo|XOF
TK|TKL|Tokelau|NZD
TO|TON|Tonga|TOP
TT|TTO|Trinidad and Tobago|TTD
TN|TUN|Tunisia|TND
TR|TUR|Turkey|TRY
TM|TKM|Turkmenistan|TMT
TC|TCA|Turks and Caicos Islands|USD
TV|TUV|Tuvalu|AUD
UG|UGA|Uganda|UGX
UA|UKR|Ukraine|UAH
AE|ARE|United Arab Emirates|AED
GB|GBR|United Kingdom|GBP
US|USA|United States|USD
UM|UMI|United States Minor Outlying Islands|USD
UY|URY|Uruguay|UYU
UZ|UZB|Uzbekistan|UZS
VU|VUT|Vanuatu|VUV
VA|VAT|Vatican City State (Holy See)|EUR
VE|VEN|Venezuela|VES
VN|VNM|Vietnam|VND
VG|VGB|Virgin Islands (British)|USD
VI|VIR|Virgin Islands (US)|USD
WF|WLF|Wallis and Futuna Islands|XPF
EH|ESH|Western Sahara|MAD
YE|YEM|Yemen|YER
ZM|ZMB|Zambia|ZMW
ZW|ZWE|Zimbabwe|ZWL
`.trim();

// currency code -> asli symbol (sahi Unicode)
const SYMBOL = {
  AED: "د.إ", AFN: "؋", ALL: "L", AMD: "֏", ANG: "ƒ", AOA: "Kz", ARS: "$",
  AUD: "$", AWG: "ƒ", AZN: "₼", BAM: "KM", BBD: "$", BDT: "৳", BGN: "лв",
  BHD: "د.ب", BIF: "FBu", BMD: "$", BND: "$", BOB: "Bs.", BRL: "R$", BSD: "$",
  BTN: "Nu.", BWP: "P", BYN: "Br", BZD: "$", CAD: "$", CDF: "FC", CHF: "CHF",
  CLP: "$", CNY: "¥", COP: "$", CRC: "₡", CUP: "$", CVE: "$", CZK: "Kč",
  DJF: "Fdj", DKK: "kr", DOP: "$", DZD: "د.ج", EGP: "ج.م", ERN: "Nfk",
  ETB: "Br", EUR: "€", FJD: "$", FKP: "£", GBP: "£", GEL: "₾", GHS: "₵",
  GIP: "£", GMD: "D", GNF: "FG", GTQ: "Q", GYD: "$", HKD: "$", HNL: "L",
  HTG: "G", HUF: "Ft", IDR: "Rp", ILS: "₪", INR: "₹", IQD: "ع.د", IRR: "﷼",
  ISK: "kr", JMD: "J$", JOD: "د.ا", JPY: "¥", KES: "KSh", KGS: "лв",
  KHR: "៛", KMF: "CF", KPW: "₩", KRW: "₩", KWD: "د.ك", KYD: "$", KZT: "₸",
  LAK: "₭", LBP: "ل.ل", LKR: "₨", LRD: "$", LSL: "L", LYD: "ل.د", MAD: "د.م.",
  MDL: "L", MGA: "Ar", MKD: "ден", MMK: "K", MNT: "₮", MOP: "MOP$", MRU: "UM",
  MUR: "₨", MVR: "Rf", MWK: "MK", MXN: "$", MYR: "RM", MZN: "MT", NAD: "$",
  NGN: "₦", NIO: "C$", NOK: "kr", NPR: "₨", NZD: "$", OMR: "﷼", PAB: "B/.",
  PEN: "S/", PGK: "K", PHP: "₱", PKR: "₨", PLN: "zł", PYG: "₲", QAR: "﷼",
  RON: "lei", RSD: "дин", RUB: "₽", RWF: "FRw", SAR: "﷼", SBD: "$", SCR: "₨",
  SDG: "ج.س", SEK: "kr", SGD: "$", SHP: "£", SLL: "Le", SOS: "Sh", SRD: "$",
  SSP: "£", STN: "Db", SYP: "£", SZL: "E", THB: "฿", TJS: "SM", TMT: "m",
  TND: "د.ت", TOP: "T$", TRY: "₺", TTD: "$", TWD: "NT$", TZS: "TSh", UAH: "₴",
  UGX: "USh", USD: "$", UYU: "$", UZS: "лв", VES: "Bs", VND: "₫", VUV: "VT",
  WST: "WS$", XAF: "FCFA", XCD: "$", XOF: "CFA", XPF: "₣", YER: "﷼", ZAR: "R",
  ZMW: "ZK", ZWL: "$",
};

const data = ROWS.split("\n").map((line) => {
  const [iso2, iso3, name, currency] = line.split("|");
  const symbol = SYMBOL[currency];
  if (!symbol) throw new Error(`symbol missing for ${currency} (${name})`);
  return { iso2, iso3, name, currency, symbol };
});

/* ------------------------------- CSV ------------------------------- */
const q = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const csv = [
  "iso2,iso3,name,currency,currency_symbol",
  ...data.map((r) => [r.iso2, r.iso3, r.name, r.currency, r.symbol].map(q).join(",")),
].join("\n");
fs.writeFileSync(path.join(__dirname, "countries-currency.csv"), csv, "utf8");

/* ------------------------------- SQL ------------------------------- */
const esc = (s) => s.replace(/'/g, "''");
const values = data
  .map((r) => `  ('${r.iso2}','${r.iso3}','${esc(r.currency)}','${esc(r.symbol)}')`)
  .join(",\n");

const sql = `-- countries table me currency + symbol + iso2 add karo (#11 pricing ke liye).
-- Supabase SQL Editor me chala do. Dobara chalana safe hai.
-- Ye file 'node supabase/build-country-currency.js' se apne aap banti hai.

alter table public.countries add column if not exists currency text;
alter table public.countries add column if not exists currency_symbol text;
-- code column me ISO2 hai ya ISO3 — pata nahi, isliye pakka ISO2 alag rakh rahe hain.
alter table public.countries add column if not exists iso2 text;

update public.countries c
set currency        = v.currency,
    currency_symbol = v.symbol,
    iso2            = v.iso2
from (values
${values}
) as v(iso2, iso3, currency, symbol)
where upper(trim(c.code)) = v.iso2
   or upper(trim(c.code)) = v.iso3;

create index if not exists countries_iso2_idx on public.countries (iso2);

-- Check: teeno column bhare hain?
--   select code, iso2, name, currency, currency_symbol from public.countries
--   where iso2 in ('IN','US','AE','GB') order by name;
`;
fs.writeFileSync(path.join(__dirname, "add-country-currency.sql"), sql, "utf8");

console.log(`countries: ${data.length}`);
console.log("wrote: supabase/countries-currency.csv");
console.log("wrote: supabase/add-country-currency.sql");
