-- Waitlist poori tarah hatao.
--
-- ⚠️ YE DATA HAMESHA KE LIYE MITA DETA HAI. Undo nahi hota.
-- Code se waitlist already hat chuki hai; ye sirf DB saaf karta hai.

-- STEP 1 — pehle ye chalao aur count dekho. 0 ho tabhi aage badho.
select count(*) as waitlist_rows from public.waitlist;

-- STEP 2 — count 0 confirm karne ke baad ye chalao:
--
-- drop function if exists public.claim_waitlist_reward();
-- drop table if exists public.waitlist;
--
-- (Upar ki do lines ka `--` hata do, phir Run karo.)

-- Note: `profiles.plan_source` me kisi purane user ka 'waitlist_reward' likha
-- ho sakta hai — woh sirf ek label hai, kuch todta nahi.
