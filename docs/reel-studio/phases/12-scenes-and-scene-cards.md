# Phase 12 — Scene system + Add Scene + Scene Cards (beginner mode)

**STATUS:** in progress — scene engine poora aur naapa hua; UI likha hua par browser-verify baaki
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 12 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Milestone 1 (Phase 0–11) complete

**Goal:** "koi bhi video bana sake" — Scene Cards mode. Aur **manual scene = AI scene**:
dono bilkul same Project JSON banate hain. Do editor kabhi nahi.

---

## ⚠️ Tick ka matlab (Phase 5-11 jaisa hi)

- **`- [x]`** — chalte hue check se saabit; saboot us item ke neeche `→` me hai.
- **`- [ ]`** — code likha hai aur build hota hai, par asli imtihaan browser me hai.

---

## Checklist

- [x] 12.1 `SCENE_TYPES` registry: har entry `{ id, label, icon, slots, defaults, build(input) }`.
      `build` hi wo jagah hai jahan scene → items banta hai (AI aur manual dono isko call karte hain).
      → [registry/sceneTypes.ts](../../../packages/reel-core/src/registry/sceneTypes.ts) —
      **11 scene types**: image, image_audio, video, screen_recording, text, cta, audio,
      music, overlay, shape, subtitle.
      ⚠️ **`character` aur `lipsync` jaan-boojhkar nahi hain.** Checklist me unke naam hain,
      par unke peeche ka system Phase 22 (TTS) aur Phase 24 (lip-sync) me hai. Aaj unki
      khaali entry daalna matlab UI me do aise card dikhana jinhe chunte hi kuch nahi hota —
      wahi fake feature jisse README rule 5 bachne ko kehta hai. Un phases me ye yahan
      judegi aur UI me apne aap aa jaayengi.
      Test (4): har type ke required slots ke bina `build()` **khaali** lautta hai (isi par
      `addScene` ka saaf error tika hai); **har build apne saare items par `sceneId` lagata
      hai** (ek bhi chhoot jaaye to wo item card se gayab aur timeline me anaath); music ka
      volume apne aap kam (poore volume par wo voiceover dabaa deta hai); aur screen
      recording `contain` + blurred background par aati hai (`cover` par app ka aadha screen
      kat jaata hai, jo us scene ka poora matlab hi khatam kar deta hai).

- [x] 12.2 `slots` declarative — slot definitions se UI khud banega.
      → `SlotDef { id, label, kind, required, hint, multiline }`. `kind` par UI apna control
      chunta hai: `text` par khaana, `asset:image` par picker jo sirf images dikhata hai.
      Test: `missingRequiredSlots()` sahi list deta hai, aur **khaali string bhi "nahi
      bhara" ginti hai** — warna khaali text scene ban jaata.

- [x] 12.3 `addScene(doc, typeId, input)` op: items banao, `scenes[]` me entry, tracks
      auto-assign (na mile to naya banao), timeline ke end me place karo.
      → Test (4): scene jodne par items bante hain aur **har item ko track milta hai**;
      **track na ho to naya ban jaata hai** (khaali project me text ka track hota hi nahi,
      aur beginner ne "track" shabd bhi nahi suna hota — error dena Scene Cards mode ko
      adhoora chhod deta); zaroori slot bina bhare saaf error; aur naye scene ek ke baad ek
      lagte hain, ek doosre ke upar nahi.

- [x] 12.4 Scene ops: reorder, duplicate, delete, setSceneDuration, replaceSceneAsset,
      setSceneText. **Sab named ops, sab undo-able.**
      → 7 naye ops. Asset replace aur text edit dono ek hi op se (`setSceneSlot`) — slot ka
      `kind` tay karta hai kya badlega.
      ⚠️ **`setSceneSlot` scene ko dobara nahi banata.** Rebuild karna aasan lagta hai
      (`build()` to hai hi), par wo user ki har manual edit mita deta — jo tasveer usne
      timeline me sarka kar theek ki thi wo wapas apni jagah chali jaati. Uska apna test
      hai: **items ke id badalne nahi chahiye.**
      `setSceneDuration` me `proportional` ek **chunaav** hai, default nahi: "Image + awaaz"
      me aksar sirf tasveer lambi karni hoti hai aur awaaz waisi hi rehni chahiye (wo ek
      recording hai, use kheenchna use bigad deta hai). Dono ka apna test hai.

