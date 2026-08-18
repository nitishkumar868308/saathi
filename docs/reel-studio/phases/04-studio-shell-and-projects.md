# Phase 4 — Studio app shell + project CRUD + autosave

**STATUS:** not started
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 4 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + A1 Quality rules binding. Resume Protocol follow karo.
**Depends on:** Phase 1, 2 complete (Phase 3 saath me ho to accha)

**Goal:** editor ka ghar — project banao, kholo, doc load/save ho, autosave chale.
Abhi timeline nahi, sirf shell + data flow.

## Checklist

- [ ] 4.1 Auth gate: `web/lib/admin-password.ts` ka pattern **copy** karke studio ke liye
      simple password gate (cookie + middleware). `web/` ko touch nahi.
- [ ] 4.2 `studio/lib/supabase.ts`: server-side client (service role, sirf server files me).
      Client component se service role kabhi nahi.
- [ ] 4.3 `GET /api/projects` + `POST /api/projects` (create from `createEmptyProject`).
      **Size selector README section 3B ki poori list se** — Reel 1080x1920 **default**,
      plus square, portrait 4:5, landscape 16:9, 1440p/4K, 4:3, aur **Custom (width x height)**.
      fps choice 24/25/30/50/60 (default 30). List config se aati hai, hardcode nahi.
      UI me har preset ka chhota aspect thumbnail dikhe.
- [ ] 4.4 Project list page: cards (name, size badge, duration, updated_at, thumbnail placeholder),
      create / rename / duplicate / delete. Delete pe confirm.
- [ ] 4.5 `GET /api/projects/[id]` → doc `migrateDoc()` se guzarkar aaye (purane version safe).
- [ ] 4.6 `PATCH /api/projects/[id]`: body me `{doc, doc_version}`. Server pe optimistic check —
      DB ka version mismatch ho to 409 aur client ko batao (silently overwrite **nahi**).
- [ ] 4.7 `studio/lib/store.ts`: zustand store — `docSlice` (poora doc) + `uiSlice`
      (selection, playhead, zoom, mode). UI state doc ke andar **nahi**.
- [ ] 4.8 Store ka `applyOp(opName, args)` wrapper: sirf `@reel/core` ke named ops call karta hai,
      patches history me daalta hai, aur autosave trigger karta hai. **Component seedha
      `doc.items[i].x = 5` kabhi nahi karega.**
- [ ] 4.9 Autosave: debounce 1.5s + max wait 10s, in-flight request ke dauraan queue,
      failure pe retry with backoff + UI me saaf status ("Saved" / "Saving…" / "Save failed —
      retrying"). Tab close pe `beforeunload` warning agar unsaved hai.
- [ ] 4.10 `reel_project_versions` me snapshot: har 10 saves ya 5 min me ek, plus manual
      "Save version" button. Version list se restore (restore bhi ek op ho, undo-able).
- [ ] 4.11 Editor layout shell: TopBar (project name inline edit, undo, redo, save status,
      Preview/Export buttons **disabled with tooltip "Phase 11"** — fake nahi, saaf disabled),
      LeftSidebar (tabs registry se generate), center preview placeholder, RightSidebar,
      bottom timeline placeholder. Resizable panels, layout localStorage me yaad rahe.
- [ ] 4.12 Undo/redo buttons + `Ctrl+Z`/`Ctrl+Shift+Z` sach me kaam karein (Phase 1 ki history se).
- [ ] 4.13 Keyboard shortcut system ek jagah (`studio/lib/shortcuts.ts`) — registry style,
      taaki aage shortcuts add karna ek entry ho.
- [ ] 4.14 Test: project banao → naam badlo → reload → sab bacha rahe. Do tab kholo, dono me
      edit karo, 409 sach me dikhe. Ye mujhe output/screenshot se dikhao.
- [ ] 4.15 `npm run typecheck` clean. Commit: "reel-studio: phase 4 — studio shell + projects".

## Verify (asli output paste karna)

```
npm run dev:studio
# project create -> rename -> reload -> still there
# 2 tabs -> conflicting edit -> 409 handled
npm run typecheck
```

## Done when

Project banta/khulta/save hota hai, autosave debounced hai, version snapshots ban rahe hain,
undo/redo chal raha hai, aur conflict pe data chupchaap nahi khota.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| | | | |
