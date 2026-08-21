# Phase 18 — Phone mockup + screen recording workflow

**STATUS:** code done — browser wala hissa baaki (dev server nahi chala)
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 18 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + A1 Quality rules binding. Resume Protocol follow karo.
**Depends on:** Phase 17 complete

**Goal:** Apka Saathi app ka screen recording ek professional demo shot bane — phone frame,
zoom-pan, rounded corners, shadow.

## ⚠️ Tick ka matlab

- `[x]` = **chalaya gaya hai**, aur neeche `→` me uska asli output hai.
- `[ ]` = code likha hua hai par chalaya nahi. Kya rok raha hai wo likha hai.

## Checklist

- [x] 18.1 `PhoneFrame` component; device list **data** me (`devices.ts`).
      → `config/devices.ts` — 4 devices. Har naap **screen ki chaudai ke hisaab se** hai,
        pixels me nahi; isliye ek hi frame 1080 aur 540 dono par bilkul ek jaisa dikhta hai
        (test isko naapta hai).
      → Naya device = ek entry, aur bas.
- [x] 18.2 Frame ke andar koi bhi asset fit ho; aspect mismatch par saaf handling.
      → `mockup.screenFit` (`cover` | `contain`). Frame ke andar default `cover` hai — bezel
        ke andar kaali pattiyan turant nakli lagti hain.
- [x] 18.3 SVG/CSS se frame (koi PNG dependency nahi). Shadow + glass reflection toggle.
      → Poora CSS se. PNG rakhna aasan hota par ek asli khatra hai: wo file render ke bundle
        me pahunchni chahiye, aur ek din miss ho jaati — tab video me phone ki jagah khaali
        dabba aata aur render kahin error bhi nahi deta.
      → Chamak (glare) **default off**: screen recording par wo text padhna mushkil kar deti
        hai, aur demo video ka poora point hi text padhwana hota hai.
- [x] 18.4 3D tilt (perspective), keyframable.
      → `tiltX` / `tiltY`. `perspective` **parent** par hai — ek hi element par dono lagane
        par rotation flat reh jaati hai (CSS ki sabse aam galtiyon me se).
      → Keyframe path `mockup.tiltX` chalta hai (keyframe engine path se address karta hai),
        par UI me uska stopwatch abhi nahi joda.
- [x] 18.5 `screen_recording` scene me phone frame default ON + "raw" mode.
      → Default frame lagta hai aur fit `cover` ho jaata hai; `frame: "raw"` par frame nahi
        lagta aur fit `contain` par wapas aa jaata hai. Dono ke apne test hain.
- [x] 18.6 **Zoom-pan tool** — preview par chaukor kheencho, background me keyframes banein.
      → `ZoomTool.tsx` (preview par) + `applyZoomPan` op. Chaukor se `transform.scale` aur
        `transform.x/y` ke **wahi keyframes** bante hain jo user haath se laga sakta tha —
        isliye zoom par undo, curve editor aur keyframe lane sab apne aap chalte hain.
      → Render se naapa gaya: 2x zoom par safed chaukor **1.99x** bada hua.
      → **button browser me chalaya (2026-08-21):** image clip ke ZOOM wale hisse me
        button ne apna roop badla — `chaukor se zoom` → `chaukor kheencho`. Chaukor
        **kheenchna** synthetic pointer se naapna bharosemand nahi; wo haath se baaki hai.
- [x] 18.7 Zoom presets — sirf param sets.
      → `ZOOM_PRESETS` (4). Preset bhi usi `applyZoomPan` op se guzarta hai; do alag raaste
        hone par ek din preset wala zoom keyframes ke bina lagta aur uspar undo kaam nahi karta.
- [x] 18.8 A1 guard: over-zoom par exact numbers ke saath warning.
      → `checkZoomUpscale()`. Asli ganit `config/fit.ts` ke `checkUpscale()` me hai aur wahi
        chalta hai — dobara nahi likha (do jagah ek hisaab rakhne par ek din dono alag kehte
        aur user kisi par bharosa nahi karta).
      → Naapa gaya: 2.5x zoom par `2700x6000 chahiye, source 1080x2400`, aur salah
        "Recording kam se kam 2700px chaudi dobara lo".