- [x] 12.5 Scene reorder ripple — spec ka apna example.
      → `relayoutScenes()` har scene op ke baad chalta hai. **Ye is poore phase ka sabse
      nazuk hissa hai**: swap ke baad frames dobara na ginne par ya to scenes ek doosre par
      chadh jaate hain, ya beech me gaddha reh jaata hai aur video me kaali khaamoshi aati
      hai — dono ek baar dekhne par pakde nahi jaate.
      Test (4), spec ke apne doc par: `[Rahul][Papa][Problem][App][CTA]` →
      **`[Rahul][Problem][Papa][App][CTA]`**, aur uske baad har jod par
      `start[i] === end[i-1]` (koi gaddha nahi, koi overlap nahi), pehla scene 0 se, aur kul
      lambai wahi. Pehle scene ko aakhir me bhejna bhi alag se jaancha gaya.

- [ ] 12.6 **Scene Cards UI**: card list, duration edit, inline text, asset replace,
      up/down/duplicate/delete, "Edit in timeline".
      → code maujood hai, browser me chalaya nahi.
      [SceneCards.tsx](../../../studio/components/editor/scenes/SceneCards.tsx) +
      `SceneSlotRow` + `AssetPicker`.
      ⚠️ **Audio ke liye README 3C ka niyam laga hua hai**: abhi sirf **Upload** ka raasta
      hai (Media panel se aayi file chuno). "Generate" aur "Both" ke button **hain hi
      nahi** — TTS Phase 22 me aayega, aur aisa button jo dabate hi kuch na kare sabse bura
      hota hai.
      ⚠️ Asset picker me **upload nahi hai**. Upload ka poora chakkar (progress, cancel,
      retry, duplicate detect) Media panel me hai; usko yahan dobara likhna do jagah do
      vyavhaar bana deta. Dialog me saaf likha hai ki file pehle Media panel se aati hai.

- [ ] 12.7 "+ Add Scene" panel: registry se type grid, phir uske slots ka form.
      → code maujood hai, browser me chalaya nahi.
      [AddScenePanel.tsx](../../../studio/components/editor/scenes/AddScenePanel.tsx) —
      grid aur form **dono registry se**. Yahan kisi scene type ka naam likha hi nahi hai.
      "Scene jodo" tab tak disabled rehta hai jab tak required slots na bharein, aur tooltip
      me likha hota hai kya chahiye.

- [x] 12.8 **Two-way sync** + "Custom edited" badge.
      → Sync jaisi koi cheez likhi hi nahi gayi, aur yahi asli jawab hai: card aur timeline
      **ek hi doc** par hain aur dono wahi named ops bulate hain. Isliye card me duration
      badalte hi timeline hilta hai aur ulta bhi — bina kisi sync code ke.
      `isSceneCustomEdited()` teen halat pakadta hai: doosre scene ki clip beech me ghusi
      hui, scene ke andar gaddha, **aur card ka kram timeline ke kram se alag**.
      ⚠️ Teesri jaanch **test likhte waqt judi**. Pehle sirf overlap aur gaddha dekha jaata
      tha, aur ek asli halat chhoot rahi thi: `push` policy ke saath ek clip peeche sarkane
      par koi overlap banta hi nahi (baaki sab aage khisak jaate hain) — par card #1 ab
      timeline ke #4 par baitha hota hai. Card list aur video ka kram alag, aur user ko kuch
      dikhta hi nahi.
      Ek aur baat test se nikli: **overwrite policy doosre scene ki clip kha sakti hai** aur
      wo scene khaali reh jaata hai. Usko rokna galat hoga (user ne jaan kar kiya), par chup
      rehna bhi galat — `repairScenes` khaali scene hata deta hai. Uska apna test hai.

- [ ] 12.9 Mode toggle TopBar me — same project, same doc, koi conversion nahi. Choice
      per-project yaad rahe.
      → code maujood hai, browser me chalaya nahi. Toggle sirf ek flag badalta hai
      (`uiSlice.mode`), aur chunaav `localStorage` me **per project** yaad rehta hai.
      ⚠️ Mode doc me **nahi** jaata: wo is machine par kaam karne ka tarika hai, project ka
      data nahi. Doc me daalne par teen cheezein kharaab hoti — Ctrl+Z mode badal deta, mode
      badalna autosave chalata, aur ek project do machine par khole to dono ek doosre ka
      view badalte rehte.

- [ ] 12.10 Beginner mode me preview + export dono available hon.
      → dono hain: `PreviewStage` mode ke bahar hai (dono me dikhta hai) aur Export TopBar me.
      Browser me dekha nahi gaya.

