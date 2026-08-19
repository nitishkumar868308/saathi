# Phase 3 — Remotion composition + worker + FIRST REAL MP4

**STATUS:** COMPLETE (2026-08-19)
**One-line prompt:** `Read docs/reel-studio/README.md, then do Phase 3 of AI Reel Studio.`
**Rules:** README.md ke Standing + Dynamic rules binding. Resume Protocol follow karo.
**Depends on:** Phase 1 ✅, Phase 2 ✅

**Goal:** Project JSON se ek asli, chalne wala 1080x1920 MP4 nikale — bina kisi UI ke.
Windows + Chromium + FFmpeg ka risk yahin mar jaata hai.

## Checklist

- [x] 3.1 Remotion license — ek line: **individual ya 3 tak employees waali for-profit
      company ke liye free hai (commercial use bhi), usse badi company ko paid license
      chahiye.** Solo ho to aaj free. Link: https://www.remotion.pro/license
      → Ye `node_modules/remotion/LICENSE.md` se padha gaya (installed version se, yaad se nahi).
      ⚠️ Do baatein note karne layak: (a) Remotion 5.0 me license thoda badlega
      (LICENSE.md me link diya hai), (b) 4 ya zyada employees hote hi paid ho jaayega —
      isiliye `RenderEngine` interface banaya gaya hai (3.9), taaki engine badalna ek
      nayi file ka kaam rahe.
- [x] 3.2 `remotion`, `@remotion/transitions`, `@remotion/media-utils` (reel-remotion me)
      aur `@remotion/bundler`, `@remotion/renderer` (worker me) — sab `4.0.513`.
- [x] 3.3 `src/ReelComposition.tsx` — inputProps = poora doc. Width/height/fps/duration
      doc se. Tracks `order` se layer hote hain.
      → **Faisla: bada `order` upar aata hai** (baad me draw hota hai). Registry ke
      defaults isi kram me hain — video(0) → image(1) → overlay(2) → text(3) → subtitle(4) —
      isliye text apne aap video ke upar aata hai, bina kisi special case ke.
- [x] 3.4 `src/ItemRenderer.tsx` — component registry ke `componentKey` se. Poore renderer
      me `item.type` ka lookup **sirf yahi ek jagah** hai.
- [x] 3.5 `items/` me paanchon component. Transform sab ek shared `<Transformed>` se lagate
      hain, apna-apna nahi.
- [x] 3.6 `registerItemComponent(key, comp)` — `src/register.ts` me idempotent function
      (import ke side-effect par bharosa nahi kiya).
- [x] 3.7 `src/Root.tsx` — ek `<Composition>`, `calculateMetadata` doc se size/fps/duration
      leta hai. `width`/`height`/`fps` jaan-boojhkar likhe hi nahi gaye (Dynamic rule 4).
- [x] 3.8 `resolveAssets(doc, assets, storage, {publicDir})` — `@reel/storage` me.
      **Doc me kabhi URL save nahi hota.**
- [x] 3.9 `worker/src/engines/types.ts` — `RenderEngine` interface. Isme Remotion ka ek
      bhi type nahi aata.
- [x] 3.10 `worker/src/engines/remotion.ts` — bundle → selectComposition → renderMedia.
- [x] 3.11 `worker/src/ffmpeg.ts` — probe, `+faststart` remux (`-c copy`), frame extract.
      `REEL_FFMPEG_PATH` / `REEL_FFPROBE_PATH` se override.
- [x] 3.12 `worker/scripts/render-sample.ts` — placeholder media **khud FFmpeg se**.
- [x] 3.13 `npm run render:sample` root script.
- [x] 3.14 MP4 disk pe aayi, `ffprobe` output neeche — 1080x1920, 30fps, h264 High,
      duration sahi, **audio stream present**.
