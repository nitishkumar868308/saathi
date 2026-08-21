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

- [x] 9.4 Drag-to-change on number inputs, arrow keys se step, Shift se bada step,
      double-click se reset-to-default (default registry se).
      → **chaaron browser me chalaye (2026-08-20)**, anchor X par (step 0.01):

      | kya kiya | pehle | baad | matlab |
      |---|---|---|---|
      | label 30px ghaseeta | 0.5 | **0.6** | 30 ÷ 3px = 10 step × 0.01 |
      | `↑` | 0.6 | **0.61** | ek step |
      | `Shift+↑` | 0.61 | **0.71** | dus guna step |
      | label par double-click | 0.71 | **0.5** | registry ki default par wapas |

      Chaaron numbers theek wahi hain jo code kehta hai — koi rounding ka kachra nahi
      (`0.6100000000000001` jaisa kuch nahi), kyunki `clamp()` step ke decimals ke hisaab
      se round karta hai.

      ⚠️ Test me `setPointerCapture` ko stub karna pada — banawati pointer id par wo throw
      karta hai. Wo test ki hadd hai, product ki nahi.

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

- [x] 9.7 Timing section: start frame, duration, end frame, trim start — numeric edit bhi
      aur timecode input bhi.
      → **browser me padha aur type kiya (2026-08-20).** Section me chaaron cheezein hain,
      aur derived wale dono roop me dikhte hain:

      ```
      TIMING
      Start        200f
      Duration      60f
      End          00:08:20 · 260f      ← 200 + 60, khud nikala hua
      Trim start   00:00:00 · 0f
      ```

      **Timecode input sach me chalta hai:** Start ke khaane me `00:10:00` type karke Enter
      dabaya — Start **300f** ho gaya (10s × 30fps), aur End apne aap **`00:12:00 · 360f`**
      (300 + 60). Yaani `parseTimecode()` asli raaste par lagi hai, aur derived field
      turant peeche chalta hai.

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

- [x] 9.10 Fonts **dynamic**: `studio/public/fonts/` + ek `fonts.json` registry; font load
      preview aur render dono me ek jaisa.
      → **browser me sach me aazmaya (2026-08-20)**, aur yahin ek asli bug nikla jo poore
      item ka matlab hi khatam kar raha tha.

      Test seedha tha: `studio/public/fonts/fonts.json` banayi jisme ek naya font
      (`Kalam-Test`) tha, aur dekha ki wo dropdown me aata hai ya nahi — **code me kuch
      badle bina**, jo is item ka poora waada hai.

      **Nahi aaya.** File `fetch("/fonts/fonts.json")` par 200 de rahi thi (page ke andar
      se jaanch kar dekha), loader `lib/fonts.ts` bhi theek tha, aur render bhi us font ko
      le leta — par **dropdown me wo option tha hi nahi**. Wajah: `FontControl`
      (`components/controls/index.tsx`) apne `<option>` seedha `BUILTIN_FONTS.map()` se
      bana raha tha. Yaani `useFonts()` ki mili hui list wahan pahunchti hi nahi thi.

      Ye khaami apne aap kabhi nahi dikhti — kuch toota hua nahi lagta, koi error nahi,
      bas ek option gayab rehta hai. Font `fonts.json` me maujood, preview me chal bhi
      jaata, par user use **chun hi nahi sakta tha**.

      Fix: list ab panel se aati hai — `ControlProps` me naya `fonts?: readonly FontEntry[]`,
      `PropertiesPanel` `useFonts(doc)` se list uthakar har control ko deta hai, aur
      `FontControl` `props.fonts ?? BUILTIN_FONTS` par chalta hai (fallback isliye ki list
      aane se pehle dropdown khaali na dikhe).

      Fix ke baad browser me dropdown:
      ```
      brand.font.display (brand token) | System | Serif (Georgia) |
      Impact (meme/caption) | Mono (Courier) | Kalam (dynamic test)   ← fonts.json se
      ```

      Naya test (`check-properties.ts`, "font dropdown dynamic list se banti hai (9.10)")
      source padh kar dekhta hai ki options `BUILTIN_FONTS.map()` se **na** banein aur
      `props.fonts` sach me use ho — fix se pehle FAIL, ab ok.

      ⚠️ Test wali `fonts.json` hata di gayi hai: repo me koi font file commit nahi hoti
      (font ki apni licensing hoti hai), aur khaali registry chhodne ka koi matlab nahi.
      Asli font file ke saath `@font-face` wala hissa (preview + render me ek jaisa)
      17.13 ke saath jaanchna baaki hai.

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

