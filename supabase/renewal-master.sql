-- Apka Saathi — Renewal MASTER (fields / tags / languages)
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
--
-- ============================================================================
-- Ye migration kya badalti hai
-- ============================================================================
--
-- PEHLE: renewal guide ka dhaancha CODE me tay tha — har guide me sirf
-- `title`, `steps[]`, `note` ho sakte the, aur sirf 3 bhasha (hinglish/hi/en).
-- Naya khaana (jaise "Fees", "Kagaz kya lagenge", "Chetavni") jodne ke liye
-- app + admin + API teeno me code badalna padta tha, aur phir app release.
-- Yaani content team kabhi apne aap kuch naya nahi jod sakti thi.
--
-- AB: dhaancha bhi DATA hai. Admin khud tay karta hai ki ek guide me kaun se
-- khaane honge, kis tarteeb me, kis kism ke — aur app wahi, usi tarteeb me
-- dikhati hai. Naye khaane ke liye ab koi app release nahi chahiye.
--
--   renewal_fields     — kaun se khaane hote hain     (Field master)
--   renewal_tags       — kaun se tag lag sakte hain   (Tag master)
--   renewal_languages  — kaun si bhasha me likha jaa sakta hai (Language master)
--
-- ⚠️ SABSE ZAROORI BAAT — `content` ka shape jaan-boojh ke NAHI badla:
--
--       { "<bhasha>": { "<field key>": <value> } }
--
-- Purana shape { "hinglish": { "title": ..., "steps": [...], "note": ... } }
-- iska HISSA hai — bas `title`/`steps`/`note` ab code me likhe hue naam nahi,
-- balki `renewal_fields` ki teen aam si rows hain. Isliye purana saara content
-- bina chhue chalta rehta hai, aur app ka rendering din-1 se dono samajh leta
-- hai. Agar shape badalte, to migration ke beech app ke paas AADHA content
-- hota — aur wahi ek soorat hai jisme user ko "renew kaise karein" ka jawab
-- bilkul khaali dikhta.

/* ------------------------------------------------------------------ */
/*  1. Language master                                                 */
/* ------------------------------------------------------------------ */

-- ⚠️ Ye SIRF renewal content ki bhasha hai — app ki UI ki bhasha nahi.
-- App ki UI abhi bhi code ke 3 locale par chalti hai (dictionaries.ts).
-- Yahan Tamil jodne ka matlab hai "renewal guide Tamil me likha ja sakta hai",
-- na ki "poori app Tamil ho gayi". Dono ko ek maan lena sabse aam galti hai.
create table if not exists public.renewal_languages (
  -- App ke locale se match karna chahiye jahan match ho sakta ho
  -- (hinglish / hi / en) — warna app us bhasha ka content kabhi nahi uthayegi.
  code       text primary key,
  label      text not null,
  -- "தமிழ்" — apni hi bhasha me naam. Admin dropdown me yahi padha jaata hai.
  native     text,
  sort       int  not null default 100,
  -- Band karna delete se behtar hai: content bacha rehta hai, bas dikhna band.
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);

-- App ka DEFAULT_LOCALE yahi hai. Iska hona zaroori hai — app har us soorat me
-- ispar girti hai jab user ki bhasha ka content nahi bana.
insert into public.renewal_languages (code, label, native, sort) values
  ('hinglish', 'Hinglish', 'Hinglish', 10),
  ('hi',       'Hindi',    'हिंदी',     20),
  ('en',       'English',  'English',  30)
on conflict (code) do nothing;

/* ------------------------------------------------------------------ */
/*  2. Field master — guide ka dhaancha                                */
/* ------------------------------------------------------------------ */

create table if not exists public.renewal_fields (
  -- content JSON ki chaabi. Isliye badalna mana hai (neeche trigger rok lagata
  -- hai) — key badalte hi us khaane me likha SAARA content anaath ho jaata:
  -- JSON me purani chaabi padi rehti aur app nayi chaabi dhoondhti rehti.
  key        text primary key,
  label      text not null,

  /*
   * kind — app ise KAISE dikhaye. Sirf dikhawa nahi, matn ka dhaancha bhi:
   *
   *   text      ek line            → heading jaisa
   *   longtext  paragraph          → seedha padhne wala matn
   *   list      ginti wali soochi   → JSON me string[] , baaki sab me string
   *   link      URL                → app me button banta hai (tap = site khulti)
   *   note      halka highlight box → "dhyan rahe" wali baat
   */
  kind       text not null default 'text'
             check (kind in ('text','longtext','list','link','note')),

  -- App me isi tarteeb se dikhta hai. Chhota number pehle.
  sort       int  not null default 100,
  -- Save ke waqt admin ko roka jaata hai agar ye khaali ho.
  required   boolean not null default false,
  -- Ionicons ka naam (jaise "bulb-outline"). Khaali chhodna theek hai.
  icon       text,
  -- Admin ke liye ek line ki madad — "yahan kya likhna hai".
  hint       text,
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);