- [x] 3.15 3 frames extract kiye + Ken Burns ka zoom **naapa** gaya (dekhne ke bharose nahi).
- [x] 3.16 Doosra sample 16:9 @ 24fps — **sirf doc badal kar, code chhue bina**.
- [x] 3.17 Render time neeche likha hai.
- [x] 3.18 `npm run typecheck` clean. Commit `ad73883`.

## Verify (asli output)

### Sample 1 — reel 1080x1920 @ 30fps

```
$ npm run render:sample

0. toolchain
  ok   ffmpeg maujood — ffmpeg version 9.0-full_build
  ok   ffprobe maujood — ffprobe version 9.0-full_build

1. placeholder media (FFmpeg se khud banayi)
  ok   image ban gayi — 2560x2560
  ok   video ban gayi — 1080x1920
  ok   audio ban gayi — 48000Hz 2ch

2. assets storage me
  ok   image -> permanent/assets/as_sample_image.png
  ok   video -> permanent/assets/as_sample_video.mp4
  ok   audio -> permanent/assets/as_sample_audio.wav

3. Project JSON
  ok   doc schema pass karta hai
  ok   doc ki size preset se aayi hai — 1080x1920 @ 30fps, 300 frames

4. assets resolve (doc me sirf assetId hota hai)
  ok   saare assets publicDir me utre

5. render
   20%  rendering  24/300 frames
   ...
  100%  encoding  300/300 frames
  ok   render poora hua — 5.33 MB

7. ffprobe — asli output
{
  "streams": [
    { "codec_type": "video", "codec_name": "h264", "profile": "High",
      "width": 1080, "height": 1920, "pix_fmt": "yuv420p", "r_frame_rate": "30/1" },
    { "codec_type": "audio", "codec_name": "aac", "profile": "LC",
      "sample_rate": "48000", "channels": 2 }
  ],
  "format": {
    "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
    "duration": "10.048000", "size": "5587281", "bit_rate": "4448472",
    "tags": { "encoder": "Lavf63.1.100", "comment": "Made with Remotion 4.0.513" }
  }
}
  ok   video codec h264 / profile High / pixel format yuv420p
  ok   width doc se — 1080 | height doc se — 1920 | fps doc se — 30
  ok   duration doc se milti hai — 10.048s (doc: 10.000s)
  ok   AUDIO STREAM maujood hai — aac 48000Hz 2ch
  ok   audio sach me sunai deti hai (khaali track nahi) — mean_volume -37.4 dB

ALL PASS: 29 checks, 0 fail  (reel-30fps)
```

Colour tags alag se (`ffprobe -show_entries stream=color_*`):

```
profile=High   level=40   pix_fmt=yuv420p
color_range=tv   color_space=bt709   color_transfer=bt709   color_primaries=bt709
```

### Sample 2 — landscape 1920x1080 @ 24fps (3.16)

**Ek bhi line code badle bina** — sirf `--preset=landscape --fps=24`:

```
$ npm run render:sample -- --preset=landscape --fps=24

  ok   doc ki size preset se aayi hai — 1920x1080 @ 24fps, 240 frames
  ok   video codec h264 / profile High / yuv420p
  ok   width doc se — 1920 | height doc se — 1080 | fps doc se — 24
  ok   duration doc se milti hai — 10.048s (doc: 10.000s)
  ok   AUDIO STREAM maujood hai — aac 48000Hz 2ch
  ok   khaali jagah me blurred copy hai (kaali patti nahi) — kinare ki mean brightness 68.9

ALL PASS: 30 checks, 0 fail  (landscape-24fps)
```

### Ken Burns — naapa gaya, dekha nahi (3.15)

Sample image jaan-boojhkar naapne layak banayi gayi hai: gehre grid ke beech ek
**400x400 ka safed chaukor**. Zoom badhta hai to us chaukor ki chaudai pixels me
badhti hai — aur wo ginti ja sakti hai. Script frame ko gray raw me nikaal kar
beech waale row ke bright pixels ginti hai.

Chaukor ki asli chaudai = `400 x coverScale x kenBurnsScale`, aur source square
hone ki wajah se `coverScale` dono orientation me 0.75 aati hai:

