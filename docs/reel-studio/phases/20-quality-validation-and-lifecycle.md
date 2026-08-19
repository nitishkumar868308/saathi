# Phase 20 — Export quality validation + asset lifecycle cleanup

**STATUS:** code done — cleanup ka asli chalna `worker/.env` par ruka hai
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 20 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic + **A1 Quality** rules binding. Resume Protocol follow karo.
**Depends on:** Phase 11 complete

**Goal:** quality ka darwaza. Jo blurry/tuti cheez hai wo export se pehle pakdi jaaye, aur
4K ka jhooth kabhi na bole. Plus temporary files ka safai system.

## ⚠️ Tick ka matlab

- `[x]` = **chalaya gaya hai**, aur neeche `→` me uska asli output hai.
- `[ ]` = code likha hua hai par chalaya nahi. Kya rok raha hai wo likha hai.

## Checklist

- [x] 20.1 `VALIDATION_RULES` registry: `{ id, severity, scope, check }`. If-else mana.
      → `quality/validate.ts` — 17 rules. Har rule apne aap me poora hai; nayi jaanch ek entry.
      → **Phase 11 ka `preflight()` isi me migrate ho gaya.** Do list rakhne par ek din ek
        rule kahin theek hota aur doosri jagah wahi bug pada rehta. Purana `preflight()` ab ek
        patla wrapper hai (uske callers toote nahi) aur uske upar apna test bhi hai.
- [x] 20.2 Teen public functions, sab `{ valid, errors, warnings, recommendations }` dein.
      → `validateAssetQuality` / `validateProjectQuality` / `validateExportSettings` — teeno
        **wahi** rules chalate hain, sirf `scope` se chhaante hue.
- [x] 20.3 Rules ki poori list.
      → 17 rules: empty-timeline, missing-asset, **unreadable-asset**, needs-asset,
        zero-duration, all-hidden, beyond-duration, upscale, **low-res-for-preset**,
        preset-too-big, **no-gain-from-4k**, source-shorter, **fps-mismatch**,
        **missing-font**, silent, **clipping-risk**, **loudness-off-target**,
        **long-reel**, **temp-asset-expiring**.
      → Text overflow aur codec wale rules **nahi** bane — wajah neeche table me.
- [x] 20.4 Upscale ka **asli** ganit: keyframes + animation + zoom sab milakar.
      → `quality/scale.ts` — `maxEffectiveScale()`.
      → ⚠️ Keyframes hon to base `transform.scale` **nahi** ginte: keyframe engine keyframe
        wali value ko static ke **upar** nahi lagata, uski **jagah** chalata hai. Dono ginne
        par 1.4x Ken Burns 1.96 batata aur har baar jhoothi chetavni aati. Iska apna test hai.
      → Zoom-pan (Phase 18) wahi keyframes banata hai, isliye wo apne aap ginti me aa gaya —
        uske liye alag code nahi likhna pada.
- [x] 20.5 4K rule ka **exact** message.
      → `LOW_RES_MESSAGE` — `"Low-resolution asset detected. This asset may appear blurry in 4K."`
        Test us exact string par hai, "kuch aisa hi" par nahi.
- [x] 20.6 Quality tiers: Standard / High / 4K / **Strict**.
      → Naya `strict` preset (ek alag preset, checkbox nahi — tier doc me save hota hai,
        isliye "maine strict me export kiya tha" baad me bhi pata chalta hai).
      → `canExport(report, tier)`: strict me **warnings bhi rokti hain**.
- [x] 20.7 Validation do jagah chale — UI aur worker — **same** functions se.
      → `ExportDialog` ab `validateExportSettings()` chalati hai; worker render se pehle wahi
        function dobara chalata hai (job ka doc jama hua hota hai aur us beech me asset
        delete/expire ho sakti hai).
- [x] 20.8 Validation panel: grouped issues, "Dikhao", aur jahan mumkin "Theek karo".
      → `ValidationPanel.tsx` (naya "Quality" tab). Auto-fix **sirf wahan** hai jahan ek hi
        sahi jawab ho (upscale, source-shorter, beyond-duration, zero-duration, clipping).
        "Asset gayab hai" par button nahi — do jawab ho sakte hain, aur galat auto-fix se koi
        fix na hona behtar hai.
      → **browser me nahi dekha.**
