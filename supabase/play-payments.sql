-- ============================================================================
-- Play Billing / RevenueCat — har payment ka poora record
--
-- Supabase SQL Editor me poori file Run karo. Dobara chalana safe hai.
-- Pehle chal chuki honi chahiye: plans.sql, profiles.sql
-- ============================================================================
--
-- ⚠️ Ab tak payment ka KOI record nahi banta tha.
--
-- `payments` table `plans.sql` me Razorpay ke zamane ki hai aur uske column
-- abhi bhi `razorpay_*` naam ke hain. Razorpay hata diya gaya (Play Store ki
-- policy — dekho web/lib/play-billing.ts), aur naya raasta RevenueCat ka webhook
-- hai. Par wo webhook sirf `profiles.plan` badalta tha aur aage badh jaata tha:
--
--   • kisne, kab, kitna diya — kahin likha hi nahi jaata tha
--   • refund/cancel ka koi nishaan nahi
--   • "is mahine kitni kamai hui" ka jawab sirf Play Console me tha
--   • aur sabse bura: koi user kahe "maine paisa diya, Plus nahi mila" to
--     hamare paas dekhne ko kuch bhi nahi hota tha
--
-- Ye file wahi record banati hai — aur JAAN-BOOJH KE Play Console live hone se
-- PEHLE. Live hone par bas `PLAY_BILLING_ENABLED=1` aur webhook secret daalna
-- hai; DB, API aur admin screen us din se pehle hi taiyaar rahenge, aur pehli
-- hi kharidari poori tarah darj hogi. Ulta karne par (pehle live, phir record)
-- shuruati din — jo sabse zyada dekhne laayak hote hain — hamesha ke liye khaali
-- reh jaate.

/* ------------------------------------------------------------------ */
/* 1. payments — naye column                                           */
/* ------------------------------------------------------------------ */
--
-- Table wahi purani rehne di hai (usme purani rows padi ho sakti hain). Naye
-- column jud rahe hain; `razorpay_order_id` ab bhi hai par naye raaste me use
-- nahi hota — uski jagah `transaction_id` hai.

alter table public.payments
  -- RevenueCat ka event type: INITIAL_PURCHASE / RENEWAL / EXPIRATION / REFUND…
  add column if not exists event_type text,
  -- Har event ka apna id. DUPLICATE ROKNE KA ASLI TAALA yahi hai (neeche index).
  add column if not exists event_id text,
  -- Store ka transaction id (Play ka orderId). Refund dhoondhne me yahi kaam aata hai.
  add column if not exists transaction_id text,
  -- Pehli kharidari ka transaction — renewal chain isse ek saath judti hai.
  add column if not exists original_transaction_id text,
  -- Play ka product id — 'plus_monthly' / 'plus_yearly'.
  add column if not exists product_id text,
  -- 'PLAY_STORE' | 'APP_STORE' | 'PROMOTIONAL'…
  add column if not exists store text,
  -- ⚠️ `amount` (int, paise) purani Razorpay wali hai. RevenueCat decimal me
  -- deta hai (₹99.00, $1.99) aur currency har user ki apni hoti hai, isliye
  -- naya column alag hai — purane data ka matlab badalna sabse chupa hua bug
  -- banata hai.
  add column if not exists amount_decimal numeric(12, 4),
  add column if not exists currency text,
  -- 'NORMAL' | 'TRIAL' | 'INTRO' | 'PROMOTIONAL' — trial ko kamai me ginna
  -- sabse aam galti hai, isliye ye alag se dikhna chahiye.
  add column if not exists period_type text,
  -- 'PRODUCTION' | 'SANDBOX'. ⚠️ Iske bina test kharidari asli kamai me gin
  -- jaati hai. Admin screen ise alag se chhaanti hai.
  add column if not exists environment text,
  -- Subscription kab tak (event ke hisaab se).
  add column if not exists expires_at timestamptz,
  -- Event ka apna waqt (jab store par hua) — `created_at` se alag, jo "hamne kab
  -- likha" batata hai. Der se aaya webhook dono ko alag kar deta hai.
  add column if not exists event_at timestamptz,
  -- Poora kaccha payload. ⚠️ Ye jaan-boojh ke rakha hai: RevenueCat naye field
  -- jodta rehta hai, aur jis din kisi sawaal ka jawab hamare column me nahi
  -- hoga us din yahi ek row bacha legi. Bina iske purane events dobara nahi
  -- aate — webhook ek hi baar bhejta hai.
  add column if not exists raw jsonb;