```
reel 1080x1920 @30                        landscape 1920x1080 @24
  frame  15 (0.50s): 312px  vs 312.0        frame  12 (0.50s): 312px  vs 312.0
  frame  75 (2.50s): 360px  vs 360.0        frame  60 (2.50s): 360px  vs 360.0
  frame 135 (4.50s): 408px  vs 408.0        frame 108 (4.50s): 408px  vs 408.0
  312 -> 360 -> 408                          312 -> 360 -> 408
```

Teeno naap **expected value par bilkul theek** baithe (tolerance 4px thi, farak 0px).
Yahi sabit karta hai ki keyframe interpolation, easing, aur fit ki base scale —
teeno ka ganit sahi hai.

Frames dekhne ke liye:
```
render-out/samples/frames-reel-30fps/       (frame-15, frame-75, frame-135, frame-text)
render-out/samples/frames-landscape-24fps/  (+ frame-video-blur.png)
```

Maine khud dekhe: `frame-15` me grid chhota aur chaukor chhota; `frame-135` me grid
saaf bada, chaukor bada, aur neeche terracotta band par "APKA SAATHI" cream serif me
(`brand.primary` + `brand.text` + `brand.font.display` — sab tokens se, hex se nahi).

### Render time (3.17)

| Sample | frames | sirf render | speed | bundle+render |
|---|---|---|---|---|
| reel 1080x1920 @30 | 300 (10s) | 31.0s | 9.7 fps | 39.2s |
| landscape 1920x1080 @24 | 240 (10s) | 26.8s | 8.9 fps | 35.5s |

Yaani **30-second reel ≈ 90-100 second render** is machine par (CPU, koi GPU nahi).
Plan ka andaza "1-4 min" tha — usi ke andar hai. Pehli baar 113MB ka Chrome Headless
Shell bhi utarta hai (~30s), wo sirf ek baar hota hai.

## Ek asli bug jo mila aur theek hua

Landscape render me portrait video sahi letterbox ho raha tha, par uske **peeche
chupchaap KAALI PATTI** aa rahi thi — jabki item ka `fit.background.kind` saaf-saaf
`"blurred-asset"` tha.

Wajah: `FitBackground` ko `src` string milti thi aur wo andar `<Img>` banata tha.
Image par ye chalta tha, par video par `<Img>` kuch dikha hi nahi sakta — isliye
`VideoItem` use `null` de raha tha aur background poori tarah gayab tha. Koi test
ise pakad nahi raha tha kyunki **video ban jaati thi, bas galat**.

Theek kaise kiya: ab `FitBackground` ko **node** milta hai (`blurLayer`), aur har item
apna media element khud banakar deta hai — `ImageItem` ek `<Img>`, `VideoItem` ek
muted `<OffthreadVideo>`. Aur sample script me iska naapa hua check bhi joda:

```
pehle : kinare ki mean brightness ~0    (kaali patti)
ab    : kinare ki mean brightness 68.9  (blurred copy)
```

## Faisle jo is phase me liye gaye

1. **Fit `object-fit` se hota hai, haath ki math se nahi.** Render ke waqt asset ka
   natural size pata nahi hota (wo Phase 5 me DB me aayega); haath se karne ke liye har
   image ka size async me poochhna padta, jo har frame par `delayRender` lagata aur
   render kaanpta bana deta. `@reel/core` ka `computeFit()` bekaar nahi hai — wo **UI**
   ke liye hai (auto-fit buttons, upscale warning), jahan size DB se pata hota hai.
2. **Assets render se pehle disk par utaar liye jaate hain**, signed URL nahi diya jaata.
   Lamba render ke beech presigned URL expire ho jaaye to aadha output chupchaap tootta
   hai. Ek baar utaar lene se render poori tarah offline aur dohraane layak ho jaata hai.
