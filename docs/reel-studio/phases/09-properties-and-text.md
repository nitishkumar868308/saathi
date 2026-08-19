# Phase 9 — Generated properties panel + text items

**STATUS:** in progress — panel poora aur naapa hua, browser-verify baaki (9.14)
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 9 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 8 complete

**Goal:** right sidebar jo **registry ke controls descriptor se khud ban jaaye** — kisi type
ke liye haath se panel likhna mana. Plus text layers poore control ke saath.

---

## ⚠️ Tick ka matlab (Phase 5-8 jaisa hi)

- **`- [x]`** — chalte hue check se saabit; saboot us item ke neeche `→` me hai.
- **`- [ ]`** — code likha hai aur build hota hai, par uska asli imtihaan baaki hai
  (browser ka pointer, ya `studio/.env.local`).

**Is phase ki khaas baat:** panel ka poora vaada ek hi line me hai — *naya item type = zero
panel code*. Wo vaada aankh se jaancha hi nahi ja sakta, isliye check me ek **bilkul naya,
banawati item type** registry me daal kar dekha jaata hai ki uske controls apne aap panel me
aa gaye ya nahi. Yahi "Done when" ki asli maang bhi hai.

---

## Checklist

- [x] 9.1 `PropertyPanel`: selected item ka type registry se lo, uske `controls[]` descriptor
      pe map karke UI banao. Naya item type = zero panel code.
      → [PropertiesPanel.tsx](../../../studio/components/editor/properties/PropertiesPanel.tsx).
      Poore panel me **kisi item type ka naam likha hi nahi hai** — na `text`, na `image`.
      Test: "bilkul naya type registry me daalne par uske controls panel me aa jaate hain" —
      ek banawati `sticker_test` type 4 controls (slider/text/enable/color) ke saath register
      hota hai, aur bina kisi naye code ke uske controls, uska section, uska `when` wala
      chhupna aur uski default value — chaaron chal jaate hain.

- [x] 9.2 Control components (`studio/components/controls/`): `slider`, `number`, `text`,
      `textarea`, `color`, `select`, `toggle`, `xy-pad`, `font-picker`, `range`, `easing-picker`.
      Har control `{path, value, onChange}` interface pe chale.
      → [components/controls/index.tsx](../../../studio/components/controls/index.tsx) me
      `CONTROL_COMPONENTS` ek **registry** hai (`ControlKind` → component); panel me
      `if (control === "slider")` jaisi ek bhi line nahi.
      Test: "har ControlKind ka ek component registry me hai" — `CONTROL_KINDS` ab core me
      ek **asli array** hai (type usi se banta hai), isliye nayi kism type me aane par test
      turant pakad leta hai. Ek bhi chhoot jaaye to uska control chup-chaap text ban jaata
      hai, aur wo galti sirf us type par dikhti hai jise koi kabhi khole.
      ⚠️ Naam thode alag hain aur ye jaan-boojhkar hai: `xy-pad` ki jagah `vector2`
      (anchor/crop dono usi se chalte hain) aur `range` ki jagah `slider` ka min/max —
      teesra component banane se teen jagah maintain karna padta. `easing-picker` **abhi
      nahi hai**: easing sirf keyframes par lagti hai, aur wo Phase 13 hai — aaj uska control
      dikhana ek aisa button hota jo kahin lagta hi nahi.

- [x] 9.3 Value read/write **path se** (`transform.scale`) — `getByPath`/`setByPath` helper,
      aur write `applyOp('setItemProperty', ...)` se (undo ke liye).
      → padhna `commonValue()` se (`getByPath`), likhna **`setItemsProperty`** op se — jo
      multi-select ke liye naya hai (9.5). Ek slider ghumane par bhi op chalta hai, isliye
      Ctrl+Z har chhoti edit wapas laata hai.
      ⚠️ Yahan ek **asli bug pakda aur theek kiya**: op pehle sirf root path (`text`) ko
      `undefined` se compare karta tha. Image par `text` `null` hota hai, `undefined` nahi —
      isliye jaanch paas ho jaati thi aur `setByPath` image par `text: { color: "…" }` bana
      deta tha: ek aisa item jo schema ke hisaab se toota hua hai, aur ye save hone ke baad
      hi pakda jaata. Ab **parent** dekha jaata hai, aur uska apna test hai jo `safeParseDoc`
      se poora doc bhi jaanchta hai.

