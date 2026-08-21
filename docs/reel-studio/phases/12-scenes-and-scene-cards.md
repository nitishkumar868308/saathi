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

- [x] 12.6 **Scene Cards UI**: card list, duration edit, inline text, asset replace,
      up/down/duplicate/delete, "Edit in timeline".
      → **poora browser me chalaya (2026-08-20).** Har card me ye sab sach me mila aur
      sach me chala:
      * header me scene ka number + type ka naam, aur chaar button —
        **Upar / Neeche / Duplicate / Delete** (pehle card par "Upar" **disabled** hai,
        jo theek hai: sabse upar wale ko upar nahi le ja sakte);
      * **Tasveer \*** slot thumbnail ke saath aur **Badlo…** se asset replace;
      * **Caption** ka inline text box (`Screen par dikhne wala text (khaali chhod sakte ho)`);
      * **Lambai** — second me number field + saath me `150f` (frames), aur ek
        `sab items` checkbox;
      * **Timeline me edit** button;
      * card ke neeche uska apna hisaab: `1 clip · 0.0s se 5.0s`.

      Duration edit sach me lagti hai: `4` se `5` karne par card `150f` dikhane laga,
      uska range `0.0s se 5.0s` hua, **aur neeche ke saare scenes apne aap khisak gaye**
      (`5.0s se 9.0s`, …). DB me bhi `dur: 120 → 150`.

      ⚠️ Ek baat test karte waqt saamne aayi jo likh deni chahiye: `NumberField` value ko
      **Enter ya blur par** commit karta hai, typing par nahi. Ye theek hai (adhoora
      number type karte waqt har keystroke par op chalana bura hota), par iska matlab ye
      bhi hai ki agar koi number type karke bina Enter/blur ke card se hat jaaye to
      badlaav **nahi** lagta.

- [x] 12.7 "+ Add Scene" panel: registry se type grid, phir uske slots ka form.
      → **browser me chalaya (2026-08-20).** Grid me **11 scene types**, chaar group me,
      sab registry se:

      ```
      MEDIA    Image · Image + awaaz · Video · Screen recording
      TEXT     Text · CTA · Subtitle
      AUDIO    Sirf awaaz · Music
      SPECIAL  Overlay · Shape
      ```

      Panel ke neeche khud likha hai: *"11 scene types · sab wahi ops chalate hain jo
      timeline chalata hai, isliye Ctrl+Z yahan bhi kaam karta hai"*.

      Type chunte hi uske slots ka form aaya — `Tasveer *` (zaroori, taare ke saath) aur
      `Caption` (marzi). **"Scene jodo" button disabled tha** aur uska tooltip theek wahi
      keh raha tha jo chahiye: **`Pehle ye bharo: Tasveer`**. Asset chunte hi button
      enable ho gaya.

      Asset picker bhi slot se bandha hua hai: `Tasveer` ke liye khulne par usme **sirf
      images** dikhi (PRIYA/RAHUL/PAPA/MAA + img-4k/1080p/480p) — audio aur video apne
      aap chhant gaye.

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

- [x] 12.9 Mode toggle TopBar me — same project, same doc, koi conversion nahi. Choice
      per-project yaad rahe.
      → **browser me dono taraf aaya-gaya (2026-08-20).** TopBar me `Scenes | Timeline`
      toggle hai. Scene Cards se banayi hui 6-scene reel Timeline par jaate hi
      **`2 track · 6 item`** ban kar dikhi — wahi clips, wahi jagah, koi conversion step
      nahi, koi "import" nahi. Wapas Scenes par aane par cards waise ke waise the.

- [x] 12.10 Beginner mode me preview + export dono available hon.
      → **browser me dekha (2026-08-20).** Scenes mode me preview bilkul upar chalti rahi
      (transport bar ke saath — `00:00:00:00 / 00:00:30:00 · frame 0/900`), aur TopBar ka
      **Export** button bhi wahin tha. Export **Scenes mode se hi** chalaya gaya aur poora
      hua (neeche 12.13).

- [x] 12.11 Scene-level animation/transition dropdown jo scene ke primary item pe apply ho.
      → **ban gaya (2026-08-21).** Rukawat ek hi thi — "primary item kaun hai?" — aur uska
      jawab ab **core me, apne test ke saath** hai: `primarySceneItem()`
      ([scenes/primary.ts](../../../packages/reel-core/src/scenes/primary.ts)).
      Niyam ek line ka hai: **scene ke apne kram me pehla aisa item jo awaaz nahi hai aur
      caption nahi hai** — yaani jo sabse peeche poori screen par dikhta hai.
      → Kram `scene.itemIds` se aata hai, `doc.items` se **nahi** — warna timeline par ek
      clip khiskane se primary chup-chaap badal jaata, jabki user ne sirf clip sarkayi thi.
      Iska apna test hai (doc.items ulta karke bhi primary wahi rehta hai).
      → UI `SceneAnimation.tsx` me hai aur wo koi naya engine nahi hai — wahi `addAnimation`
      aur `setTransition` ops jo Properties panel chalata hai. Card par likha rehta hai kis
      item par lagega (`→ Image`), taaki andaaza na lagana pade.
      → Jis scene me dikhne layak kuch nahi (sirf awaaz), wahan dropdown **dikhta hi nahi** —
      uski jagah: *"Is scene me dikhne wali koi cheez nahi hai — animation lagane ke liye
      pehle tasveer, video ya text jodo."*
      → **Browser me chalakar dekha:** teen scene wale fixture par — `image_audio` ka primary
      `→ Image` (awaaz/caption nahi), `text` scene ka primary uska text, aur sirf-awaaz wale
      scene par upar wali line. "Ken Burns" chunte hi doc me **image item par** `kenburns`
      aaya, aur transition `fade` bhi usi image par lagi. Fixture baad me mita diya gaya.
      → ⚠️ **Ek asli galti yahin pakdi gayi:** pehle dropdown `applyAnimationPreset` bulata
      tha par bhejta tha `listAnimations()` ki id. Wo do alag list hain — op chup-chaap kuch
      nahi karta tha aur dropdown wapas "Koi nahi" par aa jaata. Transition lag rahi thi aur
      animation nahi — isi farak se pakda gaya. Ab `addAnimation` chalta hai.

