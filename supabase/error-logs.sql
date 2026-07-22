-- App/web ke errors ek jagah — admin "Logs" menu + email alert ke liye.
-- Supabase SQL Editor me chalao. Dobara chalana safe hai.

create table if not exists public.app_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  source text not null default 'app',        -- app | web | edge
  level text not null default 'error',       -- error | warn
  message text not null,
  stack text,
  context jsonb,                             -- screen, action, extra
  platform text,                             -- android | ios | web
  app_version text,
  created_at timestamptz not null default now(),
  mailed_at timestamptz                      -- email ja chuka?
);

create index if not exists app_errors_created_idx on public.app_errors (created_at desc);
create index if not exists app_errors_unmailed_idx on public.app_errors (created_at)
  where mailed_at is null;

alter table public.app_errors enable row level security;
-- Koi client policy nahi — likhna sirf RPC se, padhna sirf service_role (admin).

/**
 * App yahan se error bhejti hai. security definer isliye ki RLS ke bawajood
 * insert ho jaye, par user sirf apna hi error daal sake (user_id server set karta hai).
 */
create or replace function public.log_app_error(
  p_message text,
  p_source text default 'app',
  p_level text default 'error',
  p_stack text default null,
  p_context jsonb default null,
  p_platform text default null,
  p_app_version text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.app_errors
    (user_id, source, level, message, stack, context, platform, app_version)
  values
    (auth.uid(), coalesce(p_source,'app'), coalesce(p_level,'error'),
     left(p_message, 2000), left(p_stack, 8000), p_context, p_platform, p_app_version);
$$;

revoke all on function public.log_app_error(text,text,text,text,jsonb,text,text) from public;
grant execute on function public.log_app_error(text,text,text,text,jsonb,text,text)
  to anon, authenticated, service_role;
