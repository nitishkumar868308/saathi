-- Apka Saathi — Contact message ka jawab (admin > Contacts se).
-- Supabase SQL Editor me Run karo. (Dobara run safe.)
--
-- Pehle admin ko har message ke neeche sirf ek `mailto:` link milta tha. Uspe
-- click karne se user ka mail app khulta tha — yaani jawab admin ke apne niji
-- pate se jaata tha, us par koi branding nahi hoti thi, aur sabse badi baat:
-- kis message ka jawab de diya hai aur kis ka nahi, iska koi hisaab hi nahi
-- rehta tha. 200 message ho jaane par wahi ek cheez sabse pehle tootti hai.
--
-- Ab jawab admin panel se hi jaata hai (info@apkasaathi.com se), aur uska
-- nishaan yahin padta hai.

alter table public.contact_messages add column if not exists replied_at timestamptz;
alter table public.contact_messages add column if not exists reply_body text;
-- Kis admin ne jawab diya (email). Ab admin ek nahi, kai ho sakte hain —
-- dekho supabase/admin-team.sql.
alter table public.contact_messages add column if not exists replied_by text;

-- Admin list me "jinka jawab baaki hai" upar chahiye — us filter ke liye.
create index if not exists contact_messages_replied_idx
  on public.contact_messages (replied_at nulls first, created_at desc);
