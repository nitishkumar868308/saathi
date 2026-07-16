-- Apka Saathi — welcome email tracking.
-- Supabase SQL Editor me Run karo. (Dobara run safe.)
--
-- Web `/api/welcome` naye user ko ek hi baar welcome email bhejta hai — ye
-- column batata hai kis ko bhej chuke. NULL = abhi tak nahi bheja.

alter table public.profiles add column if not exists welcomed_at timestamptz;
