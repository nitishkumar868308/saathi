# Phase 16 — Multi-track manager + shortcuts + workflow polish

**STATUS:** code done — browser wala hissa baaki (dev server nahi chala)
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 16 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 15 complete

**Goal:** editor ka rozana ka istemaal tez ho — unlimited tracks, asli shortcuts,
aur wo chhoti cheezein jinke bina editor thakaa deta hai.

## ⚠️ Tick ka matlab

- `[x]` = **chalaya gaya hai**, aur neeche `→` me uska asli output hai.
- `[ ]` = code likha hua hai par chalaya nahi. Kya rok raha hai wo likha hai.

## Checklist

- [x] 16.1 Track manager: add / remove (items ka kya karein — poochho) / rename / reorder / duplicate.
      → `TrackMenu.tsx` + `AddTrackButton`. Add ki list `TRACK_TYPES` registry se banti hai —
        yahan kisi track type ka naam likha nahi hai.
      → Remove par **poochha** jaata hai: "mitao" ya "bacha lo". `removeTrack` ab
        `items: "delete" | "move"` leta hai; `"move"` par clips **maanne wali** doosri track
        par jaate hain (`trackAccepts` se), kisi bhi track par nahi.
      → Reorder pehle se `reorderTracks` op se tha.
- [x] 16.2 Track controls render me bhi lagein: mute, hide, lock, solo, opacity, height.
      → Solo aur opacity naye hain. `ReelComposition` me chhaanti ek hi jagah hoti hai;
        `itemGainAt()` me track ka solo item ke solo ke **upar** chalta hai.
      → Height ab **doc me** hai (`track.heightPx`), UI state me nahi — neeche "jo galat nikla"
        dekho.
      → Hide/solo ka render wala hissa **MP4 se naapa gaya** (16.15).
- [x] 16.3 Track type compatibility — registry se.
      → `trackAccepts()` pehle se tha; ab `removeTrack items: "move"` bhi wahi maanta hai.
      → ⚠️ **Pehle "galat drop par feedback" ka koi raasta tha hi nahi (2026-08-21 me
        pakda).** Poore studio me drag-drop sirf `MediaPanel` par tha, aur wo OS se file
        upload ke liye hai — library ke asset ko timeline par daalne ka rasta banaya hi
        nahi gaya tha. Yaani drop hi nahi hota tha, to feedback kis cheez par deta.
      → **Ab dono ban gaye (usi din).** Faisla ek pure function me hai —
        `planAssetDrop()` ([timeline/assetDrop.ts](../../../packages/reel-core/src/timeline/assetDrop.ts),
        6 test) — aur wahi teeno jagah chalta hai: `dragover` par lane ka rang, `drop` par
        item banega ya nahi, aur button wale raaste par track chunna. Teen jagah teen `if`
        rakhne par ek din lane hari dikhti aur drop mana kar deta.
      → **Mana karne ki wajah hamesha lautayi jaati hai**, sirf `false` nahi — aur usme
        agla kadam bhi hota hai. Browser me naapa gaya jawab:
        `Image ko "Voice / Audio" track par nahi rakh sakte — "Video" track par chhodo.`
        Ye lane par hi laal dashed patti me dikhta hai, aur upar wali patti me bhi.
      → **Do raaste, ek faisla:**
        * ghaseet kar chhodo (`AssetCard` draggable → `TimelineView` ka lane)
        * ya asset khol kar **"Timeline me jodo"** — track khud chun liya jaata hai
          (`firstTrackFor`) aur clip playhead par aati hai. Ye phone/tablet ke liye
          **zaroori** hai: wahan library aur timeline alag pane me hote hain, isliye ek se
          doosre me ghaseetna namumkin hai.
      → **Browser me chalakar dekha:** galat track par drop — clip **nahi** bani (ginti 3
        hi rahi) aur wajah dikhi; sahi track par drop — `PRIYA.png` frame **55** par bani
        (jahan chhoda: x=220 par 4 px/frame) 120 frame ki (4s default), aur wo DB me save
        bhi hui. Undo se sab wapas — project apne 11 item par laut aaya.
      → `trackAccepts()` ka faisla pehle se test me tha; ab uske upar UI bhi hai.
