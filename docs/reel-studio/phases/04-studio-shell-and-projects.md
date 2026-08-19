# Phase 4 — Studio app shell + project CRUD + autosave

**STATUS:** COMPLETE (2026-08-19)
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 4 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + A1 Quality rules binding. Resume Protocol follow karo.
**Depends on:** Phase 1, 2 complete (Phase 3 saath me ho to accha)

**Goal:** editor ka ghar — project banao, kholo, doc load/save ho, autosave chale.
Abhi timeline nahi, sirf shell + data flow.

## Checklist

- [x] 4.1 Auth gate: `web/lib/admin-password.ts` ka pattern **copy** karke studio ke liye
      simple password gate (cookie + middleware). `web/` ko touch nahi.
      -> `studio/lib/auth.ts` + `studio/middleware.ts`. Do jaan-boojhkar badlav: (a) Node ke
      `crypto` ki jagah **Web Crypto**, kyunki middleware edge runtime par chalta hai aur
      wahan `node:crypto` hai hi nahi; (b) scrypt nahi — password env me hai, DB me nahi,
      isliye seedha constant-time compare (jhooti mazbooti dikhane se behtar saaf likhna).
      Gate **default-deny** hai: jo `PUBLIC_PATHS` me nahi wo band. `STUDIO_PASSWORD` set
      na ho to studio khulta hi nahi. `web/` ki ek line nahi chhui.

- [x] 4.2 `studio/lib/supabase.ts`: server-side client (service role, sirf server files me).
      Client component se service role kabhi nahi.
      -> PostgREST par seedha `fetch` (repo ka maujooda tarika — `web/lib/store.ts`,
      `worker/scripts/db-verify.ts`), isliye koi nayi dependency nahi. `assertServer()`
      browser me import hote hi phatta hai. Verify: rendered HTML me service key **0 baar**.

- [x] 4.3 `GET /api/projects` + `POST /api/projects` (create from `createEmptyProject`).
      Size selector README 3B ki poori list se — Reel 1080x1920 **default**, square,
      portrait 4:5, landscape 16:9, 1440p/4K, 4:3, aur Custom (width x height).
      fps 24/25/30/50/60 (default 30). List config se, hardcode nahi. Aspect thumbnail bhi.
      -> `NewProjectDialog.tsx` me ek bhi size likhi hui nahi — sab `SIZE_PRESETS` /
      `FPS_CHOICES` se. Thumbnail asli `aspect-ratio: w / h` se banta hai, isliye naya
      preset apne aap sahi shakal me dikhta hai.

- [x] 4.4 Project list page: cards (name, size badge, duration, updated_at, thumbnail placeholder),
      create / rename / duplicate / delete. Delete pe confirm.
      -> `app/page.tsx` (server) + `components/projects/ProjectList.tsx`. List `doc->project`
      hi maangti hai, poora doc nahi. Rename ek naye core op (`setProjectProperty`) se hota
      hai — list page ke paas doc nahi hota, isliye server padhta -> op chalata -> optimistic
      likhta hai.

- [x] 4.5 `GET /api/projects/[id]` -> doc `migrateDoc()` se guzarkar aaye (purane version safe).
      -> `lib/projects.ts` ka `toLoaded()` — ekmatra jagah jahan se doc bahar aata hai,
      isliye editor page aur API dono ek hi migration se guzarte hain.

- [x] 4.6 `PATCH /api/projects/[id]`: body me `{doc, doc_version}`. Server pe optimistic check —
      DB ka version mismatch ho to 409 aur client ko batao (silently overwrite **nahi**).
      -> Check aur update **ek hi query** me: `?id=eq.X&doc_version=eq.N`. Pehle-padho-phir-likho
      karne se race dono query ke beech chhup jaata. 409 me `serverVersion` bhi jaata hai.
      Incoming doc `parseDoc()` se guzarta hai — galat doc DB me kabhi nahi.