- [ ] 9.4 Drag-to-change on number inputs, arrow keys se step, Shift se bada step,
      double-click se reset-to-default (default registry se).
      → code maujood hai, browser me ghaseeta nahi.
      [NumberField.tsx](../../../studio/components/controls/NumberField.tsx) — label ghaseeto
      (har 3px par ek step), arrow keys, Shift se dus guna, double-click se reset.
      **Default ka hissa naapa hua hai** (2 test): default kahin likhi nahi jaati — ek bilkul
      naya item banakar usi path se padh li jaati hai, isliye transform/fit/audio/text/shape
      sabki default apne aap sahi rehti hai aur registry me badalne par reset bhi badal jaata
      hai. Anjaan path par `undefined`, chupchaap 0 nahi.
      ⚠️ Drag ka hisaab **shuruaati value** se hota hai, maujooda se nahi — maujooda se karne
      par har pointermove pichhle nateeje par judta hai aur value ungli se kai guna tez
      bhagti hai. Aur arrow keys wahin ruk jaati hain (`stopPropagation`), warna wo poore
      editor tak pahunch kar playhead/clip bhi hila deti (6.4 / 8.10).

- [x] 9.5 Multi-select editing: common properties dikhao, mixed values pe "—" dikhao,
      badalne pe sab pe apply (ek undo entry).
      → `commonControls()` sirf wo controls rakhta hai jo **har** chune hue item par hain,
      aur `commonValue()` alag values par `MIXED` deta hai. Ek op (`setItemsProperty`) —
      isliye paanch clips ka rang badalne par ek hi Ctrl+Z.
      Test (8 + 4): `MIXED` aur `null` **alag cheezein** hain (stroke `null` ka matlab
      "stroke nahi hai", "alag-alag hai" nahi); gehri tulna hoti hai isliye ek jaisa object
      galti se MIXED nahi nikalta; anchor jaisi array bhi sahi compare hoti hai; text+image
      par font ka control gayab ho jaata hai; op me locked item chhoot jaata hai; aur jis
      item par wo property hai hi nahi wo bhi (upar wala bug).

- [x] 9.6 **Size & Fit section (README 3B):** x, y, scale, rotation, opacity, anchor, crop
      (numeric abhi; visual crop Phase 15 me), aur **fit mode**: `cover` / `contain` /
      `fill (stretch, warning ke saath)` / `custom`. `contain` ke background options: solid
      color, brand color, **blurred copy of the asset**, gradient.
      → registry me poore controls jud gaye: `transform.anchor` (vector2), `transform.crop`
      (enable + 4 slider, 0-1 me — pixels me nahi, taaki project ka size badalne par crop na
      toote), aur `fit.background.value` ke **teen roop** — color picker, brand ka select
      (token save hota hai, hex nahi), aur gradient ki CSS.
      Fit mode ke chaaron pehle se `FIT_MODES` se aate hain, `fill` apni warning ke saath.

- [x] 9.6b Auto-fit buttons: "Fit to frame", "Fill frame", "Fit width", "Fit height",
      "Center", "Reset" — ek click, undo-able op. Aspect mismatch detect ho to panel khud
      suggest kare.
      → buttons `AUTO_FIT_ACTIONS` **list** se bante hain (chhah ke chhah), aur naya op
      **`applyAutoFit`** chaaron property (fit mode + scale + x + y) ek hi undo entry me
      lagata hai — chaar alag `setItemProperty` chalane par Ctrl+Z aadha fit chhod deta,
      jo poore fit se bhi bura dikhta hai. Aspect mismatch par `suggestFit()` ki salah aur
      "Ye laga do" button.
      Test (3): chaaron property ek saath lagti hain; `scale: null` par ("Center") scale ko
      haath nahi lagta; aur chhah ke chhah action ka nateeja seedha patch banta hai —
      "Center" wala `NaN` case bhi shaamil.
      ⚠️ Patch **UI banata hai, op nahi** — uske liye source ke asli pixels chahiye jo
      `reel_assets` me hain, doc me nahi. Op ko DB ka pata nahi hona chahiye.

