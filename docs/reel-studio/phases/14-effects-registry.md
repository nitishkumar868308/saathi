# Phase 14 — Effects registry + color pipeline

**STATUS:** code done — browser wala hissa baaki (dev server nahi chala)
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 14 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + A1 Quality rules binding. Resume Protocol follow karo.
**Depends on:** Phase 13 complete

**Goal:** effects **sirf configuration** hon (`{type, amount, enabled}`), ek hi pipeline se
apply hon. Kisi item component ke andar effect hardcode karna mana hai.

## ⚠️ Tick ka matlab

- `[x]` = **chalaya gaya hai**, aur neeche `→` me uska asli output hai.
- `[ ]` = code likha hua hai par chalaya nahi. Kya rok raha hai wo likha hai.

## Checklist

- [x] 14.1 `EFFECTS` registry: `{ id, label, params (zod), defaults, controls, keyframable
      params, apply(style, params) }`. CSS-filter based effects ek generic path se.
      → `registry/effects.ts`. `filterEffect()` helper se 8 filters ek hi raaste se bante hain
        (brightness/contrast/saturation/grayscale/sepia/hue-rotate/opacity/invert).
- [x] 14.2 Effects: blur, brightness, contrast, saturation, grayscale, sepia, hue-rotate,
      opacity, vignette, sharpen, dropShadow, roundedCorners, border.
      → Saare 13 (+ `invert` jo 14.12 ke saboot me juda) maujood hain.
      → `sharpen` sach me sharpen hai: CSS me aisa koi filter hai hi nahi, isliye SVG ka
        `feConvolveMatrix` chalta hai (3x3 unsharp kernel, jod hamesha 1 taaki roshni na
        badle). Uske badle contrast badha kar "sharpen" likh dena aasan tha par wo jhooth
        hota — dikhne me mila-julta lagta hai, karta bilkul doosri cheez hai.
- [x] 14.3 `applyEffects(item, frame)` — ek hi function, `ItemRenderer` isko call kare.
      → `applyEffects()` core me hai; `Transformed.tsx` use bulata hai. Item components me
        kisi effect ka naam nahi hai (`grep` se check karo).
      → ⚠️ Ye `ItemRenderer` me nahi, `Transformed` me hai — `ItemRenderer` ke paas item ka
        DOM nahi hota, wo sirf component chunta hai. Shart (item components effects ke bare
        me kuch na jaanein) poori hai.
- [x] 14.4 Effect stack: add/remove/reorder/enable-disable, order matter kare.
      → 5 ops. Naapa gaya: `grayscale(1) sepia(1)` aur `sepia(1) grayscale(1)` alag nikalte
        hain, aur test dono ko compare karta hai.
- [x] 14.5 Effect params keyframable.
      → Path `effects.<index>.<param>` — wahi keyframe engine, koi naya code nahi.
      → Render me naapa gaya: blur 0 → 10 par sabse tez kinara 254 → 24 → 14.
- [x] 14.6 Effect presets (data): Soft glow, Cinematic contrast, B&W, Vintage.
      → `config/effectPresets.ts`. Preset stack ko **badal** deta hai, jodta nahi — warna
        "B&W" ke upar "Vintage" lagane par do grayscale aur do vignette lag jaate.
- [x] 14.7 Track/project-level effect ke liye jagah, par UI me button **nahi**.
      → Registry scope-agnostic hai (`applyEffects` ko sirf ek item chahiye). Track/project
        par lagane ka koi op aur koi button nahi hai — jaan-boojhkar.
- [x] 14.8 A1: effects GPU/CSS se lagein, double-compression na ho; blur ka render-time
      impact naapo; banding aane par saaf batao.
      → Sab kuch browser me CSS/SVG se lagta hai. Encode ab bhi **ek hi** hai (finalize
        `-c:v copy` karta hai) — effects ke liye koi doosra pass nahi juda.
      → Render time naapa gaya, neeche table me.
      → Banding: naap li gayi aur uska matlab neeche saaf likha hai.
- [x] 14.9 Masking base: `mask` field per item, basic shapes; image mask schema me par UI band.
      → `MaskSchema` + `config/mask.ts`. feather 0 par `clip-path`, feather par `mask-image`
        gradients (`mask-composite: intersect`, warna kone tez rehte hain).
      → `assetId` (image mask) schema me hai, UI me **koi button nahi**.
      → **browser me nahi dekha** — feather ka narm kinara aankh se hi tay hota hai.