- [x] 4.7 `studio/lib/store.tsx`: zustand store — `docSlice` (poora doc) + `uiSlice`
      (selection, playhead, zoom, mode). UI state doc ke andar **nahi**.
      -> Store **per-editor** hai (context se), module-level nahi. Ye ittefaq nahi:
      module-level store ke saath server render ka `useSyncExternalStore` snapshot doc
      bharne se pehle jam jaata tha aur SSR ka HTML bina preview/timeline ke nikalta tha.
      Check script me assert hai ki UI badalne se doc chhuta tak nahi.

- [x] 4.8 Store ka `applyOp(opName, args)` wrapper: sirf `@reel/core` ke named ops call karta hai,
      patches history me daalta hai, aur autosave trigger karta hai.
      -> `applyOp` `OPS` map se hi op uthata hai (koi doosra raasta hai hi nahi), op ka error
      crash nahi banta — `opError` banta hai aur doc bilkul nahi badalta. Do naye core ops
      bhi bane: `setProjectProperty` (rename) aur `replaceDoc` (version restore), dono
      `@reel/core` ke check script me naape gaye.

- [x] 4.9 Autosave: debounce 1.5s + max wait 10s, in-flight request ke dauraan queue,
      failure pe retry with backoff + UI me saaf status. Tab close pe `beforeunload` warning.
      -> `lib/autosave.ts` (React se bilkul alag) + `scripts/check-autosave.ts` me 8 asli test:
      debounce, max-wait, in-flight queue, conflict par retry **band**, network par backoff,
      fatal par retry nahi, flush, aur khaali flush.

- [x] 4.10 `reel_project_versions` me snapshot: har 10 saves ya 5 min me ek, plus manual
      "Save version" button. Version list se restore (restore bhi ek op ho, undo-able).
      -> Snapshot hamesha **DB ka doc** leta hai, client ka bheja hua nahi — warna snapshot
      us haalat ka banta jo kabhi save hi nahi hui. Restore client par `replaceDoc` op se
      hota hai, isliye Ctrl+Z se wapas ho jaata hai (browser me karke dekha).
      Session ka pehla save bhi ek snapshot banata hai (jaan-boojhkar).

- [x] 4.11 Editor layout shell: TopBar (naam inline edit, undo, redo, save status,
      Preview/Export **disabled with tooltip**), LeftSidebar (tabs registry se), center
      preview placeholder, RightSidebar, bottom timeline placeholder. Resizable panels,
      layout localStorage me yaad rahe.
      -> Left tabs `components/editor/panels/index.tsx` registry se — aur usme sirf wahi do
      panel hain jo aaj **sach me** kaam karte hain (Project, Versions). "Media"/"Text" ke
      khaali tab daalna rule 5 todta. Preview ka tooltip "Phase 6", Export ka "Phase 11".

- [x] 4.12 Undo/redo buttons + `Ctrl+Z`/`Ctrl+Shift+Z` sach me kaam karein.
      -> Browser me chala kar dekha: Ctrl+Z ne naam wapas kiya, redo ka label
      "Redo: naam badla" bana, aur undo ka natija DB tak gaya.

- [x] 4.13 Keyboard shortcut system ek jagah (`studio/lib/shortcuts.ts`) — registry style.
      -> `SHORTCUTS` list: undo, redo, redo-alt (Ctrl+Y), save (Ctrl+S). Input ke andar
      shortcuts band rehte hain (`allowInInput` chhodkar), aur TopBar ke tooltip isi list
      se apna hint uthate hain — do jagah likha hua kabhi alag nahi ho sakta.

- [x] 4.14 Test: project banao -> naam badlo -> reload -> sab bacha rahe. Do tab kholo, dono me
      edit karo, 409 sach me dikhe.
      -> Dono hue, output neeche. Browser me bhi: naam badla -> autosave -> DB me v5;
      "doosri tab" ne badla -> conflict banner aaya -> "Unka version lo" se saaf hua.