/*
 * Wahi teen khaane jo pehle CODE me likhe the.
 *
 * ⚠️ In teen rows ka hona hi wo cheez hai jo purane content ko zinda rakhti
 * hai. Inhe delete karne par purane guides ka title/steps/note JSON me to
 * rahega, par app ko pata hi nahi chalega ki use dikhana hai — screen chup-chaap
 * khaali ho jayegi. Isliye neeche inpar delete ki rok lagi hai.
 */
insert into public.renewal_fields (key, label, kind, sort, required, icon, hint) values
  ('title',     'Title',     'text',     10, true,  null,           'Guide ka naam — sabse upar dikhta hai'),
  ('steps',     'Steps',     'list',     20, true,  null,           'Ek-ek karke kya karna hai'),
  ('note',      'Note',      'note',     30, false, 'bulb-outline', 'Dhyan rakhne wali baat'),
  -- url/authority pehle alag COLUMN the (yaani har bhasha me ek hi). Ab ye bhi
  -- aam khaane hain — kyunki authority ka naam har bhasha me alag hota hai
  -- ("Passport Seva" vs "पासपोर्ट सेवा"), aur column me wo kabhi anuvaad nahi
  -- ho sakta tha.
  ('link',      'Link',      'link',      5, false, 'open-outline', 'Official site ka URL'),
  ('authority', 'Authority', 'text',     15, false, null,           'Kaun jaari karta hai — bharosa isi se aata hai')
on conflict (key) do nothing;

/* ------------------------------------------------------------------ */
/*  3. Tag master                                                      */
/* ------------------------------------------------------------------ */