3. **Keyframe evaluation Phase 13 se pehle aa gaya** — kyunki Ken Burns ke bina 3.12
   poora ho hi nahi sakta tha. Sirf *evaluation* likha gaya (`sampleKeyframes` +
   cubic-bezier easing); lanes, curve editor aur UI Phase 13 ka kaam hai. Phase 13 ise
   badhayega, badlega nahi.
4. **Default brand tokens Phase 17 se pehle aa gaye** — iske bina `color: "brand.text"`
   seedha CSS me chala jaata aur browser use chupchaap gira deta: text kaala ya gayab,
   aur wajah kahin nahi dikhti. Phase 17 me ye DB-driven ho jaayenge, ye fallback rahega.
5. **EXPORT_PRESETS Phase 3 me hi bhar diye gaye** — renderer ko CRF kahin se to lena hi
   tha, aur "abhi ke liye 18 likh dete hain" bilkul wahi magic number hota jisse bachna hai.
6. **`bundle()` har render par chalta hai** (~8s). Cache Phase 11 me aayega. Abhi cache
   rakhna matlab code badalne ke baad bhi purana bundle chalte rehna — "maine to theek
   kar diya tha, video me kyun nahi aaya" wali sabse chidhane wali cheez.
7. **`ReelCompositionProps` `type` hai, `interface` nahi.** Remotion ke `<Composition>` ko
   props `Record<string, unknown>` ke saanche me chahiye; TypeScript type-alias ko implicit
   index signature deta hai par interface ko nahi. Interface likhne par compile hi nahi hoti.

## Khula hua (Phase 20 ke liye)

**Colour round-trip ka theek probe.** Output ke tags bilkul sahi hain aur verify ho chuke
hain (`bt709` matrix/primaries/transfer + `tv` range + High profile + yuv420p). Par jab
maine encoded pixels ko wapas RGB me badal kar brand colour se milane ki koshish ki, to
teen alag conversion tareekon ne teen alag jawab diye — aur khud ek known-correct reference
encode bhi asli value par wapas nahi aaya. Matlab **mera naapne ka tarika hi ~4% ka shift
daal raha tha**, isliye encode ki galti aur naap ki galti me farak karna abhi mumkin nahi.

Isliye yahan koi daawa nahi kiya ja raha ki rang bilkul exact hain — sirf itna ki **tags
standard aur sahi hain**. Iska sahi jawab Phase 20 me ek dhang ke colour probe se
milega (known patch render karke, ek hi tay conversion se naap kar). Tab tak ye khula hai.

## Done when

Do MP4 (1080x1920@30 aur 1920x1080@24) sirf doc badal ke bane, dono chalte hain, audio ke
saath, aur `ffprobe` output paste kiya gaya hai. **Yahan tak sab UI ke bina.**

→ **Sab ho gaya.** Dono MP4 bane (29/29 aur 30/30), dono me audio stream hai aur wo
sach me sunai deti hai (mean_volume -37.4 dB), ffprobe output upar hai, aur poora kaam
bina ek bhi UI line ke hua.

## Progress log

| Date | What was done | Verified by | Next |
|---|---|---|---|
| 2026-08-19 | 3.1-3.18 poore. `@reel/remotion` me composition + ItemRenderer + 5 item components + FitLayer + Transformed; `@reel/core` me keyframe interpolation, brand tokens, export presets; `worker` me RenderEngine interface, Remotion engine, ffmpeg helper, aur naapne wala render-sample script. Ek asli bug (video ka blurred background = kaali patti) pakda aur theek kiya. Commit `ad73883`. | reel 29/29, landscape 30/30; ffprobe: h264 High / yuv420p / 1080x1920@30 aur 1920x1080@24 / aac 48kHz 2ch / bt709+tv tags; Ken Burns pixel se naapa — 312/360/408 vs expected 312.0/360.0/408.0 (farak 0px); blur fix ke baad kinare ki brightness 0 → 68.9; `npm run typecheck` exit 0; `npm run check` 70/70 | Phase 4 — Studio app shell + project CRUD + autosave |