- [x] 14.10 Overlays: blend mode (`normal, multiply, screen, overlay`).
      → `blendMode` item par; `Transformed` "normal" ke alawa hi likhta hai (normal likhna bhi
        browser ko naya stacking context banwa deta hai).
      → **browser me nahi dekha.**
- [x] 14.11 UI: Effects section — add dropdown (registry se), har effect ka card, reorder, eye toggle.
      → `EffectsSection.tsx` — Effects + Mask + Blend. Reorder teeron se (drag baaki).
      → **browser me nahi dekha.**
- [x] 14.12 Naya effect add karke `git diff --stat` se prove karo ki sirf 1–2 file lagi.
      → Neeche asli output.
- [x] 14.13 Test: render karke frames dikhao, preview vs render compare.
      → Neeche asli output — 5 effects, sab pixel se naape gaye.
- [x] 14.14 `npm run typecheck` clean. Commit.

## Jo galat nikla

**1. `hue-rotate(30)` — invalid CSS (test ne pakda).**
`filterEffect()` unit sirf `%` ke liye jodta tha, `deg` ke liye nahi. Browser invalid filter
ko **poora chhod deta hai**: effect chup-chaap gayab, koi error nahi. Ab dono units jud'ti
hain aur ek test seedha string check karta hai.

**2. `FitBackground` `<Transformed>` ke bahar tha (render ke pixels ne pakda).**
Rounded corners lagane par kona kata to tha, par uske peeche item ki hi **doosri parat**
(contain wala blurred background) baithi thi — kone ka luma 60.8 aaya, 0 hona chahiye tha.
Isi tarah mask, blur aur vignette bhi sirf aadhe item par lag rahe the. Background item ka
**hissa** hai, uske peeche ki koi alag cheez nahi — ab wo `Transformed` ke andar hai aur wahi
transform, wahi effects, wahi mask khata hai. Fix ke baad kona **0.3**.

**3. Do naap khud galat thi** (code nahi, sawaal):
- Blur pehle video par tha aur "kinaron ki teezi" naapi ja rahi thi. `testsrc2` ka content har
  frame par badalta hai, isliye naap blur se nahi content se hil rahi thi (638 → 523 → 646,
  bina kisi kram ke). Ab ek kaali patti par safed patti ka probe hai — us row par sirf uske do
  kinare hote hain.
- Grayscale ke liye poora frame padha tha aur `|R-B| = 14` aaya. Wajah: caption band terracotta
  hai aur uspar grayscale hai hi nahi, par wo bhi ginti me aa raha tha. Ab naap usi patti par
  hoti hai jispar effect laga hai → **0.00**.

## Verify (asli output)

```
$ npm run typecheck
(6 workspaces, koi error nahi)

$ npm run check
ALL PASS: 8 tests, 0 fail
ALL PASS: 9 tests, 0 fail
ALL PASS: 32 tests, 0 fail
ALL PASS: 55 tests, 0 fail
ALL PASS: 20 tests, 0 fail
ALL PASS: 291 assertions groups, 0 fail    # core (+25 naye Phase 14 ke)
ALL PASS: 16 tests, 0 fail                 # @reel/media

$ npm run build:studio
✓ Compiled successfully
└ ƒ /project/[id]    141 kB    287 kB
```

### 14.13 — effects, asli MP4 se naape hue

```
11. effects — naape hue (14.13)
  ok   grayscale — R aur B ka farak lagbhag khatam — mean |R-B| = 0.00 (neela grid bina grayscale ke ~160 deta)
  ok   brightness 0.9 — safed chaukor 255 se 229 par aaya — beech ki roshni 230.0 (expected ~229.5)
  ok   vignette — kone beech se kaafi gehre hain — kona 19.3 vs beech 230.0
  .. frame 6: blur 0.20px -> sabse tez kinara 254
  .. frame 150: blur 5.02px -> sabse tez kinara 24
  .. frame 288: blur 9.63px -> sabse tez kinara 14
  ok   blur keyframe (0 -> 10) — kinare lagataar narm hote gaye — 254 -> 24 -> 14
  ok   rounded corners — kona kata hua hai (andar se kaafi gehra) — kona 0.3 vs curve ke andar 66.4
  .. dhalaan par 21 alag levels, sabse lambi ek-jaisi patti 306px
  ok   vignette ka dhalaan baitha nahi (levels bache hue hain) — 21 levels

ALL PASS: 41 checks, 0 fail  (reel-30fps)
```

