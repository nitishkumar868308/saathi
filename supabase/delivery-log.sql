-- ============================================================================
-- Apka Saathi — "kis kaam ke liye kya-kya gaya, aur user ne dekha ya nahi"
--
-- Supabase SQL Editor me poori file Run karo. Dobara chalana safe hai.
-- Pehle chal chuki honi chahiye: schema.sql, profiles.sql, reminders-notify.sql,
-- document-renewal.sql, aur plan-limits.sql
--
-- ⚠️ `plan-limits.sql` chhod dena sabse aasan galti hai aur wo YAHIN par dikh
--    jaati hai: `log_notification()` uske `is_plus_active()` ko bulaata hai.
--    Uske bina ye file chalegi hi nahi.
-- ============================================================================
--
-- ── Ye kyun bana ───────────────────────────────────────────────────────────
--
-- Sawaal seedha tha: "ek reminder ke liye user tak kya-kya pahuncha?" Free wale
-- ko sirf phone ki notification jaati hai; Plus wale ko email + WhatsApp bhi.
-- Admin ko wahi ek jagah dikhna chahiye.
--
-- ⚠️ Aur uska jawab kahin tha hi nahi. Jo teen cheezein maujood thi, unme se ek
-- bhi ye nahi bataati:
--
--   • `document_notify_log` — sirf DEDUPE hai. Kaamyabi par ek nishaan, bas.
--     Na user, na status, na wajah. Aur sirf documents ke liye.
--   • `reminders.notified_at` — ek hi timestamp. Kaun se raaste par gaya, kya
--     ruka, kyun ruka — kuch nahi.
--   • `delivery-log.ts` (Logs page) — sirf RUKI hui delivery likhta hai, aur
--     jaan-boojh ke BINA user-id ke (taaki ek jaisi lines group ho kar ek row
--     banein). Kaamyabi ka kahin koi record hi nahi tha, aur "Free plan isliye
--     nahi gaya" to sirf ek ginti thi — kisi user ka naam uske saath nahi.
--
-- Isliye ek hi table, ek hi sach: har (kaam, moment, raasta) par ek row.

/* ------------------------------------------------------------------ */
/* 1. Table                                                            */
/* ------------------------------------------------------------------ */

create table if not exists public.delivery_log (
  id uuid primary key default gen_random_uuid(),
  -- 'reminder' | 'document'
  kind text not null,
  -- Us reminder/document ki id.
  item_id uuid not null,
  /**
   * User delete ho jaye to row rehne dena hai (ginti sahi rahe), isliye
   * `set null` — wahi soch jo `message_sends` par hai.
   */
  user_id uuid references auth.users (id) on delete set null,
  /**
   * Kis MOMENT ki khabar.
   *
   * ⚠️ Ye row ki pehchaan ka hissa hai, sirf tafseel nahi. Ek hi document ke
   * teen alag alert hote hain (7 din pehle, 1 din pehle, us din) aur ek roz wala
   * reminder har roz bajta hai. Bina iske wo sab ek hi row par gir jaate aur
   * itihaas ki jagah sirf aakhri baar bachta.
   */
  due_at timestamptz not null,
  -- 'notification' | 'email' | 'whatsapp'
  channel text not null,
  -- 'sent' | 'skipped' | 'failed'
  status text not null,
  /**
   * Kyun ruka. `delivery-log.ts` ke `DeliveryReason` se BILKUL milta hai —
   * dono jagah ek hi shabdawali honi chahiye, warna admin panel do alag bhasha
   * bolne lagta hai. Plus me ek naya hai: 'free_plan'.
   */
  reason text,
  /**
   * Us WAQT ka plan — 'free' ya 'plus'.
   *
   * ⚠️ Ye yahan likha jaata hai, `profiles` se jod kar nahi nikaala jaata. User
   * baad me Plus le lega, aur tab purani rows dekh kar lagta ki "Plus hone par
   * bhi email nahi gaya" — jabki us din wo Free tha. Itihaas ko aaj ke sach se
   * padhna sabse aam galti hai.
   */
  plan text not null default 'free',
  /**
   * User ne ise sach me dekha/khola.
   *
   * ⚠️ "Bhej diya" aur "dekh liya" do alag baatein hain, aur unhe ek dikhana
   * admin panel ko jhootha bana deta hai. Notification par ye sabse saaf hai:
   * app ka full-screen alert dikhna hi saboot hai ki wo baji aur user ke saamne
   * aayi.
   */
  seen_at timestamptz,
  -- Twilio/SMTP ka apna jawab, ya koi aur tafseel.
  detail text,
  created_at timestamptz not null default now(),
  /**
   * Ek (kaam, moment, raasta) par ek hi row.
   *
   * ⚠️ Cron har minute chalta hai aur app ek hi alert dobara dikha sakti hai
   * (screen ghooma, app dobara khuli). Bina is shart ke ek hi khabar ki das rows
   * ban jaati aur ginti poori tarah jhooth ho jaati.
   */
  unique (kind, item_id, due_at, channel)
);

