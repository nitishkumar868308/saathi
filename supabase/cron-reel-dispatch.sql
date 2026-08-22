-- ═══════════════════════════════════════════════════════════════════════
--  REEL DISPATCH — atki hui render job ka safety net (Phase 25)
-- ═══════════════════════════════════════════════════════════════════════
--
-- Neeche `v_secret` me studio ka CRON_SECRET aur `v_base` me studio ka URL
-- daalo, phir poori file Supabase > SQL Editor me Run kar do.
--
-- Dobara chalana safe hai — job pehle unschedule hoti hai.
--
-- ── Ye ghadi kya karti hai (aur kya NAHI karti) ────────────────────────
--
-- ⚠️ Ye render **shuru nahi karti**. Asli raasta iske bina hi chalta hai: user
-- Export dabata hai → studio job DB me daalti hai → usi lamhe GitHub ko
-- `repository_dispatch` bhej deti hai → runner uth jaata hai. Turant, bina kisi
-- ghadi ke.
--
-- Ye us halat ke liye hai jab wo phone **nahi ja saka**: GitHub us lamhe down
-- tha, PAT expire ho gaya tha, ya job `reel_requeue_stale_jobs` se wapas queue
-- me aayi (runner beech me mar gaya) — us waqt koi Export dab hi nahi raha,
-- isliye jagane wala koi nahi hota.
--
-- In sab me job queue me **hamesha ke liye** padi rehti hai aur kahin koi error
-- nahi dikhta, kyunki galti kisi se hui hi nahi. Bas ghanti bajane wala koi nahi
-- tha.
--
-- ── 15 minute kyun, 1 minute kyun nahi ─────────────────────────────────
--
-- ⚠️ Reminder wali cron har minute chalti hai kyunki wahan der = "reminder late
-- aaya". Yahan wo hisaab ulta hai: normal export pehle hi turant dispatch ho
-- chuka hota hai, isliye ye ghadi sirf tab kaam karti hai jab kuch toota ho.
--
-- Aur iska ek kharcha hai jo dikhta nahi: private repo par GitHub Actions ke
-- 2000 minute/month hain, aur har runner ~1 minute leta hai chahe kaam kuch na
-- ho. Route khud jaanch kar hi dispatch bhejta hai (queue khaali ho ya worker
-- pehle se chal raha ho to nahi bhejta), isliye khaali chakkar sirf ek DB query
-- hai — par ghadi ko phir bhi utna hi tez rakhna chahiye jitni zaroorat hai.
--
-- Chalane ke baad jaanch (jawab me `queued` aur `dispatched` dikhega):
--   curl -H "Authorization: Bearer <CRON_SECRET>" \
--        https://<studio-domain>/api/cron/reel-dispatch

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $setup$
declare
  -- ⚠️⚠️⚠️ Studio ke Vercel project ka CRON_SECRET (Settings > Environment
  -- Variables me jo hai, HUBAHU wahi — aage-peeche space bhi nahi).
  v_secret text := '<CRON_SECRET>';

  /**
   * Studio ka apna domain — aur yahan `www` MAT lagana.
   *
   * ⚠️ Ye wahi chhupi hui galti hai jo `cron-setup.sql` me poori likhi hai, aur
   * wo bilkul "galat secret" jaisi dikhti hai: redirect par curl doosre HOST par
   * jaate waqt `Authorization` header jaan-boojh ke gira deta hai (surakhsha ka
   * niyam), aur pg_net curl par chalta hai. Nateeja — route chalta hai, 401 deta
   * hai, aur secret DONO jagah bilkul sahi hota hai.
   *
   * Vercel > Settings > Domains me dekh lo ki studio ka "Production" domain kya
   * hai — wahi yahan aana chahiye, redirect wala nahi.
   *
   * ⚠️ Ye web wala domain (apkasaathi.com) NAHI hai. Studio alag deploy hai.
   */
  v_base text := 'https://<studio-domain>';
begin
  if v_secret = '<CRON_SECRET>' or length(trim(v_secret)) = 0 then
    raise exception
      'CRON_SECRET daalna bhool gaye. File ke upar v_secret me studio wali asli value daalo, phir dobara Run karo.';
  end if;

  if v_base like '%<studio-domain>%' then
    raise exception
      'v_base me studio ka asli domain daalo (https://... , bina www, bina aakhri slash).';
  end if;

  -- Purani job hatao — naam se aur URL se dono, taaki do ek jaisi jobs saath
  -- na chal padein (dono apne-apne, aksar alag, secret ke saath).
  perform cron.unschedule(jobname)
     from cron.job
    where jobname = 'reel-dispatch-15-min'
       or command like '%/api/cron/reel-dispatch%';

  perform cron.schedule(
    'reel-dispatch-15-min',
    '*/15 * * * *',
    format(
      $job$select net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$job$,
      -- ⚠️ rtrim jaan-boojhkar hai. Domain copy karne par aakhri slash saath aa
      -- jaana bilkul aam hai, aur bina iske URL me `//api/...` ban jaata tha.
      -- Wo Vercel par abhi redirect ho kar chal to jaata hai, par wo kismat hai
      -- niyam nahi — aur redirect par curl doosre host par Authorization header
      -- gira deta hai. Ek jagah aisa hua to wahi purana "401 aur secret dono
      -- taraf sahi" wala chakkar shuru ho jaata.
      rtrim(v_base, '/') || '/api/cron/reel-dispatch',
      jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      )
    )
  );

  raise notice 'reel-dispatch-15-min lag gayi → %/api/cron/reel-dispatch', rtrim(v_base, '/');
end
$setup$;

-- Jaanch: job bani ya nahi.
select jobname, schedule, active from cron.job where jobname = 'reel-dispatch-15-min';
