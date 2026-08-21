-- AI Reel Studio — TTS cache ke liye ek column.
-- Supabase SQL Editor me Run karo. (Dobara run karna safe hai — sab idempotent hai.)
--
-- `supabase/reel-studio.sql` pehle chal chuki honi chahiye.


/* ------------------------------------------------------------------ */
/*  cache_key — "ye awaaz pehle ban chuki hai?"                        */
/* ------------------------------------------------------------------ */
--
-- Gemini TTS har call ka paisa leta hai. Reel banate waqt ek hi scene ka text
-- 10 baar preview hota hai aur usme se 9 baar text bilkul wahi hota hai —
-- yaani 9 call bekaar ke. Isliye har generate ki hui awaaz ke saath uski
-- **maang ka hash** likh dete hain: provider + voice + text + rate + pitch.
-- Agli baar wahi maang aaye to DB se wahi asset utha lete hain aur API ko
-- chhoote hi nahi.
--
-- ⚠️ **Ye `checksum` se alag column kyun?**
--
-- `checksum` file ke **bytes** ka sha256 hai — usi se upload ka duplicate pakda
-- jaata hai (5.7). `cache_key` file ke bytes ka nahi, us **maang** ka hash hai
-- jisse wo file bani. Do bilkul alag cheezein hain.
--
-- Ek hi column me dono daalne ka mann karta hai (index pehle se hai, kaam kam
-- hai), par tab ek din ye sawaal aata hai: "is row me jo hash hai wo file ka
-- hai ya request ka?" — aur uska jawab kahin likha nahi hota. Us uljhan ki
-- keemat is ek column se bahut zyada hai.
--
-- (Takraav se bachne ke liye `ttsCacheKey()` hash se pehle ek namespace bhi
-- lagata hai, `reel-tts:v1` — par wo alag bachav hai, iski jagah nahi.)

alter table public.reel_assets
  add column if not exists cache_key text;

comment on column public.reel_assets.cache_key is
  'TTS ki maang ka hash (provider+voice+text+rate+pitch). File ke bytes ka hash `checksum` me hai — dono alag hain.';

-- Lookup hamesha "is key wali koi asset hai?" hota hai, isliye partial index —
-- jin rows me cache_key null hai (yaani saare uploads) wo index me aate hi nahi.
create index if not exists reel_assets_cache_key_idx
  on public.reel_assets (cache_key)
  where cache_key is not null;


/* ------------------------------------------------------------------ */
/*  Sanity — chalane ke baad ye dekh lena                              */
/* ------------------------------------------------------------------ */
--
-- select column_name from information_schema.columns
--   where table_name = 'reel_assets' and column_name = 'cache_key';
-- Umeed: ek row.
--
-- select indexname from pg_indexes
--   where tablename = 'reel_assets' and indexname = 'reel_assets_cache_key_idx';
-- Umeed: ek row.
