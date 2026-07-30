-- Push notification ke liye har phone ka pata (item 8).
--
-- Ab tak app me jo notification aati thi wo sab LOCAL thi: reminder banate waqt
-- phone ke andar hi alarm set ho jaata tha (notifee). Isme koi server nahi tha —
-- isliye ye bina internet ke bhi bajti hai, par isi wajah se admin panel se kuch
-- bhej bhi nahi sakte the. Admin sirf email bhej paata tha.
--
-- Push (FCM) ke liye server ko har device ka "pata" chahiye — wahi token yahan
-- rakha jaata hai.

create table if not exists public.device_tokens (
  -- Token khud hi primary key hai. Ek user ke kai phone ho sakte hain, aur ek
  -- phone par (app dobara install karne par) naya token aa jaata hai — dono
  -- soorat me alag row honi chahiye.
  token      text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  platform   text,
  -- Kab aakhri baar dikha. Purane/mare hue token isi se saaf hote hain.
  updated_at timestamptz not null default now()
);

alter table public.device_tokens enable row level security;

-- User sirf apne device ka token daal/badal sakta hai. Doosre ka token padhna
-- ya likhna dono band — warna koi bhi kisi ke phone par notification bhej deta.
drop policy if exists "apna device token" on public.device_tokens;
create policy "apna device token" on public.device_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Admin broadcast "in users ko bhejo" poochta hai — user_id par lookup.
create index if not exists device_tokens_user_idx
  on public.device_tokens (user_id);

/* ------------------------------------------------------------------ */
/*  Token upsert                                                       */
/* ------------------------------------------------------------------ */

-- App har baar khulne par token bhejti hai. Seedha upsert isliye nahi ki ek
-- phone ka token DOOSRE user ke naam par bhi ho sakta hai (ek hi phone par pehle
-- koi aur login tha). Aise me row ka maalik badal dena zaroori hai — warna
-- purane user ko naye user ke phone par notification chali jaati.
create or replace function public.save_device_token(p_token text, p_platform text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.device_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id    = auth.uid(),
        platform   = excluded.platform,
        updated_at = now();
$$;

revoke all on function public.save_device_token(text, text) from public, anon;
grant execute on function public.save_device_token(text, text) to authenticated;

/* ------------------------------------------------------------------ */
/*  Mara hua token hatao                                               */
/* ------------------------------------------------------------------ */

-- FCM "UNREGISTERED" lautaye (app uninstall ho gayi, ya token expire) to us
-- token ko rakhna bekaar hai — har broadcast me wo ek fail ginta rahega aur
-- list dheere-dheere kachre se bhar jaati hai.
--
-- service_role only: ye sirf server (admin broadcast) ke kaam ki hai.
create or replace function public.delete_device_tokens(p_tokens text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.device_tokens where token = any(p_tokens);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.delete_device_tokens(text[]) from public, anon, authenticated;
grant execute on function public.delete_device_tokens(text[]) to service_role;