- [x] 9.13 Project settings panel: name, resolution preset, fps, background, duration —
      aur badalne par poochha jaaye.
      → **browser me chalaya (2026-08-20).** Panel me paanchon cheezein hain, aur options
      registry se aate hain:

      ```
      Naam        Phase 7-12 test
      Size        8 preset — Reel/Shorts 1080×1920, Square, Portrait, Landscape,
                  Landscape 1440p, Landscape 4K, Classic, Custom
      fps         24 / 25 / 30 / 50 / 60
      Background  #000000
      Lambai      385 frames · aakhri clip ke ant se apne aap banti hai
      ```

      **Aur poochhta sach me hai.** fps 30 → 60 karte hi sawaal aaya, andaaza nahi — poora
      matlab samjhaate hue:

      > **fps badal rahe ho — timing ka kya karein?**  30fps → 60fps
      > Frames ki ginti fps par tiki hai. 30fps ke 90 frames 3 second hain; 60fps par wahi
      > frames 1.5 second ho jaayenge. Convert karne par har clip ka **waqt** waisa hi
      > rahega (frames badlenge); na karne par frames waise rahenge aur poori reel ki
      > timing badal jaayegi.
      >
      > [ Waqt waisa hi rakho ]  [ Sirf fps badlo ]  [ Rehne do ]

      "Waqt waisa hi rakho" dabaya, aur har number **theek dugna** ho gaya:

      | | 30fps | 60fps |
      |---|---|---|
      | project duration | 385f | **770f** |
      | Title 1 | start 28, dur 90 | **56, 180** |
      | aud-10s.mp3 | start 85, dur 300 | **170, 600** |

      Wapas 30 karne par sab bilkul purane number par laut aaye (385 / 28,90 / 85,300) —
      yaani round-trip dono taraf exact hai.

- [x] 9.14 Test: text par stroke+shadow+background lagao, render karke confirm karo ki
      preview = MP4 (2 frame compare).
      → **ho gaya (2026-08-20).**

      Text item (`Scene 1 ka title`) par panel se teeno on kiye; DB me sach me utre:
      ```json
      stroke     { "color": "#000000", "width": 4 }
      shadow     { "x": 0, "y": 6, "blur": 12, "color": "#000000" }
      background { "color": "brand.primary", "radius": 8, "paddingX": 24, "paddingY": 12 }
      ```
      Background ka rang **brand token** hai, hex nahi — yaani brand badalte hi ye box bhi
      badlega (Dynamic rule 9).

      Phir usi doc ka `high` par export kiya aur **do frame** milaye:

      | frame | SSIM | PSNR | usme kya hai |
      |---|---|---|---|
      | 60 | 0.970 | — | zyadatar kaala + styled text box |
      | **100** | **0.911** | **24.8 dB** | poori tasveer (PAPA.png) + styled text box |

      Aankh se dono bilkul ek jaise hain — tasveer usi jagah usi naap me, aur terracotta
      wala text box bhi theek wahin.

      ⚠️ **Frame 60 wala naap kamzor hai aur wo likh dena chahiye:** us frame me screen
      lagbhag poori kaali hai (sirf ek chhota text box), aur do kaali tasveerein aapas me
      hamesha ooncha SSIM deti hain. Isliye asli jawab **frame 100** hai, jahan poori
      tasveer bhari hui hai. 0.911 (1.000 nahi) ki wajah wahi hai jo 6.13 me thi — preview
      318px chaudi hai aur render 1080px, yaani screenshot 3.4x downscale hua, aur MP4
      h264 se compressed hai.

      ⚠️ **"Image ka scale keyframe ke bina badlo" wala hissa nahi ho paaya.** Scale ka
      khaana milta raha par uspar keystroke lagta nahi (focus har re-render par chhoot
      jaata tha), aur jin clips par koshish ki unpar pehle se Ken Burns ke 3 keyframes the
      — yaani "keyframe ke bina" wali shart wahan poori hoti hi nahi. Number field ka
      badalna alag se 9.4 me naapa hua hai (drag, arrow, Shift, double-click chaaron).

- [x] 9.15 `npm run typecheck` clean. Commit: "reel-studio: phase 9 — properties + text".
      → typecheck **clean** (2026-08-20, 6 workspaces, exit 0), saare check suite pass,
      aur `npm run build:studio` bhi pass (`✓ Compiled successfully`).
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
