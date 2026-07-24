# Admin Panel Overhaul — Design Spec

**Date:** 2026-07-24
**Scope:** `web/components/Admin*.tsx`, `web/app/api/admin/*`, `web/lib/rewards-server.ts`, a few Supabase SQL/functions files, one mobile auth path.

## Goal
Admin panel abhi "congested" hai — sab kuch ek page, inline expand, koi pagination nahi,
documents dikhte nahi, usage detail adhoora. Isko saaf, consistent, aur poori-detailing wala
banao. Plus kuch backend fixes (naam, cron, Gemini key).

## Decisions (locked)
- **Redesign approach:** shared reusable components banao + har section declutter. Tab-shell wahi.
  Full route-based rewrite NAHI.
- **Phasing:** A (quick fixes) → B (features) → C (layout declutter).

---

## Phase A — Quick fixes  ✅ (done)
- **#7 Naam:** `supabase/fix-name-sync.sql` — robust `handle_new_user` (NULL se overwrite nahi),
  backfill `profiles.full_name` from auth metadata + `user_details`, aur `user_details` update pe
  `profiles.full_name` auto-sync trigger. Root cause: app naam `user_details` me likhta tha, admin
  `profiles` padhta hai — dono diverge.
- **#6 Cron:** teeno cron SQL files ab `create extension if not exists pg_cron/pg_net` khud karti hain.
- **#4 Gemini + #5 Deploy:** `docs/DEPLOYMENT.md` — Supabase/Vercel/EAS full checklist, `GEMINI_API_KEY`
  secret command, EAS `EXPO_PUBLIC_*` env-variable gotcha (preview APK).

---

## Phase B — Features

### Shared primitives (naye files, `web/components/admin/`)
Ek design language, sab jagah reuse:
- `Modal.tsx` — center dialog, backdrop, Esc/click-out close, scroll-lock, sizes (sm/md/lg/xl).
  Focus-trap + `role="dialog"`. Ye "See all" (#1) aur document-preview (#3) dono use karenge.
- `Pagination.tsx` — client-side pager: `page`, `pageSize`, `total`, prev/next + page numbers +
  "X–Y of Z". Chhota `usePagination(items, pageSize)` hook bhi.
- `DataTable.tsx` — column-config driven table (header, rows, empty state, optional row-click),
  responsive (desktop table / mobile cards). Reviews/Users/Usage/Logs isko adopt karenge.
- `SectionCard.tsx`, `StatTile.tsx`, `Toolbar.tsx` (search + filters + export ki ek jagah).

### #2 Pagination — har list me
Reviews, Users, Usage table, Logs groups, Contacts, aur naye Documents — sab `usePagination` +
`<Pagination>`. Default pageSize 25 (tables) / 12 (cards). Server caps (500) rehne denge; pagination
client-side (data already loaded). Documents alag (neeche).

### #1 Usage "See all" modal
`AdminUsage.tsx`: har user row pe "See all" → `<Modal>` khulta hai jisme us user ka **poora** activity
(documents + reminders + chats) — paginated, type filter (all/doc/reminder/chat), timestamps,
"kya-kya hua" full detail. Backing: `admin_activity(p_uid,...)` already hai; modal usko `p_uid` ke
saath call karega (bina 300 cap ke, ya bade limit + pagination).

### #3 Documents — admin me dikhe + view
- **Naya section "Documents"** (nav me add): saare users ke documents ki ek master list —
  columns: user (naam+email), document name, type, expiry, size, **kab upload** (created_at),
  **storage path** (`file_path`), in-storage badge. Search + type filter + pagination.
  "Kisne kitne + kab" ke liye per-user count summary bhi (top strip / group).
- **View:** row me "View" → signed-URL banake `<Modal>` me preview (image inline; pdf → embed/iframe;
  warna download link). Path bhi dikhega.
- **Backend:**
  - Naya RPC `admin_documents(p_from, p_to, p_limit, p_offset)` (SQL) — documents + owner join,
    newest first. (ya REST select with embed.)
  - Naya route `web/app/api/admin/documents/route.ts` — list.
  - Naya route `web/app/api/admin/documents/signed-url/route.ts` — service_role se
    `storage.from('documents').createSignedUrl(file_path, 60)` → short-lived preview URL.
    (Sirf isAuthed admin. File_path server pe validate.)
  - `rewards-server.ts` me `getDocuments()` + `getDocumentSignedUrl(path)`.

---

## Phase C — Declutter + layout (#8)
- Har section ko consistent shell: heading + toolbar (search/filter/export ek jagah) + content in
  `SectionCard`s + pagination footer. Inline-expand kam, `<Modal>`/`DetailDrawer` zyada.
- Spacing/rhythm theek: ek jaisa card radius, gaps, table density. Stat tiles ek `StatTile` grid.
- Nav grouping: "Log/Usage/Documents/Reviews" ko logical order; badge counts.
- Mobile: har table responsive cards, drawer nav already hai.
- Koi nayi feature nahi — sirf existing ko ek design system pe laana.

## Non-goals (YAGNI)
- Route-based rewrite, server-side infinite scroll, role-based admin, real-time.

## Testing
- Web: `npm run build` + `npm run lint` (web/) pass. Manual: har section load, pagination page-change,
  modal open/close, document signed-url preview, usage see-all.
- SQL: idempotent re-run; backfill count query.

## Risk / rollout
- Phase B/C sirf `web/` + do naye SQL/route. DB writes sirf Phase A (safe, idempotent).
- Signed-URL route service_role use karta hai — `isAuthed()` gate zaroori (baaki admin routes jaisa).