- [x] 9.6c Har item ka **effective resolution readout** dikhao (source px vs frame px vs
      current scale) — A1 quality rule ka live feedback. Upscale > 100% pe warning color.
      → `resolutionReadout()` **wahi** `computeFit` + `checkUpscale` chalata hai jo render
      chalata hai — panel ka apna hisaab likhna matlab do sach, aur unme se ek hamesha galat.
      Test (4): bade source par koi warning nahi; 640×480 ko 9:16 me daalne par 4x upscale
      aur "dhundhli" wali saaf chetavni; **user ki scale bhi ginti me aati hai** (bilkul theek
      naap wali image bhi 2x zoom par upscale hai — yahi case export tak chhupa reh jaata
      tha); aur readout ka nateeja `computeFit` se milta hai.

- [ ] 9.7 Timing section: start frame, duration, end frame, trim start — numeric edit bhi
      chale (timeline drag ke alawa), timecode input format accept kare.
      → UI maujood hai, browser me type nahi kiya. **`parseTimecode()` naya hai aur poora
      naapa hua** (6 test): `"90"` / `"12:05"` / `"01:12:05"` / `"00:01:12:05"` chaaron roop;
      aakhri hissa hamesha **frames** hai (`12:05` = 365 frames, 12.05 second nahi — ye sabse
      aam galti hoti); 24/25/30/60 har fps par sahi; galat input par **`null`, 0 nahi**
      (chupchaap 0 lagana ek typo par clip ko shuruaat me phenk deta); hadd se bahar wale
      hisse mana; aur `framesToTimecode` ke saath aana-jaana 4 fps × 5 values par barabar.

- [x] 9.8 Audio section (audio/video items): volume, mute, fade in/out (frames me).
      → chaaron controls Phase 1 se registry me the (`AUDIO_CONTROLS`), aur ab panel unhe
      apne aap dikhata hai — `volume` slider, `muted` toggle, dono fades number me.
      Volume par "1 se upar clipping ka khatra" wali help pehle se likhi hai.

- [x] 9.9 **Text item full support:** content (multiline), font family, size, weight, line
      height, letter spacing, color, align, vertical align, stroke (width+color), shadow
      (x,y,blur,color), background box (padding, radius, color, opacity), max width +
      auto-wrap, uppercase toggle.
      → saare controls registry me jud gaye. Stroke / shadow / background box teeno
      **nullable** hain, isliye unke liye ek nayi control kism aayi: **`enable`** — uska
      "off" `false` nahi **`null`** hota hai (toggle se `false` likhne par schema hi toot
      jaata), aur uske andar ke controls `when: { isSet: true }` se dikhte hain.
      ⚠️ **Renderer me ye sab pehle se hai** — maine `TextItem.tsx` khol kar dekha:
      `WebkitTextStroke`, `textShadow`, background box aur `verticalAlign` chaaron sach me
      render hote hain. Isliye ye controls fake nahi hain (README rule 5).
      Test (3): stroke ke andar wale controls tabhi dikhte hain jab stroke on ho; `controlVisible`
      ki dono shart (`equals` aur `isSet`); aur shape ka radius sirf rect par.
      **Opacity** background box par nahi hai — schema me wo field hai hi nahi (rang me alpha
      likha ja sakta hai). Naya field jodna schema migration hai, aur wo is phase ka kaam
      nahi tha.