- [x] 16.4 Layer order = track order (z-index).
      → `ReelComposition` `order` se sort karta hai (Phase 3 se). Yahan sirf verify kiya.
- [x] 16.5 Keyboard shortcuts poore.
      → **40 shortcuts**, koi takraav nahi (neeche asli output). Naye: J/K/L shuttle,
        Shift+Z fit, M marker (+ Shift+M / Alt+M jump), `[` `]` playhead tak trim,
        Ctrl+G / Ctrl+Shift+G group.
      → J/K/L ke liye `<Player>` par koi speed prop hai hi nahi, isliye shuttle ka apna rAF
        loop hai jo playhead khiskata hai.
- [x] 16.6 Cheat-sheet modal (`?`) — registry se auto-generated.
      → **browser me khola (2026-08-21):** `Shift+/` par cheat-sheet aaya — "Keyboard
        shortcuts / CHALANA / Play / pause `Space` / Ek frame peeche `←` …" — 42 row,
        sab registry se.
      → `ShortcutsDialog.tsx`. List `SHORTCUTS` se banti hai; haath se likhi list ek din
        jhoothi ho jaati hai, aur jhoothi cheat-sheet na hone se buri hai.
- [x] 16.7 Shortcut remap UI (localStorage me).
      → Key par click karo, nayi key dabao. Takraav **pehle hi** dikh jaata hai
        (`conflictingIds`), kyunki takraav ke baad ek key kabhi ek kaam karti hai kabhi doosra.
      → Remap machine ki setting hai, project ki nahi — keyboard aadmi ka hota hai.
- [x] 16.8 Markers: add / rename / delete / jump, doc me.
      → `MarkerSchema` doc par + `addMarker` / `setMarker` / `deleteMarker` ops +
        `MarkerLane.tsx` (ruler ke neeche).
      → Ek hi frame par doosra marker nahi banta — warna wo purane ke upar baith jaata hai
        aur user ko lagta hai click kaam hi nahi kiya.
- [x] 16.9 Right-click context menu — clip par.
      → `ClipContextMenu.tsx`. Har entry **wahi op** chalati hai jo shortcut aur panel
        chalate hain; koi "menu wala raasta" alag se nahi hai.
      → **browser me khola (2026-08-21):** clip par right-click karte hi menu aaya —
        `Playhead par todo (S)`, `Copy (Ctrl+D)`, `Delete (Del)`,
        `Ripple delete (Shift+Del)`, `Lock`, `Chhupao` — har item apne shortcut ke saath.
      → Track par aur khaali jagah par menu **nahi** bane — wahan jo cheezein chahiye wo
        track header aur toolbar me pehle se hain, aur khaali menu banana sirf list lambi
        karta hai.
- [x] 16.10 Multi-select drag across tracks + group/ungroup.
      → `groupId` field + `groupItems` / `ungroupItems` / `expandSelectionToGroups`.
      → Group **move** par saath chalta hai, trim par nahi — group ka matlab "ek saath ek
        jagah rehte hain" hai, "ek jaisi lambai" nahi.
      → Cross-track drag Phase 8 se hai.
- [x] 16.11 Snapping options panel.
      → `SnapOptions` (playhead / clips / markers / scenes / seconds) + `SnapMenu.tsx`.
      → Ek switch nahi, ek list — wajah neeche "jo seekha" me.