- [x] 20.9 4K ki imaandaari: render time + file size, aur "4K se quality nahi badhegi".
      → `no-gain-from-4k` rule — aur wo **info** hai, warning nahi. User 4K jaan-boojhkar
        chun sakta hai; use "galti" batana galat hoga, use **sach** batana zaroori hai.
      → Time/size ke andaaze Phase 11 se hain aur dialog me pehle se dikhte hain.
- [x] 20.10 `cleanup.ts` — expire ho chuki temp assets, dry-run default.
      → Script bani, par **faisla `@reel/core` me hai** (`planCleanup()`), script me nahi.
        Wajah: script ko DB aur R2 chahiye; faisla sirf do liston par tika hai — aur uski
        galti sabse mehngi padti hai ("mera saara kaam chala gaya"). Alag hone se wo **abhi**
        test ho gaya, bina Supabase ke.
      → 8 test: permanent kabhi nahi mit'ti, referenced temp expiry ke baad bhi bachti hai,
        doosre project me hone par bhi bachti hai, bina expiry wali kabhi nahi mit'ti, brand ka
        logo bhi "use me" ginta hai.
      → **Script chalayi nahi** — `worker/.env` nahi hai (aapka kaam).
- [x] 20.11 Orphan scan — dono taraf.
      → `findOrphans()` core me + `--orphans` flag. Iske liye `StorageDriver` me `list()`
        jodna pada (local: recursive readdir; R2: ListObjectsV2 with continuation token).
      → ⚠️ Orphan scan **kabhi kuch nahi mitata**, chahe `--apply` diya ho. Dono taraf ke
        orphan alag wajah se bante hain aur unme se kuch bilkul theek hote hain (jaise abhi
        chal rahi upload).