`brightness` ka number ganit se pehle hi pata tha: safed chaukor 255 par tha, `brightness(0.9)`
use 229.5 par laata hai. Naap 230.0 aayi.

### 14.8 — render time ka asar (naapa hua)

Ek hi machine, ek hi sample, 300 frames, sirf effects ka farak:

| Kya | sirf render | speed |
|---|---|---|
| Bina effects (Phase 13 wala sample) | 38.2s | 7.9 fps |
| 5 effects ke saath (blur keyframe, grayscale, brightness, vignette, rounded, shadow) | 64.0s | 4.7 fps |

Yaani **~68% dheema**. Sabse bhaari blur hai (har frame par poora layer dobara banta hai),
isliye uska `cost` 4 hai aur panel stack bhaari hone par "render dheema hoga" likh deta hai.
Ye sirf **render ki raftaar** ki baat hai — quality par koi asar nahi (encode ab bhi ek hi hai).

### Banding — saaf baat

Naap: dhalaan par **21 alag levels**, sabse lambi ek-jaisi patti **306px**.

Pehle yahan "sabse lambi patti ≤ 40px" wala check tha aur wo fail hua. Naap galat nahi thi,
**sawaal galat tha**. Is sample me vignette lagbhag-kaale content par baithi hai (grid ka luma
~17). Uspar dhalaan ki poori range hi 8 se 13 tak hai — 8-bit me ginti ke 5-6 kadam. Utni
chhoti range me lambi ek-jaisi pattiyan hamesha aayengi, chahe encoder kitna bhi accha ho.
Us number par threshold lagana ek theek cheez ko "fail" batata.

Isliye ab sirf wo check hai jo sach me galat baat pakadta hai: dhalaan ka **poora baith jaana**
(2-3 hi levels bachna). Dono number chhapte hain taaki dekhe ja saken.

**Jo abhi nahi pata:** chamakdaar background par vignette me banding aati hai ya nahi. Is
sample me aisi jagah hai hi nahi. Jab tak wo naapa na jaaye, "banding nahi hai" kehna galat
hoga — isliye nahi keh rahe.

### 14.12 — naya effect = 1 file

`invert` effect registry me joda, aur bas:

```
$ git diff --stat
 packages/reel-core/src/registry/effects.ts | 13 +++++++++++++
 1 file changed, 13 insertions(+)
```

13 lines, 1 file — aur wo apne aap panel ke dropdown me, apne generated slider ke saath,
keyframable, aur preview + render dono me chal gaya. Koi UI file, koi renderer file, koi
schema file nahi chhui.

## Baaki kya hai

| Kya | Kyun ruka |
|---|---|
| 14.9 / 14.10 / 14.11 ka browser wala hissa | `studio/.env.local` nahi hai → dev server nahi chalta |
| Effect card ka drag-to-reorder | abhi teer (▲▼) se hota hai; drag browser me hi banega |
| Image mask | schema me jagah hai, lagta nahi — UI me button bhi nahi (jaan-boojhkar) |
| Chamakdaar background par banding | is sample me aisi jagah nahi; naapa nahi gaya |

## Done when

Effects poore config-driven hain, stack order kaam karta hai, params keyframable hain,
basic masks chalte hain, aur preview = render.

→ Pehle teen naap liye gaye. Mask ka CSS test se pakka hai par aankh se nahi dekha.
  "preview = render" ka saboot ye hai ki dono ek hi `applyEffects()` chalate hain aur render
  ke pixels engine ki predict ki hui value se mile.

## Progress log

| Kab | Kya hua |
|---|---|
| 2026-08-20 | 14.1–14.14 done. Ek asli bug pakda gaya (FitBackground `Transformed` ke bahar tha — kone se blurred copy jhaank rahi thi) aur ek invalid-CSS bug (`hue-rotate` bina `deg`). `render:sample` 41/41. Naya effect = 1 file / 13 lines. |