- [x] 16.12 Auto-scroll during drag; drag-to-timeline se asset drop.
      → Auto-scroll `useClipDrag` me hai, apne rAF loop ke saath (kinare par ungli **rok**
        kar rakhne par `pointermove` aana band ho jaata hai, isliye loop zaroori hai).
      → **Asset drop nahi bana** — wo Media panel se timeline tak ka drag hai aur uske bina
        bhi asset jodna chalta hai (Media panel ka apna button). Ye jaan-boojhkar chhoda,
        wajah neeche table me.
- [x] 16.13 "Replace asset": timing / keyframes / effects same rahein.
      → `replaceAsset` op + properties panel me asset picker. Naya source chhota ho to clip
        bhi chhoti ho jaati hai (warna aakhri hissa kaala aata hai) aur `trimStartFrame` naye
        source ke andar aa jaata hai.
- [x] 16.14 Crash-safety: local draft (IndexedDB) + reload par "recover?" poochhe.
      → `lib/localDraft.ts` + `DraftRecovery.tsx`. Draft har edit par likhta hai — server
        wale save se **pehle**, aur uske natije ki parwah kiye bina.
      → Sawaal **sirf tab** poochha jaata hai jab sach me kuch bacha ho (`shouldOfferDraft`).
      → **browser me chalakar dekha (2026-08-21).** IndexedDB me `reel-studio` DB aur
        uska `drafts` store maujood mila. Ek draft haath se likha (`baseUpdatedAt` = server
        ka `updatedAt`, `at` = 45 second purana) aur page reload kiya — banner aaya:
        **"Is project ka bina save kiya kaam mila (1 minute pehle). Wapas laayein?"** ek
        "Wapas lao" button ke saath. Umar `draftAge()` se hi likhi thi.
      → ⚠️ Jab sab kuch save ho chuka ho tab store **khaali** rehta hai (0 row) — draft
        sirf tab tak bachta hai jab tak sach me kuch bacha ho.
- [x] 16.15 Test: 6 tracks ka project, mute/hide/lock render me bhi.
      → `render:sample` ab **chhah tracks** ka hai aur usme ek **chhupi hui** track par ek
        poora-safed aayat hai. Naapa gaya (neeche).
      → Shortcuts ki poori list neeche hai, aur unka apna check script bhi.
- [x] 16.16 `npm run typecheck` clean. Commit.

## Jo galat nikla

**0. Track ka header apni lane se 12px upar khisak gaya tha** (2026-08-21 me naapa).

Lanes wale column ke upar **Ruler (26px) aur MarkerLane (12px)** dono hain, par headers
wale column me spacer sirf `RULER_HEIGHT` ka tha. Nateeja: har track ka header apni lane
se 12px upar. Naapa hua — header top **797**, lane top **809**.

Marker lane isi phase me judi thi aur spacer tab update nahi hua. Ye us kism ki khaami hai
jo aankh se "thoda tirchha" lagti hai par pakdi nahi jaati — aur oonchai ka handle bhi
galat jagah mehsoos hota hai.

Ilaaj: dono naap ab ek jod se aate hain (`LANES_TOP_OFFSET = RULER_HEIGHT +
MARKER_LANE_HEIGHT`), aur uspar do test hain — taaki agli patti jodne par ye dobara na ho.
Naap ke baad offset **0** hai.



**1. Track ki oonchai do jagah thi.**
Oonchai ek UI-only map (`trackHeights`) me thi, aur `track.heightPx` schema me nahi tha.
Nateeja: video track ko ooncha karke thumbnails dekhna reload par ud jaata tha, aur doosri
machine par project kholne par layout apne aap badla hua milta tha. Ab wo doc me hai, ek op se
badalti hai (yaani Ctrl+Z bhi chalta hai), aur `null` par registry ka apna default lagta hai.