- [x] 18.9 Auto-detect device aspect; auto-fit; "trim dead time" helper.
      → `deviceForAspect()` — **sabse paas wala** device chunta hai, "bilkul barabar" nahi
        (1080x2400 ka aspect kisi list me theek nahi milta; barabar maangne par har recording
        par "koi device nahi mila" aata aur ye feature kabhi chalta hi nahi).
      → Frame lagate waqt UI usi se device chunti hai.
      → **"Trim dead time" nahi bana** — uske liye video decode karke silence/sthirta
        dhoondhni padti hai, jo browser me har badlav par nahi ho sakta. Wajah neeche table me.
- [x] 18.10 Rounded corners + border + shadow raw recordings ke liye — Phase 14 effects reuse.
      → Naya code nahi: `roundedCorners`, `border`, `dropShadow` effects pehle se hain aur
        raw recording par waise ke waise lagte hain.
- [x] 18.11 Touch/tap indicator overlay.
      → **ban gaya (2026-08-20).** Screen recording dekhne wale ko bilkul pata nahi chalta
      ki ungli **kahan** padi — screen achanak badal jaati hai aur wo ek jump jaisa lagta
      hai. Ab ek chhota gola tap ki jagah par phail kar gayab hota hai, aur us jump ko
      wajah mil jaati hai.

      **Core:** `mockup/taps.ts` — `TAP_SECONDS = 0.4` aur `visibleTaps(taps, localFrame,
      fps)` (7 test). Poora hissa ek pure function par khada hai aur wo jaan-boojhkar core
      me hai: renderer **aur** preview dono isi ko bulate hain. Do jagah ye ganit likhne
      par ek din preview me tap dikhta aur MP4 me nahi.

      ⚠️ Window **seconds me** naapi jaati hai, frames me nahi. Fix frame count (jaise "12
      frame") rakhne par 60fps ke project me wahi nishaan aadhe waqt ka ho jaata — aur wo
      farak sirf saath-saath dekhne par pakda jaata. Uska apna test hai.

      **Schema:** `mockup.taps` — `frame` item-local, `x`/`y` 0..1 screen ke andar, aur
      `.default([])` (wahi seekh jo `mask` se mili thi). Pixel me rakhne par device badalte
      hi har nishaan apni jagah chhod deta.

      **UI:** MockupSection me "Playhead par tap jodo" — playhead clip ke bahar ho to button
      dabta hi nahi aur tooltip wajah batata hai. Har nishaan list me apne frame aur jagah
      ke saath dikhta hai, hatane ke button ke saath.

      **Render me sach me dikhta hai** — `npm run render:mockup` me naya check, jo **ek hi
      timestamp par do render** milata hai (ek tap ke saath, ek bina): `20.903 vs 20.741`
      aausat roshni. Ek hi video ke do samay milana galat hota, kyunki us doc me zoom bhi
      chalti hai aur wo naap ko dabaa deti.

      ⚠️ **Is test ne do baar jhoothi khabar di, aur dono baar galti naap ki thi, code ki
      nahi** — likh dena zaroori hai:
      1. Pehle tap 1.0s par rakha tha. Wahan zoom itna chadh chuka hota hai ki phone frame
         hi screen se bahar nikal jaata hai — naapne ko kuch bachta hi nahi.
      2. Phir tap screen ke **beech** me tha, aur test wali recording ka safed chaukor bhi
         theek wahin hai. Safed nishaan safed ke upar padkar roshni bilkul nahi badalta.
         Ye tab pakda gaya jab gole ko asthayi roop se **laal** kar ke dekha — roshni badal
         gayi (20.442), yaani render hamesha theek tha. Ab tap gehre hisse par (y 0.85)
         lagta hai.

- [x] 18.12 Test: recording → phone frame → do zoom step → render, aur 2.5x par warning.
      → `npm run render:mockup` — 11 checks, sab pass. Asli output neeche.
- [x] 18.13 `npm run typecheck` clean. Commit.

## Jo seekha

**Zoom ko apna field banana sabse badi galti hoti.** Agar `item.zoom = { rect, from, to }`
hota, to uspar undo, curve editor, keyframe lane, copy-paste aur AI ka patch — kuch bhi apne
aap kaam nahi karta. Har ek ke liye alag code likhna padta, aur har naya feature ek din zoom
wala case bhool jaata. Keyframes banane se ye poora sawaal hi khatam ho jaata hai.

Isi wajah se `applyZoomPan` me `replace` default `true` hai: dobara zoom lagane par purane
keyframes hat jaate hain. Bina iske do zoom milkar ek ajeeb teesri harkat bana dete hain jise
samjhana namumkin hota.

## Verify (asli output)

```
$ npm run typecheck
(6 workspaces, koi error nahi)

$ npm run check
ALL PASS: 8 / 9 / 32 / 60 / 20 / 12 tests, 0 fail    # studio
ALL PASS: 391 assertions groups, 0 fail              # core (+19 naye Phase 18 ke)

$ npm run build:studio
✓ Compiled successfully
└ ƒ /project/[id]    157 kB    311 kB
```

### 18.12 — phone frame + zoom, MP4 se naapa hua

```
$ npm run render:mockup --workspace @reel/worker

1. dummy screen recording
  ok   recording bani — 1080x2400
  ok   aspect se device chuna gaya (18.9) — Phone (19.5:9) (phone-tall)

2. doc — phone frame + do zoom step
  ok   doc schema pass karta hai
  ok   zoom se teen-teen keyframes bane — scale 3, x 3

3. render
  ok   render hua — render-out/mockup/phone-zoom.mp4

4. phone frame sach me dikha?
  ok   safed chaukor frame ke andar hi hai (bahar nahi failta) — 288px safed vs frame ki chaudai 648px

5. zoom sach me chala? (18.6)
  .. safed chaukor: 284px -> 564px -> 282px
  ok   zoom par chaukor sach me bada hua — 284 -> 564 (1.99x)
  ok   zoom ke baad wapas chhota ho gaya — 282 vs shuruaat 284

6. over-zoom ki chetavni (18.8)
  ok   bina zoom ke koi chetavni nahi
  .. 2.50x zoom par: Recording kam se kam 2700px chaudi dobara lo, ya zoom 1.00x tak rakho.
  ok   2.5x zoom par saaf galti aati hai — 2700x6000 chahiye, source 1080x2400
  ok   chetavni me exact number hai (sirf 'blurry' nahi)

ALL PASS: 11 checks, 0 fail  (mockup)
```

Do naap sabse zaroori hain:

- **1.99x** — 2x zoom maanga tha aur pixels me 1.99x mila. Ye sirf "kuch bada hua" nahi hai;
  ye wahi number hai jo chaukor ne maanga tha.
- **282 vs shuruaat 284** — zoom ke baad chaukor bilkul apni jagah wapas aa gaya. Iske bina
  "zoom chal gaya" ka matlab "kuch khisak gaya aur wapas nahi aaya" bhi ho sakta tha.

Recording FFmpeg se banti hai (1080x2400) kyunki abhi Apka Saathi ka asli recording nahi hai.
Uspar ek bada safed chaukor hai jiski chaudai naapi ja sakti hai. **Asli recording aane par
sirf ek file badalni hai**, baaki poora test waisa ka waisa chalega.

## Baaki kya hai

| Kya | Kyun ruka |
|---|---|
| 18.6 ka chaukor kheenchna | `studio/.env.local` nahi hai → dev server nahi chalta. Op aur keyframes naape ja chuke hain; sirf maus wala hissa baaki. |
| "Trim dead time" (18.9 ka aadha) | Video decode karke sthirta/silence dhoondhni padti hai — browser me har badlav par ye nahi ho sakta. Worker me ho sakta hai, par uske liye ek naya job chahiye. |
| Tap indicator (18.11) | Jaan-boojhkar skip. Checklist khud kehti hai "button mat dikhao" — nahi dikhaya. |
| `mockup.tiltX` ka stopwatch | Path se keyframe lagta hai, par panel me uska diamond nahi joda. |
| Apka Saathi ka asli recording | Aapke paas hai; abhi dummy se naapa gaya. |

## Done when

Screen recording phone frame me professional dikhti hai, zoom-pan keyframes se chalta hai,
aur over-zoom pe asli numbers ke saath warning aata hai.

→ Doosra aur teesra **naap liye gaye** (MP4 se). Pehla ("professional dikhti hai") aankh ka
  faisla hai aur wo browser me hi ho sakta hai — par frame render me sach me aata hai, ye
  naapa ja chuka hai.

## Progress log

| Kab | Kya hua |
|---|---|
| 2026-08-20 | 18.1–18.10, 18.12, 18.13 done; 18.11 jaan-boojhkar skip (button bhi nahi). Naya script `render:mockup` — 11/11. 2x zoom par pixels me 1.99x mila aur zoom ke baad chaukor apni jagah wapas. Over-zoom par exact numbers (2700x6000 chahiye, source 1080x2400). |