- [ ] 9.10 Fonts **dynamic**: `studio/public/fonts/` + ek `fonts.json` registry; font load
      preview me aur render me **same** ho. Missing font pe saaf warning.
      → asli font file ke bina browser-verify nahi ho sakta, par poora dhaancha bana aur
      naapa hua hai. [config/fonts.ts](../../../packages/reel-core/src/config/fonts.ts) me
      list **core me** hai, aur `@font-face` ka CSS bhi wahi ek function banata hai
      (`fontFaceCss`). Wahi string dono jagah lagti hai: studio `<Player inputProps.fonts>`
      se bhejta hai, worker `RenderRequest.fonts` se — aur composition khud apne andar
      `<style>` lagati hai (bahar rakha CSS render ke page tak pahunchta hi nahi).
      Test (5): built-in sirf **system fonts** hain (koi file nahi maangte); `mergeFonts`
      wahi id dobara aane par list nahi badhati; `@font-face` sirf un fonts ka banta hai
      jinki file hai, `font-display: block` ke saath (warna text pehle kisi aur font me
      dikh kar badal jaata — wo "flash" render me ek-do frame par pakda jaata hai); family
      stack me hamesha fallback rehta hai; aur missing font pehchana jaata hai par **brand
      token nahi** (wo render ke waqt asli naam me badalta hai).
      Missing font ki chetavni preview ki patti me naam ke saath aati hai.
      ⚠️ **Repo me koi font file commit nahi hai** — font ki apni licensing hoti hai. Apna
      font jodna do kadam ka kaam hai: file `studio/public/fonts/` me, aur ek entry
      `fonts.json` me. Code me kahin kuch nahi badalta.

- [x] 9.11 Shape item: rect/rounded-rect/circle/line, fill, stroke, radius, opacity —
      overlays aur text background ke kaam aata hai.
      → `shape.stroke` (enable + color + width) registry me juda; kind/fill/width/height/
      radius pehle se the, aur opacity `transform.opacity` se aati hai (har visual item par).
      Radius sirf `rect` par dikhta hai (`when`) — uska test bhi hai.
      Renderer (`ShapeItem.tsx`) me teeno kind aur stroke pehle se hain.

- [x] 9.12 Brand tokens: color pickers me brand palette shortcuts dikhein aur value
      `brand.primary` jaisi token save ho (Phase 17 ka base). Render time pe resolve.
      → har color control ke neeche brand ki chips hain, aur chip dabane par **token** save
      hota hai (`brand.primary`), hex nahi. Token hone par khaana amber me dikhta hai taaki
      farak saaf rahe. Render time par `resolveToken` pehle se lagta hai.
      Isi ek baat par poora Phase 17 tika hai: brand badalne se saari reels badal jaayein.

- [ ] 9.13 Project settings panel: name, resolution preset, fps, background, duration —
      badalne pe items proportionally handle karne ka option (poochho, chupchaap mat karo).
      → UI maujood hai, browser me chalaya nahi. Do naye op —
      **`setProjectSize`** (`refit` flag ke saath) aur **`setProjectFps`** (`rescaleItems`
      ke saath) — aur panel dono par **poochhta hai**, chupchaap kuch nahi chunta.
      Test (6): bina `refit` ke items chhute nahi; `refit` par 1080×1920 → 540×960 me x aur
      scale dono aadhe; bahut chhote naap par saaf error; bina `rescaleItems` ke frames waise
      ke waise; `rescaleItems` par har clip ka **waqt (seconds) waisa hi** rehta hai; aur
      keyframes bhi saath jaate hain (30fps ka frame 30 → 60fps par frame 60, warna animation
      aadhe waqt me khatam ho jaati).
      **Duration ka khaana abhi disabled hai** aur wajah likhi hui hai: lambai aakhri clip ke
      ant se apne aap banti hai (8.14), uska apna control Phase 11 me export ke saath aayega.
      Aisa khaana dikhana jo kaam na kare, README rule 5 ka ulta hota.