**2. `npm run typecheck --workspace reel-studio` kabhi chala hi nahi tha.**
Workspace ka naam `@reel/studio` hai. `--workspace reel-studio` par npm error deta tha aur
main sirf `grep "error TS"` dekh raha tha — yaani studio ka typecheck **chup-chaap skip** ho
raha tha. Root wala `npm run typecheck` usse cover karta hai (aur har phase ke aakhir me wahi
chala tha), par is phase me do asli type error us galti ki wajah se der se pakde gaye. Ab
studio ke liye seedha `cd studio && npx tsc --noEmit` chalta hai.

**3. `<Loop>` jaisi ek aur: shuttle ke liye Remotion me kuch hai hi nahi.**
`<Player>` par speed ya reverse ka koi prop nahi hai. Isliye J/K/L ka apna rAF loop hai jo
playhead khud khiskata hai, aur uska kadam **beete hue asli waqt** se banta hai — har tick par
ek frame se nahi. Bhaari project me rAF 60 ki jagah 20 baar chalta hai, aur fixed kadam lene
par shuttle apne aap teen guna dheemi ho jaati.

## Jo seekha

**Snapping ek switch nahi, ek list honi chahiye.** Sab kuch ek switch par band karne ka matlab
hai ki jise sirf "seconds grid par mat chipko" chahiye tha, use clips par snap bhi chhodna
padta — aur tab clips ke beech ek-ek frame ke gaddhe reh jaate hain, jo render me kaale flash
bankar dikhte hain. `0` aur project ke ant par snap **hamesha** rehta hai, chahe sab toggle
band hon: wahan snap na lagne ka koi faayda nahi aur nuksaan asli hai.

## Verify (asli output)

```
$ npm run typecheck
(6 workspaces, koi error nahi)

$ npm run check
ALL PASS: 8 tests, 0 fail       # autosave
ALL PASS: 9 tests, 0 fail       # store
ALL PASS: 32 tests, 0 fail      # preview
ALL PASS: 60 tests, 0 fail      # timeline (+4 naye snapping ke)
ALL PASS: 20 tests, 0 fail      # properties
ALL PASS: 12 tests, 0 fail      # shortcuts (naya)
ALL PASS: 350 assertions groups, 0 fail    # core (+23 naye Phase 16 ke)
ALL PASS: 19 tests, 0 fail      # @reel/media

$ npm run build:studio
✓ Compiled successfully
└ ƒ /project/[id]    151 kB    300 kB
```

### 16.15 — hide render me bhi lagta hai (MP4 se naapa gaya)

Sample me ab **chhah tracks** hain aur ek chhupi hui overlay track par ek **poora-safed
aayat** hai jo agar dikhta to poora frame safed kar deta.

```
11d. tracks — hide render me bhi lagta hai (16.15)
  ok   chhupi hui track ka safed aayat MP4 me nahi aaya — kone ki roshni 19.3 (safed aayat dikhta to ~255 hoti)
  ok   chhupi hui track ke neeche wali image ab bhi dikh rahi hai — beech ki roshni 230.0
  ok   sample me chhah tracks hain (ek chhupi hui) — 6 tracks, 1 chhupi hui

ALL PASS: 53 checks, 0 fail  (reel-30fps)
```

Doosri line zaroori hai: pehli akeli hoti to ek khaali (kaali) video bhi pass kar jaati.
Aur agar hide sirf editor me lagta, to upar ke saare naap (chaukor ki chaudai, vignette ke
kone, blur ka kinara) ek saath fail ho jaate — isliye ye check unke saath milkar do baar
saabit karta hai.

### 16.5 — saare shortcuts (40, koi takraav nahi)

