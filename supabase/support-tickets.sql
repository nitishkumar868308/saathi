-- Apka Saathi — Support tickets (app se sawaal, admin se jawab)
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
-- NOTE: pehle profiles.sql chala lena.
--
-- Ab tak app ka "Contact" ek taraf ka darwaza tha: user message bhejta tha, wo
-- email me chala jaata tha, aur bas. User ke paas na koi number hota tha jisse
-- wo poochh sake "mere sawaal ka kya hua", na jawab app me kabhi wapas aata tha.
-- Admin ke paas bhi bikhre hue email ke alawa kuch nahi tha.
--
-- Ab ek ticket = ek baatcheet. Do table:
--
--   support_tickets  — ek sawaal, uska number, uski haalat (khula/jawab diya/band)
--   support_messages — us baatcheet ki har line, dono taraf ki (chat jaisi)

/* ------------------------------------------------------------------ */
/* 1. Tickets                                                          */
/* ------------------------------------------------------------------ */

create table if not exists public.support_tickets (
  id        uuid primary key default gen_random_uuid(),
  -- User ko dikhne wala number: AS-DDMMYY-HHMMSS (IST). Neeche wala function
  -- banata hai — client kabhi nahi.
  ticket_no text unique not null,
  user_id   uuid not null references auth.users(id) on delete cascade,
  -- Us waqt ka email/naam. Profile baad me badle to bhi ticket ka itihas sahi
  -- rehta hai (aur delete hone ke baad bhi pata rehta hai kise jawab dena tha).
  email     text,
  name      text,
  subject   text not null,
  -- 'open'     — user ne pucha, jawab baaki
  -- 'answered' — admin ne jawab de diya
  -- 'closed'   — baat khatam
  status    text not null default 'open',
  -- Aakhri line kab aayi — dono list (app aur admin) isi par sort hoti hain.
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists st_user_idx   on public.support_tickets(user_id, last_message_at desc);
create index if not exists st_status_idx on public.support_tickets(status, last_message_at desc);

/* ------------------------------------------------------------------ */
/* 2. Messages                                                         */
/* ------------------------------------------------------------------ */

create table if not exists public.support_messages (
  id         bigserial primary key,
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  -- 'user' | 'admin'
  sender     text not null,
  body       text not null,
  -- User ne is line ko app me dekh liya? (admin wali lines par hi maayne rakhta)
  seen_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sm_ticket_idx on public.support_messages(ticket_id, created_at);

/* ------------------------------------------------------------------ */
/* 3. RLS — user sirf apna, admin service_role se                      */
/* ------------------------------------------------------------------ */

alter table public.support_tickets  enable row level security;
alter table public.support_messages enable row level security;

-- Padhna: apne hi ticket. Likhna nahi — wo RPC se hota hai (taaki ticket number
-- aur status client ke haath me na jaayein).
drop policy if exists "apne tickets padho" on public.support_tickets;
create policy "apne tickets padho" on public.support_tickets
  for select using (auth.uid() = user_id);

drop policy if exists "apne ticket ke message padho" on public.support_messages;
create policy "apne ticket ke message padho" on public.support_messages
  for select using (
    exists (
      select 1 from public.support_tickets t
       where t.id = support_messages.ticket_id and t.user_id = auth.uid()
    )
  );

/* ------------------------------------------------------------------ */
/* 4. Ticket number                                                    */
/* ------------------------------------------------------------------ */

/**
 * Ticket ka number — samay se banta hai, isliye har naye ticket par apne aap
 * naya hota hai.
 *
 *   AS-310726-143052   =  31 July 2026, 2:30:52 PM (IST)
 *      ││││││ ││││││
 *      ddmmyy hhmmss
 *
 * Kyun ye shakal: user phone par ya email me ye number padh ke bolta hai, isliye
 * chhota aur bolne laayak hona chahiye. Aur ismein taarikh khud dikhti hai —
 * admin ko number dekh ke hi pata chal jaata hai ki baat kitni purani hai.
 *
 * IST me isliye ki users aur admin dono yahin hain; UTC me "kal raat 11 baje"
 * wala ticket agle din ki taarikh le leta, jo padhne wale ko galat lagta.
 *
 * ⚠️ Ek hi second me do log ticket bana sakte hain. Us soorat me `-2`, `-3`
 * lagta jaata hai. Bina iske unique constraint fail hota aur DOOSRE user ka
 * ticket bilkul chup-chaap gir jaata — sabse bura tarah ka fail.
 */
create or replace function public.next_ticket_no()
returns text language plpgsql security definer set search_path = public as $$
declare base text; candidate text; n int := 1;
begin
  base := 'AS-' || to_char(now() at time zone 'Asia/Kolkata', 'DDMMYY-HH24MISS');
  candidate := base;
  while exists (select 1 from public.support_tickets where ticket_no = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
    -- Ek hi second me 99 se zyada ticket = kuch aur hi gadbad hai; tab number me
    -- ek random tukda jod ke aage badh jaate hain (loop yahan atakna nahi chahiye).
    if n > 99 then
      candidate := base || '-' || substr(md5(random()::text), 1, 4);
      exit;
    end if;
  end loop;
  return candidate;
end;
$$;

/* ------------------------------------------------------------------ */
/* 5. Naya ticket                                                      */
/* ------------------------------------------------------------------ */

/**
 * Ticket + uski pehli line, ek saath.
 *
 * Ek hi function me isliye ki dono ek transaction me banein: aadha bana ticket
 * (bina message ke) admin ko khaali dikhta hai aur user ko lagta hai bhej diya.
 *
 * Email/naam profile se khud utha lete hain — client par bharosa karke inhe
 * bhejne dena galat hota (koi bhi kisi aur ka email likh deta).
 */
create or replace function public.create_support_ticket(
  p_subject text,
  p_message text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t public.support_tickets; p record;
begin
  if uid is null then
    return jsonb_build_object('error', 'auth');
  end if;
  if p_subject is null or length(trim(p_subject)) < 3 then
    return jsonb_build_object('error', 'subject');
  end if;
  if p_message is null or length(trim(p_message)) < 3 then
    return jsonb_build_object('error', 'message');
  end if;

  select email, full_name into p from public.profiles where id = uid;

  insert into public.support_tickets (ticket_no, user_id, email, name, subject)
  values (public.next_ticket_no(), uid, p.email, p.full_name, left(trim(p_subject), 160))
  returning * into t;

  insert into public.support_messages (ticket_id, sender, body)
  values (t.id, 'user', left(trim(p_message), 4000));

  return jsonb_build_object(
    'id', t.id,
    'ticket_no', t.ticket_no,
    'subject', t.subject,
    'status', t.status,
    'created_at', t.created_at
  );
end;
$$;

revoke all on function public.create_support_ticket(text, text) from public, anon;
grant execute on function public.create_support_ticket(text, text) to authenticated;

/* ------------------------------------------------------------------ */
/* 6. User ka jawab (usi baatcheet me)                                 */
/* ------------------------------------------------------------------ */

create or replace function public.add_support_message(
  p_ticket_id uuid,
  p_body text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); owner uuid;
begin
  if uid is null then return jsonb_build_object('error', 'auth'); end if;
  if p_body is null or length(trim(p_body)) < 1 then
    return jsonb_build_object('error', 'empty');
  end if;

  select user_id into owner from public.support_tickets where id = p_ticket_id;
  if owner is null or owner <> uid then
    return jsonb_build_object('error', 'not_found');
  end if;

  insert into public.support_messages (ticket_id, sender, body)
  values (p_ticket_id, 'user', left(trim(p_body), 4000));

  -- User ne kuch kaha = baat phir se khuli. Band ticket par bhi likh sakta hai,
  -- warna use naya ticket banana padta aur poora sandarbh toot jaata.
  update public.support_tickets
     set status = 'open', last_message_at = now()
   where id = p_ticket_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.add_support_message(uuid, text) from public, anon;
grant execute on function public.add_support_message(uuid, text) to authenticated;

/* ------------------------------------------------------------------ */
/* 7. Admin ke jawab ko "dekh liya" mark karna                         */
/* ------------------------------------------------------------------ */

/** App me ticket khulte hi — taaki unread ka nishaan hat jaye. */
create or replace function public.mark_support_seen(p_ticket_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  update public.support_messages m
     set seen_at = now()
   where m.ticket_id = p_ticket_id
     and m.sender = 'admin'
     and m.seen_at is null
     and exists (
       select 1 from public.support_tickets t
        where t.id = m.ticket_id and t.user_id = uid
     );
end;
$$;

revoke all on function public.mark_support_seen(uuid) from public, anon;
grant execute on function public.mark_support_seen(uuid) to authenticated;