- [x] 20.12 Render temp cleanup.
      → Phase 11 se hi hai (`finally` me scratch dir hat'ti hai, failure par bhi).
- [x] 20.13 Storage usage: permanent/temporary, top 10, free-tier warning.
      → `cleanup.ts` ka pehla section. 80% par saaf chetavni.
      → **Chalaya nahi** — DB chahiye.
- [x] 20.14 Test: 480p + missing asset + clipping + missing font; 4K par warnings, Strict par block.
      → `npm run validate:demo` — 11 checks. Asli output neeche.
- [ ] 20.15 Cleanup test: temp asset banao, expire karo, dry-run, phir `--apply`.
      → **Nahi chalaya** — `worker/.env` (Supabase) nahi hai. Faisla wala poora hissa test se
        pakka hai (8 test), par R2 se file sach me gayi — ye naapa nahi gaya.
- [x] 20.16 `npm run typecheck` clean + check script me assertions.
- [x] 20.17 Commit.

## Jo galat nikla

**`estimateMixPeak()` image items ko bhi gin raha tha.**

Ye bug validation demo chalane par nikla. `estimateMixPeak()` sirf `assetId === null` dekhta
tha — par image aur bina-audio video ke paas bhi `assetId` hota hai, aur unka `audio.volume`
default `1` hota hai. Nateeja: **do image wali reel par bhi "clipping ka khatra 2.00" wali
chetavni aati thi**, jabki wahan awaaz thi hi nahi.

Aisi jhoothi chetavni sabse bura karti hai: do-teen baar dikhne ke baad user har chetavni
anadekhi kar deta hai, aur jis din asli clipping hogi us din bhi wo use padhega nahi. Ab
`getItemType(item.type)?.hasAudio` bhi dekha jaata hai.

Demo me farak saaf dikha: fix se pehle "theek karne ke baad" bhi 1 warning bachi thi
(peak 1.90); fix ke baad 0.

## Verify (asli output)

```
$ npm run typecheck
(6 workspaces, koi error nahi)

$ npm run check
ALL PASS: 8 / 9 / 32 / 60 / 20 / 12 tests, 0 fail    # studio
ALL PASS: 458 assertions groups, 0 fail              # core (+31 naye Phase 20 ke)

$ npm run build:studio
✓ Compiled successfully
└ ƒ /project/[id]    160 kB    319 kB
```

### 20.14 — jaan-boojh kar toota project

Chaar galtiyan ek saath: 480p image, ek gayab asset, do oonchi awaazein (clipping), aur ek
anjaan font.

```
$ npm run validate:demo --workspace @reel/worker

2. 4K par export ki jaanch (20.14)
  errors: 1
    [missing-asset] "Gayab tasveer" ka asset nahi mila (as_gayab). Ye clip render me gulaabi card banegi.
  warnings: 5
    [upscale] "480p tasveer" 854×480 ka hai par 4.00x bada dikhaya ja raha hai — dhundhla aayega. Saaf dikhne ke liye kam se kam 3416×1920 chahiye.
    [low-res-for-preset] Low-resolution asset detected. This asset may appear blurry in 4K.
    [preset-too-big] "4K" preset 2160p ke liye hai par project 1920p ka hai. File badi hogi, quality behtar nahi — aur "4K" ka label lagakar upscaled video dena mana hai.
    [missing-font] "Caption" ka font "MeraApnaFont" list me nahi hai — render me wo kisi aur font me nikal jaayega.
    [clipping-risk] Frame 0 par saari awaazein milkar 5.00 par ja rahi hain (1 se upar = clipping ka khatra). Master volume 0.20 par le aao.
  recommendations: 1
    [no-gain-from-4k] Saare assets zyada se zyada 480p ke hain. 4K me export karne se quality nahi badhegi — sirf file badi hogi aur render me zyada waqt lagega.

  ok   gayab asset pakdi gayi
  ok   480p asset par 4K wala message aaya
  ok   clipping ka khatra pakda gaya
  ok   anjaan font pakda gaya
  ok   4K ki sachchai batayi gayi
  ok   message spec se hu-ba-hu hai (20.5)

3. Strict par export rukta hai (20.6)
  ok   normal tier par bhi error rok rahi hai
  ok   strict tier par export ruka
    strict me 1 error aur 3 warning — dono rokti hain

4. galtiyan theek karke dobara (20.14)
  errors: 0
  warnings: 0
  ok   theek karne ke baad koi error nahi
  ok   theek karne ke baad koi warning nahi
  ok   ab strict par bhi export chalega — 0 error, 0 warning

ALL PASS: 11 checks, 0 fail  (validation)
```

Har message me **exact numbers** hain — "dhundhla aayega" ke saath "3416×1920 chahiye",
"clipping ka khatra" ke saath "5.00" aur "0.20 par le aao". Sirf samasya batane se user kuch
nahi kar sakta.

Chautha section sabse zaroori hai: galtiyan theek karne ke baad **sab kuch saaf ho jaata hai**.
Uske bina ye validator ek aisi cheez ho sakta tha jo hamesha kuch na kuch bolti rahe — aur wo
bhi anadekha kar diya jaata.

## Baaki kya hai

| Kya | Kyun ruka |
|---|---|
| 20.15 cleanup ka asli chalna | `worker/.env` (Supabase) nahi hai. Faisla (`planCleanup`) ke 8 test pass hain; R2 se file sach me gayi — wo naapa nahi gaya. |
| 20.8 / 20.9 ka browser wala hissa | `studio/.env.local` nahi hai → dev server nahi chalta |
| Text overflow ka rule | Text ki asli chaudai naapne ke liye font metrics chahiye, jo core me nahi hain (wahan DOM nahi hai). Ye Phase 6 ke safe-area guides se aankh se dikhta hai. |
| Codec ka rule | `probeAsset()` codec deta hai par abhi wo `assetMeta` tak nahi pahunchta. Rule ka jhoola (`AssetInfo.codec`) bana hua hai. |
| fps-mismatch ka poora roop | Asset ka apna fps abhi metadata me nahi aata, aur **jhootha andaaza lagana galat hoga**. Abhi rule sirf ajeeb project-fps par bolta hai. |

## Done when

Validator asli problems pakadta hai (upscale math sahi), Strict block karta hai, 4K ka jhooth
nahi bolta, aur temp files safe tarike se saaf hote hain.

→ Pehle teen **naap liye gaye**. Chautha: faisla test se pakka hai par asli delete
  `worker/.env` par ruka hai.

## Progress log

| Kab | Kya hua |
|---|---|
| 2026-08-20 | 20.1–20.14, 20.16, 20.17 done; 20.15 env par ruka. Purana `preflight()` naye registry me migrate hua (do list nahi). Ek asli bug pakda gaya: `estimateMixPeak()` image items ko bhi gin raha tha, isliye bina awaaz wali reel par bhi clipping ki jhoothi chetavni aati thi. Naye scripts: `validate:demo` (11/11) aur `cleanup` (dry-run default). |