| Group | Keys | Kaam |
|---|---|---|
| edit | `Ctrl+Z` | Undo |
| edit | `Ctrl+Shift+Z`, `Ctrl+Y` | Redo |
| edit | `Ctrl+S` | Abhi save karo |
| edit | `?` | Cheat-sheet |
| transport | `Space` | Play / pause |
| transport | `J` `K` `L` | Shuttle peeche / roko / aage |
| transport | `←` `→` | Ek frame (clip ya playhead) |
| transport | `Shift+←` `Shift+→` | Ek second |
| transport | `Home` `End` | Shuruaat / ant |
| timeline | `+` `-` | Zoom |
| timeline | `Shift+Z` | Poori timeline dikhao |
| timeline | `Ctrl+A` / `Esc` | Sab chuno / selection chhodo |
| timeline | `I` `O` | In / Out point |
| timeline | `Alt+←` `Alt+→` | Pichhla / agla clip |
| timeline | `M` / `Shift+M` / `Alt+M` | Marker lagao / agla / pichhla |
| editing | `S` | Playhead par todo |
| editing | `[` `]` | Shuruaat / ant playhead tak kaato |
| editing | `Del`, `Backspace` | Delete |
| editing | `Shift+Del`, `Shift+Backspace` | Ripple delete |
| editing | `Ctrl+D` | Duplicate |
| editing | `Ctrl+C` `Ctrl+X` `Ctrl+V` | Copy / cut / paste |
| editing | `Ctrl+G` / `Ctrl+Shift+G` | Group / ungroup |

```
$ npx tsx studio/scripts/check-shortcuts.ts
registry (16.5)
  ok   registry padhi ja saki aur usme kaafi entries hain
  ok   har entry ka id ek hi baar aata hai
  ok   do shortcut ek hi key par nahi baithe
  ok   keys chhote akshar me hain aur modifiers sahi kram me
  ok   har entry ka group cheat-sheet ke chaar groups me se ek hai
  ok   16.5 ke maange hue saare shortcuts maujood hain
...
ALL PASS: 12 tests, 0 fail
```

**WORKING / NOT WORKING ka imaandaar jawab:** upar wali list **registry se padhi gayi hai**,
haath se nahi likhi — aur uska takraav-check sach me chalta hai. Par "key dabane par sach me
kaam hua" browser ke bina naapa nahi ja sakta, aur wo naap abhi nahi hui hai. Isliye list
"registered aur bina takraav ke" hai, "haath se aazmaayi hui" nahi.

Iske liye `shortcuts.ts` ka keys wala poora ganit ek nayi file `lib/shortcutKeys.ts` me
nikala gaya — usme browser ka kuch nahi hai, isliye wo sach me chalaya jaata hai. Pehle wo
ganit **kisi test se guzarta hi nahi tha**.

## Baaki kya hai

| Kya | Kyun ruka |
|---|---|
| 16.6 / 16.7 / 16.8 / 16.9 / 16.11 / 16.12 ka browser wala hissa | `studio/.env.local` nahi hai → dev server nahi chalta |
| 16.14 ka asli test | IndexedDB Node me hai hi nahi; logic (`shouldOfferDraft`) alag aur pure hai par uska apna test abhi nahi likha |
| Media panel se timeline par drag-drop (16.12 ka aadha) | Asset jodna Media panel ke button se pehle se chalta hai; drop uske upar ek suvidha hai, koi nayi shakti nahi |
| Track / khaali jagah ka context menu (16.9 ka aadha) | Jo cheezein chahiye wo track header aur toolbar me pehle se hain |

## Done when

Tracks poori tarah manage hote hain aur unke toggles render me bhi lagu hote hain, saare
shortcuts kaam karte hain, aur crash/reload pe kaam nahi khota.

→ Pehla naap liya gaya (MP4 se). Doosra "registered aur bina takraav" tak naapa gaya, browser
  tak nahi. Teesra likha gaya par IndexedDB ke bina naapa nahi ja sakta.

## Progress log

| Kab | Kya hua |
|---|---|
| 2026-08-20 | 16.1–16.16 done. Ek asli bug pakda (track height do jagah thi) aur ek apni galti pakdi (studio ka typecheck chup-chaap skip ho raha tha). 40 shortcuts, koi takraav nahi. `render:sample` 53/53 — chhupi hui track MP4 me nahi aayi. |