alter table public.delivery_log enable row level security;
-- Koi client policy nahi — cron (service_role) likhta hai, aur app apne liye
-- neeche wale function se. Ek user doosre ka record na padh sake, na likh sake.

/** Admin ka sabse aam sawaal: "is user ko pichhle dinon me kya-kya gaya?" */
create index if not exists delivery_log_user_idx
  on public.delivery_log (user_id, created_at desc);

/** Ek hi document/reminder ka poora itihaas. */
create index if not exists delivery_log_item_idx
  on public.delivery_log (kind, item_id, due_at desc);

/* ------------------------------------------------------------------ */
/* 2. Cron / server ke liye — ek row likho ya sudhaaro                 */
/* ------------------------------------------------------------------ */
--
-- `on conflict` par UPDATE hota hai, ignore nahi. Wajah: pehli koshish par
-- "failed" likha ja sakta hai aur agli baar wo "sent" ho jaata hai. Ignore
-- karne par row hamesha ke liye "failed" par atki rehti — yaani admin panel us
-- user ko dikhata rehta jiski dikkat kab ki theek ho chuki hai.
--
-- ⚠️ `seen_at` yahan JAAN-BOOJH KE nahi chhua jaata. Wo user ki baat hai, bhejne
-- wale ki nahi; dobara bhejna use kabhi mitana nahi chahiye.
create or replace function public.log_delivery(
  p_kind    text,
  p_item_id uuid,
  p_user_id uuid,
  p_due_at  timestamptz,
  p_channel text,
  p_status  text,
  p_reason  text default null,
  p_plan    text default 'free',
  p_detail  text default null
)
returns void language sql security definer set search_path = public as $$
  insert into public.delivery_log
    (kind, item_id, user_id, due_at, channel, status, reason, plan, detail)
  values
    (p_kind, p_item_id, p_user_id, p_due_at, p_channel, p_status, p_reason,
     p_plan, left(p_detail, 500))
  on conflict (kind, item_id, due_at, channel) do update
    set status  = excluded.status,
        reason  = excluded.reason,
        plan    = excluded.plan,
        detail  = excluded.detail,
        user_id = coalesce(excluded.user_id, public.delivery_log.user_id);
$$;

