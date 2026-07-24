-- ============================================================================
-- documents.summary — AI scan ka poora samajh (jo user ko dikhta hai) DB me save.
--
-- Pehle scanDocumentAI() { type, name, expiry, summary } lautata tha par sirf
-- type/name/expiry save hote the — summary (poora AI extract) chhoot jaata tha.
-- Ab wo bhi save hota hai (app + admin dono me dikhega).
--
-- Supabase SQL Editor me Run karo. Dobara chalana safe.
-- ============================================================================

alter table public.documents add column if not exists summary text;