/* ------------------------------------------------------------------ */
/* 2. Duplicate se bachao                                              */
/* ------------------------------------------------------------------ */
--
-- ⚠️ Ye index is poori file ka sabse zaroori hissa hai.
--
-- RevenueCat webhook ko "at least once" bhejta hai: agar hamara jawab 500 aaya,
-- der se aaya, ya Vercel ne function ko beech me maar diya, to wahi event dobara
-- aata hai — aur wo bilkul theek hai (usi wajah se paisa lene ke baad plan na
-- milne wali soorat nahi banti). Par uska matlab ye bhi hai ki bina taale ke ek
-- hi kharidari do-teen baar row banati, aur "kitni kamai hui" ka jawab hamesha
-- bada dikhta.
--
-- `event_id` har event ka apna hota hai, isliye taala usi par. Purani (Razorpay
-- wali) rows me `event_id` null hai — `where event_id is not null` unhe chhod
-- deta hai, kyunki Postgres me null kabhi barabar nahi hota aur unique index
-- unpar bekaar hi lagta.
create unique index if not exists payments_event_id_uidx
  on public.payments (event_id)
  where event_id is not null;

create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
create index if not exists payments_created_idx on public.payments (created_at desc);
create index if not exists payments_txn_idx on public.payments (transaction_id);

-- RLS pehle se on hai aur koi policy nahi — yaani ye table sirf service_role
-- chhoo sakta hai. Ye theek hai aur aise hi rehna chahiye: payment ka record
-- app ko dikhana zaroori nahi (app apna plan `profiles` se padhti hai), aur ek
-- user ko doosre ka payment kabhi nahi dikhna chahiye.
alter table public.payments enable row level security;

/* ------------------------------------------------------------------ */
/* 3. admin_payments — admin screen ka data                            */
/* ------------------------------------------------------------------ */
--
-- Rows + upar ke totals, ek hi call me. Do alag call ka matlab hota ek chhota
-- sa pal jisme list aa chuki hai par totals nahi — aur us pal me screen "0
-- kamai" jaisi dikhti hai.
--
-- ⚠️ Totals list ke `limit` se NAHI bante. Ye farak maayne rakhta hai: list par
-- 500 ki chhat hai (screen utna hi dikha sakti hai), par "is mahine kitni kamai"
-- poore range par ginni chahiye. Limit ke andar ginne par har badhte mahine ke
-- saath total chupchaap ghatta jaata — aur wo galti kabhi dikhti nahi.
create or replace function public.admin_payments(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit int default 500
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select p.*
      from public.payments p
     where (p_from is null or coalesce(p.event_at, p.created_at) >= p_from)
       and (p_to   is null or coalesce(p.event_at, p.created_at) <  p_to)
  ),
  -- Kamai sirf UNHI events se jo sach me paisa laate hain. Trial, refund aur
  -- sandbox teenon bahar — inhe jodna wo aam galti hai jisse dashboard ka number
  -- hamesha asli se bada dikhta hai.
  earning as (
    select *
      from scoped
     where coalesce(environment, 'PRODUCTION') = 'PRODUCTION'
       and coalesce(period_type, 'NORMAL') = 'NORMAL'
       and coalesce(amount_decimal, 0) > 0
       and coalesce(event_type, '') not in ('REFUND', 'EXPIRATION', 'CANCELLATION')
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(r order by r->>'at' desc)
        from (
          select jsonb_build_object(
            'id',            s.id,
            'userId',        s.user_id,
            'email',         pr.email,
            'name',          pr.full_name,
            'eventType',     s.event_type,
            'productId',     s.product_id,
            'store',         s.store,
            'transactionId', s.transaction_id,
            'amount',        s.amount_decimal,
            'currency',      s.currency,
            'periodType',    s.period_type,
            'environment',   s.environment,
            'status',        s.status,
            'expiresAt',     s.expires_at,
            'at',            coalesce(s.event_at, s.created_at)
          ) as r
            from scoped s
            left join public.profiles pr on pr.id = s.user_id
           order by coalesce(s.event_at, s.created_at) desc
           limit greatest(1, least(coalesce(p_limit, 500), 2000))
        ) t
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'events',   (select count(*) from scoped),
      'payers',   (select count(distinct user_id) from earning where user_id is not null),
      'refunds',  (select count(*) from scoped where event_type = 'REFUND'),
      'trials',   (select count(*) from scoped where period_type in ('TRIAL', 'INTRO')),
      'sandbox',  (select count(*) from scoped where environment = 'SANDBOX'),
      -- ⚠️ Currency ke hisaab se alag-alag. Ek hi number me jodna jhooth hoga —
      -- ₹99 aur $99 ko jodne ka koi matlab nahi hai, aur app har desh me chalti
      -- hai. Screen inhe alag-alag dikhati hai.
      'revenue',  coalesce((
        select jsonb_object_agg(currency, total)
          from (
            select coalesce(currency, '?') as currency, sum(amount_decimal) as total
              from earning
             group by 1
          ) g
      ), '{}'::jsonb)
    )
  );
$$;

revoke all on function public.admin_payments(timestamptz, timestamptz, int)
  from public, anon, authenticated;
-- Sirf service_role — yaani sirf `/api/admin/payments`, jo apne `guard()` ke
-- peeche hai. App ko ye kabhi nahi milna chahiye.