revoke all on function public.log_delivery(text, uuid, uuid, timestamptz, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.log_delivery(text, uuid, uuid, timestamptz, text, text, text, text, text) to service_role;

/* ------------------------------------------------------------------ */
/* 2b. Kai rows ek hi call me                                          */
/* ------------------------------------------------------------------ */
--
-- ⚠️ Ye sirf safai nahi hai — iske bina cron ka kat jaana pakka tha.
--
-- `send-reminders` ek baar me 50 reminder uthata hai, aur har ek par do
-- raaste likhne hote hain. Ek-ek karke bhejne par wo 100 seedhi network call
-- ban jaati hain, ek ke baad ek. Us cron ke paas Vercel par sirf kuch second
-- hote hain — aur agar wo kat gaya to sirf ye record hi nahi, REMINDER bhejna
-- bhi ruk jaata. Khabar rakhne ki koshish khabar bhejne ko kabhi nahi maar
-- sakti.
--
-- Ab poora run ek hi call me nipat-ta hai.
create or replace function public.log_delivery_batch(p_rows jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.delivery_log
    (kind, item_id, user_id, due_at, channel, status, reason, plan, detail)
  select
    r->>'kind',
    (r->>'item_id')::uuid,
    nullif(r->>'user_id', '')::uuid,
    (r->>'due_at')::timestamptz,
    r->>'channel',
    r->>'status',
    r->>'reason',
    coalesce(r->>'plan', 'free'),
    left(r->>'detail', 500)
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r
  on conflict (kind, item_id, due_at, channel) do update
    set status  = excluded.status,
        reason  = excluded.reason,
        plan    = excluded.plan,
        detail  = excluded.detail,
        user_id = coalesce(excluded.user_id, public.delivery_log.user_id);
$$;
--
-- ⚠️ Ek hi call me ek (kaam, moment, raasta) DO baar mat bhejna. Postgres us
--    par "ON CONFLICT DO UPDATE command cannot affect row a second time"
--    phenk deta hai aur POORA batch gir jaata hai. Caller isi wajah se bhejne
--    se pehle chhaan leta hai (`lib/delivery-record.ts`).

revoke all on function public.log_delivery_batch(jsonb) from public, anon, authenticated;
grant execute on function public.log_delivery_batch(jsonb) to service_role;

/* ------------------------------------------------------------------ */
/* 3. App ke liye — notification ka sach                               */
/* ------------------------------------------------------------------ */
--
-- ⚠️ Notification ka record SERVER nahi bana sakta, aur yahi is poore hisse ki
-- sabse zaroori baat hai. Reminder/expiry ki notification app KHUD phone par
-- local schedule karti hai; server ne wo bheji hi nahi hoti. Admin me use "gaya
-- ✅" likh dena andaza hota, sach nahi.
--
-- Sach sirf app ke paas hai, aur wo bhi sabse pakke roop me: full-screen alert
-- ka DIKHNA hi saboot hai ki notification baji aur user ke saamne aayi.
--
-- `p_seen` = user ne uspar kuch dabaya (OK / ho gaya). Wo sirf aage badhta hai —
-- ek baar dekh liya, to dobara alert dikhne par wo mit-ta nahi.
create or replace function public.log_notification(
  p_kind    text,
  p_item_id uuid,
  p_due_at  timestamptz,
  p_seen    boolean default false
)
returns void language sql security definer set search_path = public as $$
  insert into public.delivery_log
    (kind, item_id, user_id, due_at, channel, status, plan, seen_at)
  values
    (p_kind, p_item_id, auth.uid(), p_due_at, 'notification', 'sent',
     case when public.is_plus_active(auth.uid()) then 'plus' else 'free' end,
     case when p_seen then now() else null end)
  on conflict (kind, item_id, due_at, channel) do update
    -- ⚠️ `coalesce` — pehli baar ka waqt hi sach hai. Alert dobara dikhne par
    -- use aage sarkaana "user ne abhi dekha" ka jhooth banata hai.
    set seen_at = coalesce(public.delivery_log.seen_at,
                           case when p_seen then now() else null end);
$$;

revoke all on function public.log_notification(text, uuid, timestamptz, boolean) from public, anon;
grant execute on function public.log_notification(text, uuid, timestamptz, boolean) to authenticated, service_role;

/* ------------------------------------------------------------------ */
/* 4. Admin — ek user ka poora itihaas                                 */
/* ------------------------------------------------------------------ */
--
-- Ek row = ek (kaam, moment). Teenon raaste usi row ke andar aate hain, taaki
-- admin panel ko har item ke liye alag se jodna na pade — wahi jod galat karne
-- ki sabse aam jagah hoti hai.
create or replace function public.admin_delivery_log(
  p_user_id uuid,
  p_limit   int default 60
)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(row_to_json(x) order by x.due_at desc), '[]'::jsonb)
  from (
    select
      l.kind,
      l.item_id,
      l.due_at,
      max(l.plan) as plan,
      /**
       * Kaam ka naam — reminder ka title, document ka naam.
       *
       * ⚠️ `left join` hi hona chahiye. User apna reminder delete kar sakta hai,
       * par uska itihaas rehna chahiye: "us din khabar gayi thi ya nahi" ka
       * jawab document ke mit jaane se badalta nahi.
       */
      coalesce(max(r.title), max(d.name)) as item_name,
      jsonb_object_agg(
        l.channel,
        jsonb_build_object(
          'status',  l.status,
          'reason',  l.reason,
          'seen_at', l.seen_at,
          'detail',  l.detail
        )
      ) as channels
    from public.delivery_log l
    left join public.reminders r on l.kind = 'reminder' and r.id = l.item_id
    left join public.documents d on l.kind = 'document' and d.id = l.item_id
    where l.user_id = p_user_id
    group by l.kind, l.item_id, l.due_at
    order by l.due_at desc
    limit greatest(p_limit, 1)
  ) x;
$$;

revoke all on function public.admin_delivery_log(uuid, int) from public, anon, authenticated;
grant execute on function public.admin_delivery_log(uuid, int) to service_role;

/* ------------------------------------------------------------------ */
/* 5. Safai — 90 din se purana                                         */
/* ------------------------------------------------------------------ */
--
-- ⚠️ Ye shuru se hi zaroori hai, baad ki baat nahi. Ek hazaar user × teen
-- reminder × teen raaste = ~9,000 rows ROZ. Supabase ka free tier 500MB hai,
-- aur bina safai ke ye table use akele hi kha jaata — aur tab tak pata bhi nahi
-- chalta jab tak poora database likhna band na kar de.
--
-- 90 din jaan-boojh ke: "pichhle mahine kitni baar gaya" wale sawaal ka jawab
-- isme aa jaata hai, aur usse purana koi poochhta hi nahi.
create or replace function public.prune_delivery_log()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.delivery_log where created_at < now() - interval '90 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.prune_delivery_log() from public, anon, authenticated;
grant execute on function public.prune_delivery_log() to service_role;

-- Roz raat 3:20 (UTC) — koi bhi kam-bheed wala waqt chalega.
-- ⚠️ Purani job hatao — par SIRF tab jab wo sach me ho.
--
-- `select cron.unschedule('naam')` seedha likhna yahan galat hai: job na hone par
-- wo "could not find valid entry for job" phenkta hai, aur Supabase SQL Editor
-- POORI script wahin rok deta hai. Yaani pehli baar chalane wale ke liye ye file
-- kabhi poori chalti hi nahi — theek us waqt jab use sabse zyada chalni chahiye.
--
-- `cron.job` se jodkar chalane par job na hone par zero row aati hai aur kuch
-- nahi hota. Isliye ye file pehli baar aur das-vi baar, dono par ek jaisi chalti
-- hai.
select cron.unschedule(jobid) from cron.job where jobname = 'prune-delivery-log';

select cron.schedule(
  'prune-delivery-log',
  '20 3 * * *',
  $$ select public.prune_delivery_log(); $$
);

-- Band karna ho to:
--   select cron.unschedule('prune-delivery-log');