create table if not exists public.renewal_tags (
  key        text primary key,
  label      text not null,
  -- Hex (#c25a37). App aur admin dono isi rang me chip dikhate hain.
  color      text,
  sort       int  not null default 100,
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);

/* ------------------------------------------------------------------ */
/*  4. Guides table — tags ka khaana                                   */
/* ------------------------------------------------------------------ */

-- ⚠️ Foreign key JAAN-BOOJH KE nahi lagayi. Tag master se koi tag hatane par
-- FK poora guide save hone se rok deti (ya cascade me guide hi uda deti). Tag
-- ek label hai, guide ki jaan nahi — anjaan tag ko app chup-chaap anadekha kar
-- deti hai, aur wahi sahi bartaav hai.
alter table public.document_renewal_guides
  add column if not exists tags text[] not null default '{}';

create index if not exists renewal_guides_tags_idx
  on public.document_renewal_guides using gin (tags);

/* ------------------------------------------------------------------ */
/*  5. Purane column → content ke khaane                               */
/* ------------------------------------------------------------------ */

/*
 * `url` aur `authority` ab `content` ke andar `link`/`authority` khaane hain.
 *
 * Column abhi HATAYE NAHI ja rahe — sirf khaali kar diye jayenge... nahi, wo
 * bhi nahi. Wo jaise hain waise pade rehte hain, taki agar purana app build
 * (jo abhi logon ke phone me hai) unhe padh raha ho to wo chalta rahe.
 * Naya app content me se padhta hai; purana column se. Dono ek saath sach
 * rehte hain jab tak sab log update na kar lein.
 */
update public.document_renewal_guides g
set content = (
  select jsonb_object_agg(
    lang,
    body
      || case when g.url       is not null and not (body ? 'link')
              then jsonb_build_object('link', g.url) else '{}'::jsonb end
      || case when g.authority is not null and not (body ? 'authority')
              then jsonb_build_object('authority', g.authority) else '{}'::jsonb end
  )
  from jsonb_each(g.content) as t(lang, body)
)
where (g.url is not null or g.authority is not null)
  and jsonb_typeof(g.content) = 'object'
  and g.content <> '{}'::jsonb;

/* ------------------------------------------------------------------ */
/*  6. Seed content hatao — "hum khud banayenge"                       */
/* ------------------------------------------------------------------ */

/*
 * ⚠️ Ye wo hissa hai jo DATA MITAATA HAI. Soch samajh ke chalao.
 *
 * Pehle backup banta hai. Galti lage to wapas laane ka raasta:
 *
 *     insert into public.document_renewal_guides
 *     select * from public.document_renewal_guides_backup;
 *
 * Backup sirf TAB banta hai jab wo pehle se na ho — warna dobara run karne par
 * pehla (asli) backup mit jaata, aur wahi ek cheez hai jo wapasi ka raasta band
 * kar deti.
 */
create table if not exists public.document_renewal_guides_backup
  as table public.document_renewal_guides;

/*
 * ⚠️ RLS backup par bhi — aur ye bhoolna aasan hai.
 *
 * `create table ... as table` se bani table par RLS apne aap nahi lagti, aur
 * Supabase me `public` schema ki har table par `anon`/`authenticated` ko default
 * grant milta hai. Yaani bina is line ke ye backup kisi bhi anon key se padha ja
 * sakta tha.
 *
 * Yahan content waise bhi public hai (asli table bhi sabko padhne deti hai),
 * isliye nuksan koi nahi — par RLS ke bina padi table wahi cheez hai jo Supabase
 * ka security linter pakadta hai, aur "ye wala theek hai" wali aadat hi agli
 * baar asli data wali table par bhaari padti hai.
 *
 * Koi policy JAAN-BOOJH KE nahi banayi: backup sirf service_role (SQL editor /
 * admin) ke liye hai, kisi client ke liye nahi.
 */
alter table public.document_renewal_guides_backup enable row level security;

-- Ab table khaali. Naye guides admin panel se banenge.
delete from public.document_renewal_guides;

/* ------------------------------------------------------------------ */
/*  7. Rok — wo teen khaane jo purana content zinda rakhte hain         */
/* ------------------------------------------------------------------ */

/*
 * Do cheezein rokni hain, aur dono ki wajah ek hi hai: JSON ki chaabi.
 *
 *   (a) `key` badalna — us khaane ka saara likha hua content anaath ho jaata
 *       hai. JSON me purani chaabi padi rehti, app nayi dhoondhti.
 *   (b) `title`/`steps` delete karna — app ka poora rendering inhi par tika
 *       hai; inke bina guide card khaali dikhta hai.
 *
 * `note`/`link`/`authority` delete kiye ja sakte hain — wo marzi ke khaane hain.
 */
create or replace function public.renewal_fields_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.key is distinct from old.key then
    raise exception
      'Field ki key badli nahi ja sakti (% → %). Us khaane ka saara content JSON me purani key par pada hai aur anaath ho jayega. Naya field banao aur content copy kar lo.',
      old.key, new.key;
  end if;

  if tg_op = 'DELETE' and old.key in ('title', 'steps') then
    raise exception
      'Field "%" hataya nahi ja sakta — app ka renewal card isi par tika hai. Dikhana band karna ho to enabled = false kar do.',
      old.key;
  end if;

  return case tg_op when 'DELETE' then old else new end;
end;
$$;

drop trigger if exists renewal_fields_guard on public.renewal_fields;
create trigger renewal_fields_guard
  before update or delete on public.renewal_fields
  for each row execute function public.renewal_fields_guard();

/* ------------------------------------------------------------------ */
/*  8. RLS — sab padh sakte hain, likhna sirf admin                     */
/* ------------------------------------------------------------------ */

-- App ko teeno master PADHNE hote hain (dhaancha, tarteeb, rang) — isliye read
-- khula hai, bilkul `document_renewal_guides` ki tarah. Likhna sirf
-- service_role (admin API) se: koi client policy nahi banayi gayi.
alter table public.renewal_fields    enable row level security;
alter table public.renewal_tags      enable row level security;
alter table public.renewal_languages enable row level security;

drop policy if exists "read renewal fields" on public.renewal_fields;
create policy "read renewal fields"
  on public.renewal_fields for select using (true);

drop policy if exists "read renewal tags" on public.renewal_tags;
create policy "read renewal tags"
  on public.renewal_tags for select using (true);

drop policy if exists "read renewal languages" on public.renewal_languages;
create policy "read renewal languages"
  on public.renewal_languages for select using (true);

/* ------------------------------------------------------------------ */
/*  9. Jaanch                                                          */
/* ------------------------------------------------------------------ */

-- Field master bhara hai?
--   select key, label, kind, sort, enabled from public.renewal_fields order by sort;
--
-- Kisi guide me aisa khaana to nahi jo master me hai hi nahi? (App use
-- anadekha kar degi — yaani likha hua kabhi dikhega hi nahi.)
--   select g.doc_type, g.country, k.key
--     from public.document_renewal_guides g,
--          lateral jsonb_each(g.content) as c(lang, body),
--          lateral jsonb_object_keys(body) as k(key)
--    where k.key not in (select key from public.renewal_fields);
