# Phase 17 — Templates engine + brand token system

**STATUS:** code done — browser wala hissa aur DB wala hissa baaki
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 17 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 12 complete

**Goal:** yahan se reel banana **minuton ka kaam** ban jaata hai. Template = data, brand =
tokens. Template kabhi flattened video nahi — hamesha editable timeline.

## ⚠️ Tick ka matlab

- `[x]` = **chalaya gaya hai**, aur neeche `→` me uska asli output hai.
- `[ ]` = code likha hua hai par chalaya nahi. Kya rok raha hai wo likha hai.

## Checklist

- [x] 17.1 Template format `{ id, name, description, thumbnail, targetPreset, slots[], scenes[] }`,
      DB `reel_templates.doc jsonb` me.
      → `templates/schema.ts` (zod). SQL: `supabase/reel-studio-templates.sql`.
      → **SQL chalaya nahi gaya** — wo user ka kaam hai.
- [x] 17.2 `slots[]` declarative + slot-filling wizard.
      → `TemplateSlotSchema` (`image|video|audio|text|color`). Wizard
        `TemplatePanel.tsx` me hai aur form slot ki `kind` se banta hai — koi
        per-template code nahi.
- [x] 17.3 `applyTemplate()` → poora editable doc; missing slot par placeholder + saaf badge.
      → Har scene `addScene` op se banta hai — **wahi op** jo user ke "scene jodo" button se
        chalta hai. Isliye template se bani reel me wahi items hote hain jo user khud bana
        sakta tha (test isko `moveItems` chalaakar saabit karta hai).
      → Text slot khaali ho to `[Label yahan daalo]` aata hai. Asset slot khaali ho to scene
        chhoot jaata hai — **par chup-chaap nahi**, `skipped[]` me wajah ke saath.
- [x] 17.4 Template ka aspect project preset se adapt ho.
      → **Iske liye koi "re-fit" wala code likhna hi nahi pada**, aur wahi is checklist ka
        asli jawab hai: scene types sab kuch frame ke **percent** me banate hain. Test teeno
        size (9:16 / 1:1 / 16:9) par chalta hai aur har item ko frame ke andar naapta hai.
      → Render se bhi naapa gaya: ek hi template se do MP4 (1080x1920 aur 1080x1080), dono me
        wahi scenes wahi kram.
- [x] 17.5 "Save as template" — mojooda project se template.
      → `templateFromDoc()`. `assetSlots: true` par asset slot ban jaate hain (dobara istemaal
        layak), `false` par asset id waise ke waise (apna preset jaisa).
      → Round-trip test: bana hua template dobara lagta hai aur wahi scenes deta hai.
      → UI me abhi **clipboard me JSON** jaata hai, DB me nahi — SQL chalaya nahi gaya hai aur
        panel me ye saaf likha hai.
- [x] 17.6 Built-in template "Rahul + Papa" — 6 scenes.
      → 7 scenes (music optional). Character wala scene **optional** hai: lipsync Phase 24 me
        hai aur ho sakta hai kabhi na aaye; use zaroori banane par template tab tak bekaar
        rehta.
- [x] 17.7 "App feature demo" aur "Testimonial".
      → Dono maujood. `targetPreset` ek **hadd nahi** hai — teeno kisi bhi size par lagte hain.
- [x] 17.8 Template gallery UI + slot wizard.
      → `TemplatePanel.tsx` (naya "Templates" tab).
      → **browser me dekha (2026-08-21):** Templates panel me dono template apne byore ke
        saath — "Rahul + Papa … 7 scene · 7 cheezein bharni hain" aur "App feature demo
        … 3 scene · 4 cheezein bharni hain".
      → Thumbnail abhi nahi hai (`thumbnail: null`) — uske liye ek chhota render chahiye, jo
        Phase 20 ke lifecycle ka kaam hai. Gallery me naam, description aur ginti dikhti hai.