- [ ] 12.11 Scene-level animation/transition dropdown jo scene ke primary item pe apply ho.
      → **nahi banaya, aur wajah likh raha hoon.** Phase 10 ka `AnimationSection` pehle se
      har item par animation lagata hai, aur "Edit in timeline" ek click me us scene ki
      clips chun deta hai — yaani kaam ho jaata hai, bas ek click zyada.
      Scene-level dropdown ka asli sawaal ye hai ki "primary item" kaun hai (image_audio me
      image? caption? dono?) — aur us faisle ko galat karne par user ko lagta hai animation
      lagi hi nahi. Ye Phase 17 (templates) ke saath behtar baithega, jahan scene ki apni
      styling ki poori soch aayegi.

- [ ] 12.12 Orphan/consistency guard + "Fix" button.
      → `validateSceneIntegrity()` (4 kism ki gadbad) + `repairScenes` op; card list ke upar
      warning aur "Theek karo" button.
      ⚠️ **Repair kuch delete nahi karta.** Orphan item ka `sceneId` khaali ho jaata hai (wo
      timeline par apni jagah rehta hai) aur gayab id list se hat jaati hai. Kisi ki clip
      mita dena "repair" nahi hota — wo ek aur nuksaan hota. Uska apna test hai:
      **repair ke baad items ki ginti wahi rehni chahiye.**
      Test (4): saaf doc me koi shikayat nahi; timeline se clip delete karne par khaali scene
      banta hai aur repair use hata deta hai; anaath item bacha rehta hai; anjaan scene type
      par shikayat aati hai.

- [ ] 12.13 Test: sirf Scene Cards se 25s reel banao, reorder/duplicate/replace/duration,
      export, phir timeline me confirm karo.
      → **nahi hua** — `studio/.env.local` ke bina dev server uth nahi sakta.
      Jo ho saka: poora scene engine script se naapa gaya (upar ke saare test), aur usme
      spec ka apna reorder example bhi hai.

- [x] 12.14 `npm run typecheck` clean + core check me scene op assertions.
      → typecheck clean (6 workspaces); core check **213 se 238 assertion groups**.

- [ ] 12.15 Commit. → ho chuka; box 12.13 ke baad tick hoga.

## Verify (asli output paste karna)

```
$ npm run check --workspace @reel/core
ALL PASS: 238 assertions groups, 0 fail          (pehle 213)

$ npm run check   # poora
studio 8 / 9 / 32 / 55 / 20, core 238, media 16 — sab 0 fail

$ npm run typecheck        # 6 workspaces, exit 0
$ npm run build:studio     # ✓ Compiled; /project/[id] 134 kB -> 137 kB

# Ye tab, jab studio/.env.local aa jaaye:
npm run dev:studio   # Scenes mode se poori reel, phir Timeline me confirm
```

## Done when

Bina timeline chhue ek poori reel ban jaati hai aur export hoti hai; scene ops sab undo-able
hain; aur beginner/advanced dono view ek hi doc pe two-way synced hain.

**Doosra aur teesra hissa saabit ho chuka hai** (ops ke test, aur "sync" ka na hona hi uska
jawab hai). Pehla hissa browser ke intezaar me hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| 2026-08-20 | Poora scene system. **Core:** `SceneSchema` me `type` + `slots` jude (dono par `.default()` — purane docs bina migration ke chalte rehte hain); naya `registry/sceneTypes.ts` (11 types, har ek ka `build()`); 7 naye ops (`addScene`, `reorderScenes`, `duplicateScene`, `deleteScene`, `setSceneDuration`, `setSceneSlot`, `repairScenes`) plus `validateSceneIntegrity()` aur `isSceneCustomEdited()`. **Studio:** `SceneCards`, `AddScenePanel`, `SceneSlotRow`, `AssetPicker`; TopBar me Scenes/Timeline toggle; mode per-project localStorage me. Ek circular import bhi theek kiya: `registry -> sceneTypes -> factory -> registry` ka chakkar ban gaya tha aur factory ka top-level `registerBuiltins()` aadhe bane hue module par chal padta tha. | `npm run check --workspace @reel/core` → `ALL PASS: 238 groups` (213 se); poora `npm run check` → sab 0 fail; `npm run typecheck` → 6 workspaces exit 0; `npm run build:studio` → 134 → **137 kB** | 12.6/12.7/12.9/12.10/12.13 — browser par. 12.11 jaan-boojhkar chhoda (Phase 17 ke saath). |