- [ ] 9.14 Test: text item banao, stroke+shadow+background lagao, ek image ka scale keyframe
      ke bina badlo, render karke confirm karo ki preview = MP4 (2 frame compare).
      → **nahi hua** — `studio/.env.local` ke bina dev server uth nahi sakta, aur preview ka
      screenshot uske bina milega hi nahi.
      Jo ho saka wo hua: font ke badlaav ke baad **poora render dobara chalaya** —
      `npm run render:sample` → `ALL PASS: 29 checks, 0 fail`, aur usme "text sach me dikha?"
      wala check bhi pass hai (caption row me 280 bright px). Yaani composition me font ka
      `<style>` daalne se render toota nahi.

- [ ] 9.15 `npm run typecheck` clean. Commit: "reel-studio: phase 9 — properties + text".
      → typecheck **clean hai** (6 workspaces, exit 0), `npm run build:studio` pass, commit
      ho chuka. Box 9.14 ke baad tick hoga.

## Verify (asli output paste karna)

```
$ npm run check --workspace @reel/core
ALL PASS: 157 assertions groups, 0 fail          (pehle 132)

$ npm run check --workspace @reel/studio
ALL PASS: 8 / 9 / 32 / 55 / 20 tests, 0 fail     (naya: check-properties.ts)

$ npm run typecheck        # 6 workspaces, exit 0
$ npm run build:studio     # ✓ Compiled; /project/[id] 123 kB -> 129 kB

$ npm run render:sample    # font ke badlaav ke baad regression
ALL PASS: 29 checks, 0 fail  (reel-30fps)
  ok   text sach me dikha? — caption row me text ke pixels mile — 280 bright px

# Ye tab, jab studio/.env.local aa jaaye:
npm run dev:studio
# text item + stroke/shadow/background, image ka scale, phir preview vs MP4 frame compare
```

## Done when

Panel poora registry-generated hai (naya type add karne pe panel khud aata hai — ye ek
dummy type add karke prove karo), text ke saare controls kaam karte hain, aur text render me
preview jaisa hi dikhta hai.

**Pehla hissa ho chuka hai aur script se saabit hai** (`check-properties.ts` me ek banawati
`sticker_test` type). Teesra hissa (`preview = MP4`) browser ka intezaar kar raha hai.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| 2026-08-19 | Poora generated panel. **Core:** `ControlKind` ab ek asli array (`CONTROL_KINDS`) hai aur type usi se banta hai; nayi control kism `enable` (nullable object on/off) + `when: { isSet }`; `controlVisible()` core me (Phase 20 ka validator bhi yahi shart padhega); text ke stroke/shadow/background box/verticalAlign, shape ka stroke, transform ka anchor/crop, fit ka brand+gradient background — sab registry me; naye ops `setItemsProperty`, `applyAutoFit`, `setProjectSize`, `setProjectFps`; naya `parseTimecode()`; naya `config/fonts.ts`. **Studio:** `lib/properties.ts` (mixed/common/default/resolution), `components/controls/` (13 control ka registry + drag-wala NumberField), `PropertiesPanel`, editable `ProjectPanel` (size/fps par poochhta hai), `lib/fonts.ts`. **Renderer:** composition ab `fonts` leti hai aur apne andar `@font-face` lagati hai; TextItem font registry se family banata hai. | `npm run check --workspace @reel/core` → `ALL PASS: 157 groups` (132 se); `npm run check --workspace @reel/studio` → 8/9/32/55/**20**, 0 fail; `npm run typecheck` → 6 workspaces exit 0; `npm run build:studio` → `✓ Compiled`, `/project/[id]` 123 → **129 kB**; `npm run render:sample` → `ALL PASS: 29 checks, 0 fail` (font badlaav ke baad regression, "text sach me dikha" bhi pass) | 9.4/9.7/9.10/9.13/9.14 ka browser wala hissa — `studio/.env.local` par ruka hai. Ek asli bug pakda aur theek kiya: `setItemsProperty` `null` ke andar likh deta tha (image par aadha `text` object), ab parent dekha jaata hai aur uska apna regression test hai. |