- [x] 17.9 Brand tokens: colors, fonts, logo, watermark, CTA, end-screen; Apka Saathi preset seed.
      → `BrandSchema` poora naya (`tokens`, `logoAssetId`, `watermark`, `cta`, `endScreen`).
        Teen built-in presets. SQL me `reel_brand_presets` + Apka Saathi ka seed (#C25A37,
        #E0A458, …).
- [x] 17.10 Token resolution: preview aur render dono ek hi resolver se.
      → **Yahin ek asli bug mila** — neeche dekho.
      → Ab `BrandProvider` poore renderer ke upar hai aur har item `useToken()` se resolve
        karta hai.
- [x] 17.11 Brand switch: look badle, manual override bache, aur ginti dikhe.
      → Override ke liye **koi flag nahi** hai, aur ye is phase ka sabse saaf faisla hai:
        rang ya to token hai (`brand.primary`) ya pakka rang (`#C25A37`). Isliye override
        apne aap pehchana jaata hai — aur brand badalne par apne aap bach bhi jaata hai.
      → Panel me ginti aur list dikhti hai, aur "inhe token bana do" ka button bhi (sirf un
        rangon ke liye jo brand me pehle se hain).
- [x] 17.12 Watermark / logo / end-screen project settings se on/off.
      → `WatermarkLayer` renderer me (safe-area ke andar). `enabled` **aur** asset dono
        chahiye — sirf `enabled` par ek khaali dabba render me chala jaata.
      → End-screen abhi sirf doc me save hota hai; use scene banane wala code nahi likha
        (wajah neeche table me).
- [x] 17.13 Brand fonts local `public/fonts/` me, preview + render me same `@font-face`.
      → **Poora raasta browser me chala kar dekha (2026-08-21)** — aur usme ek asli jaal mila.
      → Naap: ek font file `studio/public/fonts/` me rakhi aur `fonts.json` me ek entry di.
        Uske baad panel ke dropdown me wo font aa gaya (**"Audit Test"**) aur preview ke DOM
        me uska `@font-face` bhi:
        ```css
        @font-face { font-family: AuditTest;
          src: url("/fonts/_audit-test.ttf") format("truetype");
          font-weight: 700; font-style: normal; font-display: block; }
        ```
      → "Preview aur render me same" wala daawa **dhaanche se hi pakka** hai: ye `<style>`
        `ReelComposition.tsx:95` me `fontFaceCss(fontList)` se aata hai, aur wahi component
        preview ka `<Player>` bhi chalata hai aur `renderMedia` bhi. Do jagah do CSS ho hi
        nahi sakti.
      → ⚠️ **Jo jaal mila:** loader sirf `{ "fonts": [ … ] }` maanta tha, par likha sirf itna
        tha ki "`fonts.json` me ek entry jodo". Seedha padhne par aadmi ek **list** likhta hai
        (`[ { … } ]`) — aur tab kuch nahi hota: file parosti hai, JSON theek hota hai, koi
        error nahi aata, bas font kabhi dropdown me nahi aata. Ab dono shakl chalti hain
        (`parseFontsJson()`, 3 test), shape upar likhi hui hai, aur shakl samajh na aane par
        console me saaf message jaata hai — chup-chaap chhodna hi is jaal ki jaan thi.
      → ⚠️ **Repo me font file ab bhi commit nahi hai, aur nahi honi chahiye** — licensing.
        Test wali file naap lene ke baad hata di gayi.
      → ⚠️ **Isi ke saath ek aur bug nikla, aur wo isse bhi chup tha:** worker render ko
        `fonts` **bhejta hi nahi tha**, aur font ki file render ke `publicDir` me jaati hi
        nahi thi. Yaani preview me `fonts.json` wala font dikhta tha aur **MP4 me system
        font nikalta tha** — bilkul wahi cheez jiski chetavni `config/fonts.ts` ke sar par
        likhi hai. Koi error nahi, koi warning nahi; farak sirf tab dikhta jab reel ban
        chuki ho.
        Ilaaj: `worker/src/fonts.ts` ka `stageFonts()` — `fonts.json` padhta hai, files
        `publicDir/fonts/` me utaarta hai, aur list render request me bhejta hai. Jis font
        ki file na mile use list se **hata** diya jaata hai (jhoothi list se fallback
        chup-chaap lagta hai; entry hatne par `missingFonts()` ki chetavni chalti hai).
        `../` wali file repo ke bahar nahi ja sakti. 5 test — `npm run check` me.
      → **Upload ka raasta bhi ban gaya (2026-08-21).** `config/brand.ts` me pehle se likha
        tha ki "asli brand fonts Phase 17 me asset ke roop me upload honge" — ab wahi hua:
        * library me naya **"Fonts"** tab (`LIBRARY_TABS`) — `.woff2/.ttf/.otf`, 16 MB tak.
          Kind pehle se registry me tha (`itemType: null`, kyunki font timeline par item
          nahi banta).
        * upload ke baad wo font **apne aap** font-picker me aa jaata hai — family ka naam
          file se banta hai (`Poppins-Bold.woff2` → `Poppins-Bold`), asset id se nahi, jo
          picker aur CSS dono me bekaar dikhta.
        * preview me uska `@font-face` uske **signed URL** par banta hai; render ke waqt
          worker wahi file `publicDir/fonts/` me utaar kar entry ka raasta badal deta hai.
          Dono jagah `fontFaceCss()` ek hi hai.
      → ⚠️ **`weight` file ke naam se andaaza nahi lagaya jaata.** `Poppins-Bold` dekh kar
        700 maan lena aasan hota, par `Poppins-Semibold` par wo galat hota aur galti
        chup-chaap chalti — text thoda mota, aur wajah kahin nahi. Default 400 hai.
      → ⚠️ **Poora URL par `basePath` nahi chipkta** — warna `src` `"/fonts/https://…"` ban
        jaata aur font chup-chaap load hi nahi hota. Uspar apna test hai.
      → **Browser me chalakar dekha:** ek font upload kiya, "Fonts" tab me aaya, picker me
        `AuditBrand` dikha, aur preview ke DOM me uska `@font-face` poore URL ke saath.
        Test wala font baad me mita diya gaya (licensing).
- [x] 17.14 Test: template se project, aspect badal kar dobara, brand badal kar look badle.
      → `npm run render:template` — 9 checks, sab pass. Asli output neeche.
- [x] 17.15 `npm run typecheck` clean. Commit.

## Jo galat nikla

**1. Render brand tokens padhta hi nahi tha.**

Ye is phase ka sabse bada bug tha aur wo pixel naap kar hi pakda gaya. Har item component
seedha `resolveToken(value)` bulata tha — **bina tokens diye**, yaani hamesha default brand
ke saath. Uska matlab: poora token system likha hua tha, doc me `"brand.primary"` pada tha,
brand panel bana tha… aur preset badalne se preview aur MP4 dono me kuch nahi badalta tha.

Ab `BrandProvider` (context) poore renderer ke upar hai aur har jagah `useToken()` chalta hai.
Context isliye (prop drilling nahi): rang paanch alag components me lagta hai aur unme se kuch
`doc` tak pahunchte hi nahi — har ek me naya prop jodne par ek din koi ek chhoot jaata, aur wo
ek jagah chup-chaap default brand par atki reh jaati.

**2. Naap teen baar galat jagah par thi.**

`brand.background` par naapa → fasla 9.9. CTA scene par naapa → 11.4. Dono baar naap sahi thi,
**sawaal galat tha**: frame ka 90% background hai aur dono presets ka background gehra hai,
isliye ek asli badlav bhi chhota dikhta tha. Teesri baar background `brand.primary` par rakha
(do presets me sabse alag token) — fasla **215.5**, aur naapa hua rang expected `#C25A37` se
sirf 11.2 door. Ab sawaal saaf hai: render token padhta hai ya nahi.

**3. `export` ka kram module graph tod raha tha.**

`templates/apply.ts` `timeline/ops` aur `registry/sceneTypes` dono import karta hai. Use
`index.ts` me upar rakhne par `registerBuiltins()` aadhe bane `sceneTypes` par chal padta tha
("Cannot access 'BUILTIN_SCENE_TYPES' before initialization"). Ye galti **build me nahi**,
sirf chalane par dikhti hai. Ab templates sabse aakhir me export hote hain, aur wajah wahin
likhi hai.

## Verify (asli output)

```
$ npm run typecheck
(6 workspaces, koi error nahi)

$ npm run check
ALL PASS: 8 / 9 / 32 / 60 / 20 / 12 tests, 0 fail    # studio
ALL PASS: 371 assertions groups, 0 fail              # core (+21 naye Phase 17 ke)

$ npm run build:studio
✓ Compiled successfully
└ ƒ /project/[id]    154 kB    307 kB
```

### 17.14 — template se do MP4, aur brand ka asar

```
$ npm run render:template --workspace @reel/worker

1. template se doc
  ok   template mila — Rahul + Papa
  ok   9x16: doc bana (4 scene) — 1080x1920, 3 scene chhoote (asset nahi tha)
  ok   1x1: doc bana (4 scene) — 1080x1080, 3 scene chhoote (asset nahi tha)
  ok   dono size par ek hi scenes, ek hi kram (17.4) — 9x16: text>text>text>cta | 1x1: text>text>text>cta

2. render — dono size
  ok   9x16 render hua — render-out/templates/rahul-papa-9x16.mp4
  ok   1x1 render hua — render-out/templates/rahul-papa-1x1.mp4

3. brand badalne se render ke pixels badalte hain (17.11)
  .. naap 13.50s par (CTA scene)
  .. apka-saathi: rgb(202, 96, 50)
  .. mono-dark  : rgb(233, 226, 219)
  .. sabse rangeen pixel: apka-saathi 152, mono-dark 14
  ok   brand preset badalne se MP4 ke rang sach me badle — rang ka fasla 215.5
  ok   apka-saathi ka primary sach me rangeen hai, mono-dark ka nahi — chroma 152 vs 14
  ok   naapa hua rang #C25A37 ke paas hai — fasla 11.2

ALL PASS: 9 checks, 0 fail  (templates)
```

"3 scene chhoote (asset nahi tha)" jaan-boojhkar hai: is script ke paas koi asli media file
nahi hai. Wo scenes `skipped[]` me wajah ke saath aate hain — chup-chaap nahi.

Aakhri check sabse zaroori hai. Sirf "rang badal gaya" kehna kaafi nahi hota (koi bhi badlav
rang badal sakta hai); yahan naapa hua rang **theek `#C25A37`** ke paas hai, jo Apka Saathi ke
preset me likha hai. Yaani render sach me us token ko us preset se resolve kar raha hai.

## Baaki kya hai

| Kya | Kyun ruka |
|---|---|
| 17.8 / 17.11 / 17.12 ka browser wala hissa | `studio/.env.local` nahi hai → dev server nahi chalta |
| `reel_templates` / `reel_brand_presets` | SQL likha hua hai, user ne chalaya nahi. Panel me "save" abhi clipboard me JSON deta hai aur ye wahin likha hai. |
| Template ka thumbnail | ek chhota render chahiye — wo Phase 20 (lifecycle) ka kaam hai |
| 17.13 ka font-upload | Font system chalta hai (Phase 9), par brand ke apne **font files** upload karne ka raasta nahi bana. Abhi brand ke font system fonts hain. |
| End-screen ka scene | Doc me save hota hai; use scene me badalne wala code nahi likha. Aadha bana button dikhane se behtar hai ki abhi wo sirf setting rahe. |

## Done when

Template se ek editable reel 5 minute me ban jaati hai, aspect badalne pe layout theek rehta
hai, brand token badalne se poora look badalta hai, aur manual overrides safe hain.

→ Doosra aur teesra **naap liye gaye** (render se). Pehla aur chautha core tests se pakke hain
  par browser me nahi dekhe gaye.

## Progress log

| Kab | Kya hua |
|---|---|
| 2026-08-20 | 17.1–17.12, 17.14, 17.15 done; 17.13 aadha. Ek bada bug pakda gaya: render brand tokens padhta hi nahi tha (poora token system bekaar tha). Naya script `render:template` — 9/9, brand badalne par rang ka fasla 215.5 aur naapa hua rang #C25A37 se sirf 11.2 door. |