- [x] 4.15 `npm run typecheck` clean. Commit: "reel-studio: phase 4 — studio shell + projects".

## Verify (asli output paste karna)

```
$ npm run typecheck
> @reel/studio  > @reel/core  > @reel/remotion  > @reel/storage  > @reel/worker
(exit 0, ek bhi error nahi)

$ npm run check
autosave scheduler (4.9)                 ALL PASS: 8 tests, 0 fail
editor store (4.7 / 4.8 / 4.12)          ALL PASS: 9 tests, 0 fail
@reel/core                               ALL PASS: 73 assertions groups, 0 fail

$ npm run build:studio
Route (app)                                  Size     First Load JS
- /                                          4.64 kB         126 kB
- /api/projects                              0 B                0 B
- /api/projects/[id]                         0 B                0 B
- /api/projects/[id]/duplicate               0 B                0 B
- /api/projects/[id]/versions                0 B                0 B
- /api/projects/[id]/versions/[versionId]    0 B                0 B
- /login                                     1.4 kB         88.6 kB
- /project/[id]                              8.88 kB         130 kB
Middleware                                   27 kB
```

### 4.1 gate (dev server chalu, bina cookie ke)

```
GET /             -> 307 location=http://localhost:3000/login
GET /api/projects -> {"error":"unauthorized","reason":"login karo (/login)"}
POST /api/auth/login {"password":"galat"}  -> {"error":"galat password"} [401]
POST /api/auth/login {"password":"<sahi>"} -> {"ok":true} [200]  (cookie reel_studio set)
```

### 4.3 create + size/fps validation

```
POST /api/projects {"name":"Phase 4 test"}                                 [201]
  1080x1920 | preset reel | fps 30 | frames 450 | tracks 2 | doc.project.id == row.id true
POST /api/projects {"presetId":"landscape","fps":24,"durationInSeconds":8}  [201]
  1920x1080 @ 24 fps, frames 192
POST /api/projects {"presetId":"custom","width":720,"height":1280}         [201]
  720x1280 preset custom

POST {"presetId":"custom","width":1081,...} [400] width even hona chahiye (16-7680)
POST {"fps":37}                             [400] fps in me se ek ho: 24, 25, 30, 50, 60
POST {"presetId":"imax"}                    [400] Expected 'reel' | 'square' | ... | 'custom'
```

### 4.4 / 4.5 rename -> reload

```
PATCH /api/projects/<id> {"name":"Rahul + Papa"} -> {"doc_version":2,...,"name":"Rahul + Papa"} [200]
GET   /api/projects/<id> -> name column: Rahul + Papa | doc.project.name: Rahul + Papa
                            doc_version: 2 | doc.version (schema): 1
```

### 4.6 / 4.14 do tab, ek project (dono ne v2 uthaya)

```
Tab A save:  [200] {"doc_version":3,...,"name":"Tab A ka naam"}
Tab B save:  [409] {"error":"conflict","reason":"ye project kahin aur save ho chuka hai",
                    "serverVersion":3,"serverUpdatedAt":"..."}
DB me:       Tab A ka naam | v3     <- Tab B ka save chupchaap nahi khaaya gaya

Tab B ne "Mera version rakho" chuna (overwrite):
             [200] {"doc_version":4,...,"name":"Tab B ka naam"}
versions:    - conflict - overwrite se pehle   <- is snapshot me "Tab A ka naam" pada hai
```

### 4.10 versions

```
GET  /api/projects/<id>/versions       -> autosave / manual / conflict - overwrite se pehle
GET  /api/projects/<id>/versions/<vid> -> snapshot me naam: Tab A ka naam
POST /api/projects/<id>/versions {"label":"manual"} [201]
```

### Browser me (localhost:3000, Chrome) - asli click/keyboard

