-- Apka Saathi — Note ↔ Reminder ka rishta + admin ka hisaab
-- Supabase SQL Editor me Run karo. (Dobara run safe hai.)
-- NOTE: pehle notes.sql chala lena.
--
-- Note me "Reminder me daalo" pehle se tha, par uske baad wo do cheezein ek
-- doosre ko bhool jaati thi. Natija:
--
--   • User ko kabhi pata nahi chalta ki is note ka reminder LAG chuka hai ya
--     nahi. Isliye wo aksar dobara laga deta tha aur ek hi baat ka alarm do
--     baar bajta tha.
--   • Reminder delete karne par note me kuch nahi badalta tha — note kehta
--     rehta ki sab set hai, aur waqt par kuch bajta hi nahi.
--   • Admin ke paas ye sawaal ka koi jawab nahi tha ki "notes wala feature
--     sach me use ho raha hai ya sirf khul raha hai".

alter table public.notes
  -- `on delete set null` zaroori hai: reminder delete hone par note bacha rehna
  -- chahiye (usme user ka likha hua hai), bas uska "reminder laga hai" wala
  -- nishaan apne aap hat jaata hai. Cascade laga dete to reminder delete karte
  -- hi user ka note bhi chup-chaap ud jaata — sabse bura nuksaan.
  add column if not exists reminder_id uuid
    references public.reminders(id) on delete set null;

create index if not exists notes_reminder_idx
  on public.notes(reminder_id) where reminder_id is not null;

/**
 * Admin: notes ka hisaab — per user.
 *
 * ⚠️ Is function me note ka MATN (title/body) NAHI aata, aur ye ab bhi
 * jaan-boojh ke hai. Admin panel khulte hi jo hisaab dikhta hai, uske liye matn
 * chahiye hi nahi — "feature chal raha hai ya nahi, aur note se reminder banta
 * hai ya nahi" ka poora jawab ginti aur waqt se mil jaata hai. Matn har baar
 * saath bhejne ka matlab hota ki kisi ka likha hua tab bhi load ho jaye jab
 * kisi ne use maanga hi na ho.
 *
 * Matn padhne ka apna alag raasta hai — `admin_notes_list()` in
 * `supabase/notes-admin-content.sql`. Wo alag isliye hai ki padhna ek
 * jaan-boojh ke uthaya kadam rahe, ek ittefaq nahi. Us file me ye bhi likha
 * hai ki use chalane se pehle privacy policy me kya hona chahiye.
 *
 * Sirf service_role (admin API).
 */
create or replace function public.admin_notes_summary(p_limit int default 200)
returns jsonb language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  select jsonb_build_object(
    'totals', (
      select jsonb_build_object(
        'notes',        count(*),
        'withReminder', count(*) filter (where reminder_id is not null),
        'pinned',       count(*) filter (where is_pinned),
        'users',        count(distinct user_id),
        -- Pichhle 7 din — "feature zinda hai ya ek baar chal ke ruk gaya".
        'last7',        count(*) filter (where created_at >= now() - interval '7 days')
      )
      from public.notes
    ),
    'users', coalesce((
      select jsonb_agg(u order by u.last_at desc)
      from (
        select n.user_id,
               p.full_name,
               p.email,
               count(*)                                        as notes,
               count(*) filter (where n.reminder_id is not null) as with_reminder,
               max(n.updated_at)                               as last_at
        from public.notes n
        left join public.profiles p on p.id = n.user_id
        group by n.user_id, p.full_name, p.email
        order by max(n.updated_at) desc
        limit greatest(1, least(p_limit, 1000))
      ) u
    ), '[]'::jsonb)
  ) into res;
  return res;
end;
$$;

revoke all on function public.admin_notes_summary(int) from public, anon, authenticated;
