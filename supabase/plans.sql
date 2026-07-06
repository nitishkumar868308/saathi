-- Saathi — Plans, payments & waitlist reward
-- Supabase SQL Editor mein Run karo. (Dobara run safe hai.)
-- NOTE: pehle landing.sql run kar lena (waitlist table chahiye).

-- 1. Profiles mein plan columns
alter table public.profiles add column if not exists plan text not null default 'free';        -- 'free' | 'plus'
alter table public.profiles add column if not exists plan_expires_at timestamptz;
alter table public.profiles add column if not exists plan_source text;                          -- 'waitlist_reward' | 'razorpay' | null

-- 2. Payments (Razorpay transactions record)
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  plan text,
  amount int,                      -- paise (GST inclusive)
  razorpay_order_id text,
  razorpay_payment_id text,
  status text not null default 'created',   -- 'created' | 'paid' | 'failed'
  created_at timestamptz not null default now()
);
alter table public.payments enable row level security;
-- Sirf server (service_role) access — koi public policy nahi.

-- 3. Waitlist reward: pehle 1000 waitlist users ko 1 saal Saathi Plus free.
--    App login ke baad ye RPC call karega. security definer se locked waitlist
--    table bhi read ho jaata hai. Ek hi baar grant hota hai.
create or replace function public.claim_waitlist_reward()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  uemail text;
  urank int;
begin
  select email into uemail from public.profiles where id = auth.uid();
  if uemail is null then return 'no_email'; end if;

  select rnk into urank from (
    select lower(email) as email, row_number() over (order by created_at asc) as rnk
    from public.waitlist
  ) t where t.email = lower(uemail);

  if urank is null then return 'not_in_waitlist'; end if;
  if urank > 1000 then return 'not_eligible'; end if;

  update public.profiles
    set plan = 'plus',
        plan_expires_at = greatest(coalesce(plan_expires_at, now()), now()) + interval '1 year',
        plan_source = 'waitlist_reward'
  where id = auth.uid()
    and coalesce(plan_source, '') <> 'waitlist_reward';

  return 'granted';
end;
$$;

grant execute on function public.claim_waitlist_reward() to authenticated;