```
naam badla (blur)  -> PATCH 200 -> DB: "Rahul + Papa (browser se)" v5
Ctrl+Z             -> naam wapas "Tab B ka naam", redo button "Redo: naam badla (Ctrl+Shift+Z)"
                      -> ye bhi save hua, DB v6
curl se rename (doosri tab bankar) -> v7
phir browser me edit -> PATCH 409 -> banner:
   "Ye project kahin aur save ho chuka hai (server par v7, tumhare paas v6 - abhi).
    Tumhara autosave rok diya gaya hai. Faisla tumhara:  [Unka version lo] [Mera version rakho]"
"Unka version lo" -> naam "Doosri tab ne badla", banner gaya, status Saved
Versions -> Restore (purana snapshot) -> naam "Tab A ka naam",
            undo ka label "Undo: version restore (Ctrl+Z)"   <- restore undo-able hai
left panel drag 248 -> 320px -> localStorage {"left":320,"right":300,"timeline":220}
   -> page reload -> panel abhi bhi 320px, naam abhi bhi saved wala
TopBar buttons: Preview disabled ("...Phase 6 me aayega - abhi ye button sach me kuch nahi karta")
                Export  disabled ("...Phase 11 me aayega - ...")
rendered HTML me SUPABASE_SERVICE_ROLE_KEY: 0 baar
```

## Done when

Project banta/khulta/save hota hai, autosave debounced hai, version snapshots ban rahe hain,
undo/redo chal raha hai, aur conflict pe data chupchaap nahi khota.

-> **Sab ho gaya**, aur upar ka output asli chalane se hai. Conflict wala hissa do tarah se
naapa gaya — curl se (do "tab") aur browser me (banner + dono buttons). Overwrite chunne par
bhi doosre ka doc pehle snapshot me chala jaata hai, isliye kisi ka kaam hamesha ke liye
nahi jaata.

## Do asli bug jo is phase me pakde aur theek hue

1. **SSR me editor khaali nikal raha tha.** Module-level zustand store ke saath React ka
   `useSyncExternalStore` snapshot store bharne se *pehle* jam jaata tha — server ka HTML
   bina preview / timeline / project panel ke jaata tha (client par hydration mismatch).
   Ab store **per-editor, context se** banta hai aur render se pehle poora bhara hua hota
   hai. Fayda ye bhi ki do project ek doosre ka state nahi chhoote.

2. **Autosave chupchaap mar jaati thi — screen "Saved" dikhati thi aur DB me kuch nahi
   jaata tha.** Editor ke unmount par `dispose()` chalta tha; React StrictMode dev me har
   effect ko mount -> cleanup -> mount chalata hai, isliye ye cleanup mount ke turant baad
   hi chal jaata tha aur scheduler mar jaata tha. Ye **sirf browser me chala kar** pakda
   gaya — API test, typecheck aur unit test teeno pass the. Ab do deewaarein hain: unmount
   par `dispose()` ki jagah **flush** (aakhri edit bachani hai), aur store me mara hua
   scheduler agli edit par dobara khada ho jaata hai. Regression test
   `studio/scripts/check-store.ts` me hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| 2026-08-19 | 4.1-4.15 poore. `studio/` me auth gate (middleware, Web Crypto), PostgREST data layer, API routes (list/create/get/patch/delete/duplicate/versions/restore), project list + naya-project dialog (poora 3B size selector), editor shell (TopBar / do sidebar / preview + timeline placeholder, resizable + localStorage), per-editor zustand store, `applyOp`, autosave scheduler, version snapshots + undo-able restore, shortcuts registry. `@reel/core` me do naye op: `setProjectProperty`, `replaceDoc`. Do asli bug pakde aur theek kiye (SSR khaali editor, chupchaap marti autosave). | `npm run typecheck` exit 0; `npm run check` 8 + 9 + 73 pass; `npm run build:studio` safal; curl se create/rename/reload/409/overwrite/versions ka poora output (upar); browser me autosave -> DB v5, Ctrl+Z -> v6, conflict banner + dono buttons, layout reload ke baad bhi yaad | Phase 5 — Asset upload + media library |