- [x] 12.12 Orphan/consistency guard + "Fix" button.
      → **jaanch kar dekha (2026-08-20), aur jo mila wo umeed se behtar nikla.**

      Test ke liye DB me jaan-boojhkar do orphan daale: ek scene ki list me aisi item id
      jo kisi item ki nahi, aur ek item ka `sceneId` aisa jo kisi scene ka nahi. Nateeja:

      **Doc parse hi nahi hua** — pehra `validateSceneIntegrity()` se pehle, **schema me**
      hai, aur uske message bilkul saaf hain:
      ```
      items[1].sceneId    : Item "it_mt177zle4w3e6" ka scene "sc_gayab-scene" maujood nahi hai
      scenes[0].itemIds[1]: Scene "sc_mt17236j11r80" ek gayab item "it_gayab-item" ko point kar raha hai
      ```
      Dono me **asli id** likhi hai, "invalid document" jaisa kuch nahi. Yaani orphan wala
      doc DB se aaye to wo chup-chaap khulta nahi — ye README rule ka sabse achha roop hai.

      Card list ke upar wali chetavni + **"Theek karo"** button (`repairScenes`) us haalat
      ke liye hai jo **session ke beech** ban sakti hai, save hone se pehle. Uske apne test
      pehle se pass hain, aur unme sabse zaroori ye hai: **repair ke baad items ki ginti
      wahi rehni chahiye** — orphan item ka `sceneId` khaali hota hai, wo timeline par apni
      jagah rehta hai. Kisi ki clip mita dena "repair" nahi hota.

      ⚠️ **Ek baat likh deni chahiye:** in dono pehron ke beech ek jagah khaali hai. Agar
      kisi wajah se orphan wala doc DB me pahunch hi jaaye (jaise abhi maine haath se
      daala), to project **khulta hi nahi** — aur "Theek karo" button tab kaam nahi aata,
      kyunki us button tak pahunchne ke liye project khulna zaroori hai. Abhi wo raasta
      band hai kyunki har save `parseDoc` se guzarta hai; par agar kabhi wo khulta hai to
      us doc ko theek karne ka koi tarika UI me nahi hai.

- [x] 12.13 Test: sirf Scene Cards se 25s reel banao, reorder/duplicate/replace/duration,
      export, phir timeline me confirm karo.
      → **poora ho gaya (2026-08-20), aur Timeline ko ek baar bhi haath nahi lagaya.**

      **1. 25s reel — sirf cards se.** Khaali project me 5 baar
      `Image` → `Chuno…` → asset → `Scene jodo`. Har scene default 120 frame (4s) ka bana,
      phir har card ki **Lambai 4 → 5 second** ki. Nateeja DB me:

      ```
      scenes: 5 | items: 5 | duration: 750 frames = 25.0s
       1. PRIYA.png @0   (150f)
       2. RAHUL.png @150 (150f)
       3. PAPA.png  @300 (150f)
       4. MAA.png   @450 (150f)
       5. PRIYA.png @600 (150f)
      ```

      **2. reorder** — card 1 ka "Neeche": PRIYA 1st se 2nd par gayi, RAHUL 1st ho gaya
      (time me: RAHUL @0, PRIYA @150).

      **3. duplicate** — card 2 ka "Duplicate": nayi scene uske theek baad @300 par aayi,
      ginti 5 → 6, lambai 750 → 900 frame (30s).

      **4. replace** — pehle card ka **Badlo…** → `img-1080p.png`: us scene ka asset
      RAHUL se badal gaya, jagah aur lambai waisi ki waisi.

      **5. export** — TopBar ke Export se, `standard` preset par. Worker ne uthaya
      (`job ad1a455f… uthayi (render, preset standard)`) aur poora kiya —
      **5.6 MB, 41.5s**. Renders panel me: `HO GAYA · standard · 1080x1920 · h264 High ·
      yuv420p · aac 48000Hz 2ch · 5.3 MB · 41.5s me bani`, saath me Download button.

      **6. timeline me confirm** — mode toggle se Timeline par: **`2 track · 6 item`**,
      pehli clip 0–5s par **hari** (yaani `img-1080p.png`, replace sach me laga), uske
      baad PRIYA ki film-strip, aur poori lambai `00:00:30:00 / frame 0/900`.

      ⚠️ **Reel 25s se badhkar 30s ho gayi** — kyunki checklist reorder/duplicate/replace
      dono maangti hai aur duplicate ne ek 5-second scene jod diya. 25.0s wali haalat upar
      table me darj hai (duplicate se pehle).

- [x] 12.14 `npm run typecheck` clean + core check me scene op assertions.
      → typecheck clean (6 workspaces); core check **213 se 238 assertion groups**.

- [x] 12.15 Commit.
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
