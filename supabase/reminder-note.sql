-- Reminder ka "note" — user ne apne shabdon me jo likha/bola tha.
--
-- Kyun: reminder email/WhatsApp me sirf `title` jaata tha. Title AI ka saaf kiya
-- hua chhota version hota hai ("Test"), isliye mail padh ke user ko yaad hi nahi
-- aata tha ki baat kis baare me thi. `note` poora context rakhta hai aur email
-- me title ke neeche dikhta hai.
--
-- Chalane ke liye: Supabase → SQL Editor → paste → Run.

alter table public.reminders
  add column if not exists note text;

comment on column public.reminders.note is
  'User ka original text (AI se saaf kiye gaye title ka poora context). Email/WhatsApp me title ke saath bheja jaata hai.';
