-- ============================================================================
-- Column-level grants — "RLS row deti hai, column nahi"
--
-- Supabase SQL Editor me poori file Run karo. Dobara chalana safe hai.
-- Pehle chal chuki honi chahiye: profiles.sql, plans.sql, plan-limits.sql,
-- rewards-referrals.sql, language-column.sql, account-delete-requests.sql
-- ============================================================================
--
-- ⚠️ Ye file ek asli, chalne wale chhed ko band karti hai — koi ehtiyaat nahi.
--
-- `account-delete-requests.sql` me profiles ki policy aisi hai:
--
--     create policy "own profile write" on public.profiles for update
--       using (id = auth.uid() and public.account_active(auth.uid()))
--       with check (id = auth.uid() and public.account_active(auth.uid()));
--
-- Ye policy sirf ROW chunti hai — "apni row badal sakte ho". Par `plan`,
-- `plan_expires_at`, `plan_source` aur `referral_days_earned` bhi USI row me
-- hain. Yaani koi bhi logged-in user, app ki anon key se (jo APK me padi hai
-- aur nikaali ja sakti hai), seedha ye bhej sakta tha:
--
--     PATCH /rest/v1/profiles?id=eq.<apni uid>
--     { "plan": "plus", "plan_expires_at": "2099-01-01", "plan_source": "google_play" }
--
-- …aur use hamesha ke liye muft Saathi Plus mil jaata. Ye koi theory nahi hai:
-- app ka apna `markProfilePlus()` (app-mobile/src/lib/plan.ts) theek yahi call
-- karta tha, yaani raasta khula hone ka saboot khud code me maujood tha.
--
-- Iske peeche khadi har deewar bekaar ho jaati thi, kyunki sab isi ek column
-- par tiki hain: `is_plus_active()`, `enforce_plan_limits()`, cron ka
-- `downgrade_expired_plans()`, AI ka daily-brief gate, aur reminder/document
-- cron ka email+WhatsApp — sab `profiles.plan` padhte hain.
--
-- Ilaaj wahi hai jo is repo me pehle se ek jagah theek likha hua hai —
-- `reviews-public.sql` ka aakhri hissa:
--
--     revoke update on public.reviews from authenticated;
--     grant update (rating, text, allow_display) on public.reviews to authenticated;
--
-- Yaani: pehle poora update chheeno, phir sirf wahi column wapas do jo user ka
-- apna hai. Wahi tareeka yahan profiles, documents aur reminders par lag raha
-- hai.
--
-- ⚠️ service_role in grants se poori tarah bahar hai (wo RLS aur grants dono
-- bypass karta hai), isliye webhook, admin panel aur saare cron pehle jaise hi
-- chalte rehte hain. Rukta sirf wahi raasta hai jo APP ke paas hai.

/* ------------------------------------------------------------------ */
/* 1. profiles — user sirf apni bhasha badal sakta hai                 */
/* ------------------------------------------------------------------ */
--
-- App sach me profiles par SIRF ek column likhti hai: `language`
-- (`app-mobile/src/lib/i18n/LanguageProvider.tsx`). Baaki sab kahin aur se
-- bharta hai:
--
--   full_name            → user_details se trigger ke zariye (fix-name-sync.sql)
--   email, referral_code → signup trigger (handle_new_user)
--   referred_by          → apply_referral_code() RPC (security definer)
--   referral_days_earned → grant_plus_days() / reward RPC
--   plan, plan_expires_at, plan_source → RevenueCat webhook + admin grant
--   welcomed_at          → /api/welcome (service_role)
--   deleted_at           → admin panel (service_role)
--   phone_verified_at    → mark_phone_verified() (service_role only)
--
-- Isliye ek hi column wapas dena kaafi hai. Insert alag baat hai — wo signup
-- trigger karta hai — par policy waise bhi id = auth.uid() se bandhi hai.

revoke update on public.profiles from authenticated, anon;
grant update (language) on public.profiles to authenticated;

/* ------------------------------------------------------------------ */
/* 2. documents — `is_locked` server ka faisla hai                     */
/* ------------------------------------------------------------------ */
--
-- ⚠️ Yahi chhed doosri shakal me. `is_locked` free-plan ki limit lagata hai
-- (`enforce_plan_limits`), par wo bhi user ki apni row me padta hai — yaani
-- free user apne saare locked documents ek PATCH se khol sakta tha.
--
-- `user_id` bhi jaan-boojh ke rok rahe hain: policy ka `with check` use pakadta
-- to hai, par jo column badla hi na ja sake uspar bharosa karna behtar hai.
-- `file_path` / `file_size` / `mime_type` server bharta hai (storage/commit),
-- app nahi — inhe khula rakhna matlab app apni file ki size jhooth bol sakti hai.

revoke update on public.documents from authenticated, anon;
grant update (name, type, expiry, summary, file_uri, expiry_ack_at, renewed_at)
  on public.documents to authenticated;

/* ------------------------------------------------------------------ */
/* 3. reminders — `is_paused` bhi server ka faisla hai                 */
/* ------------------------------------------------------------------ */
--
-- Wahi baat: `is_paused` free-plan limit hai, aur `notified_at` cron ka nishaan
-- hai. `notified_at` app ke haath me hone ka matlab hai ki koi apna reminder
-- baar-baar "abhi tak bheja hi nahi" bana sakta hai — yaani har minute ek
-- WhatsApp aur ek email, hamare hi bill par.

revoke update on public.reminders from authenticated, anon;
grant update (
  title, note, time_label, remind_at, bucket, is_on,
  repeat_every_days, repeat_until, last_done_at
) on public.reminders to authenticated;

/* ------------------------------------------------------------------ */
/* 4. Jaanch — chalane ke baad ye query khaali aani chahiye            */
/* ------------------------------------------------------------------ */
--
-- Koi bhi aisa column jispar `authenticated` ke paas UPDATE hai par jo hamari
-- upar wali list me nahi hai. Naya column jodne par ye dobara chalana — nayi
-- column default se BAND rehti hai (grant column-wise hai), isliye ulta khatra
-- nahi hai: bas app ka wo write chup-chaap fail karega. Ye jaan-boojh ke aisa
-- hi rakha hai — khula reh jaane se behtar hai band mil jaana.
--
--   select table_name, column_name
--     from information_schema.column_privileges
--    where grantee = 'authenticated'
--      and privilege_type = 'UPDATE'
--      and table_schema = 'public'
--      and table_name in ('profiles', 'documents', 'reminders')
--    order by table_name, column_name;
